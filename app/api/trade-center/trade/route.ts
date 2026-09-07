import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { recalculateAndSaveGrade } from "@/lib/grades";
import {
  calculateEcFromTradeAmount,
  getPointsPerEc,
} from "@/lib/engagement-points-system";
import { parseTradeCenterConfigRow } from "@/lib/trade-center-shared";
import { requireAuthenticatedStudentTradeAccess } from "@/lib/trade-center-student-access";
import { resolveTradeCenterWeek } from "@/lib/trade-center-server";
import { syncActivityPoints } from "@/lib/trade-center-sync";
import { sendEcTradeSuccessEmail } from "@/lib/trade-center-notifications";
import {
  applyTradePointDeduction,
  ensureCarriedOverPointsColumn,
  fetchLifetimeEngagementCredits,
  tradableActivityPoints,
} from "@/lib/trade-center-carry-forward";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session, pointsToTrade, idempotencyKey } = body;

    const studentRes = await requireAuthenticatedStudentTradeAccess(
      request,
      body.studentId ?? body.studentDatabaseId,
      String(session ?? ""),
    );
    if (!studentRes.ok) {
      return NextResponse.json({ error: studentRes.error }, { status: studentRes.status });
    }
    const studentIdNum = studentRes.studentId;
    const normalizedSession = studentRes.normalizedSession;

    if (!session || !pointsToTrade) {
      return NextResponse.json(
        { error: "Session and points to trade are required" },
        { status: 400 },
      );
    }

    const pointsToTradeNum = parseInt(String(pointsToTrade), 10);
    if (!Number.isFinite(pointsToTradeNum) || pointsToTradeNum <= 0) {
      return NextResponse.json({ error: "Invalid points amount" }, { status: 400 });
    }

    const { weekStart: weekStartDate } = await resolveTradeCenterWeek(normalizedSession);

    const configRows = await sql`
      SELECT * FROM trade_center_config
      WHERE (session = ${normalizedSession} OR session = 'ALL')
        AND is_active = true
      ORDER BY CASE WHEN session = ${normalizedSession} THEN 0 ELSE 1 END
      LIMIT 1
    `;
    const configRow = parseTradeCenterConfigRow(
      configRows[0] as Record<string, unknown> | undefined,
    );

    if (!configRow.trading_enabled) {
      return NextResponse.json({ error: "Trading is currently disabled" }, { status: 403 });
    }

    const multiplier = configRow.ec_conversion_multiplier;
    const maxEC = configRow.max_engagement_credits;
    const pointsPerEc = getPointsPerEc(multiplier);

    if (idempotencyKey && String(idempotencyKey).trim()) {
      try {
        const dup = await sql`
          SELECT id FROM trade_transactions
          WHERE student_id = ${studentIdNum}
            AND session = ${normalizedSession}
            AND transaction_type = 'TRADE'
            AND metadata->>'idempotencyKey' = ${String(idempotencyKey).trim()}
          LIMIT 1
        `;
        if (dup.length > 0) {
          return NextResponse.json({ success: true, duplicate: true, message: "Trade already processed." });
        }
      } catch {
        /* metadata column may be missing until migration runs */
      }
    }

    let locked = await sql`
      SELECT * FROM student_activity_points
      WHERE student_id = ${studentIdNum}
        AND session = ${normalizedSession}
        AND week_start_date = ${weekStartDate}::date
      FOR UPDATE
    `;

    if (locked.length === 0) {
      await syncActivityPoints(studentIdNum, normalizedSession);
      locked = await sql`
        SELECT * FROM student_activity_points
        WHERE student_id = ${studentIdNum}
          AND session = ${normalizedSession}
          AND week_start_date = ${weekStartDate}::date
        FOR UPDATE
      `;
    }

    if (locked.length === 0) {
      return NextResponse.json(
        { error: "No activity points found for this week" },
        { status: 404 }
      );
    }

    const points = locked[0] as {
      id: number;
      practice_points: number;
      playground_points: number;
      reading_points: number;
      total_points: number;
      carried_over_points?: number;
      engagement_credits: number;
    };

    await ensureCarriedOverPointsColumn();
    const tradable = tradableActivityPoints(points);

    if (tradable < pointsToTradeNum) {
      return NextResponse.json({ error: "Insufficient points to trade" }, { status: 400 });
    }

    const lifetimeEc = await fetchLifetimeEngagementCredits(studentIdNum, normalizedSession);
    const currentTotalEC = lifetimeEc;
    const creditsGained = calculateEcFromTradeAmount(pointsToTradeNum, {
      multiplier,
      maxEc: maxEC,
      currentEc: Math.floor(currentTotalEC),
    });

    if (creditsGained <= 0) {
      return NextResponse.json(
        {
          error: `Insufficient points to gain any Engagement Credits. Minimum ${pointsPerEc} points required for 1 EC.`,
        },
        { status: 400 }
      );
    }

    const newTotalEC = lifetimeEc + creditsGained;
    if (Math.floor(newTotalEC) > maxEC) {
      return NextResponse.json(
        {
          error: `Maximum Engagement Credits (${maxEC}) reached. You can only gain ${Math.max(0, maxEC - Math.floor(lifetimeEc))} more EC.`,
        },
        { status: 400 }
      );
    }

    const weeklyTradeEc = Math.floor(Number(points.engagement_credits) || 0) + creditsGained;

    const deducted = applyTradePointDeduction(
      pointsToTradeNum,
      Number(points.carried_over_points ?? 0),
      Number(points.practice_points ?? 0),
      Number(points.playground_points ?? 0),
      Number(points.reading_points ?? 0),
    );

    await sql`
      UPDATE student_activity_points
      SET
        carried_over_points = ${deducted.carriedOver},
        practice_points = ${deducted.practice},
        playground_points = ${deducted.playground},
        reading_points = ${deducted.reading},
        engagement_credits = ${weeklyTradeEc},
        last_trade_at = CURRENT_TIMESTAMP,
        total_trades_count = total_trades_count + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${points.id}
    `;

    const meta =
      idempotencyKey && String(idempotencyKey).trim()
        ? JSON.stringify({ idempotencyKey: String(idempotencyKey).trim() })
        : null;

    let ledgerInserted = false;
    try {
      await sql`
        INSERT INTO trade_transactions (
          student_id, session, transaction_type,
          points_used, credits_gained, metadata
        )
        VALUES (
          ${studentIdNum}, ${normalizedSession}, 'TRADE',
          ${pointsToTradeNum}, ${creditsGained}, ${meta}::jsonb
        )
      `;
      ledgerInserted = true;
    } catch (insertErr) {
      try {
        await sql`
          INSERT INTO trade_transactions (
            student_id, session, transaction_type,
            points_used, credits_gained
          )
          VALUES (
            ${studentIdNum}, ${normalizedSession}, 'TRADE',
            ${pointsToTradeNum}, ${creditsGained}
          )
        `;
        ledgerInserted = true;
      } catch {
        if (!ledgerInserted) {
          await sql`
            UPDATE student_activity_points
            SET
              carried_over_points = ${Number(points.carried_over_points ?? 0)},
              practice_points = ${Number(points.practice_points ?? 0)},
              playground_points = ${Number(points.playground_points ?? 0)},
              reading_points = ${Number(points.reading_points ?? 0)},
              engagement_credits = ${Number(points.engagement_credits) || 0},
              total_trades_count = GREATEST(0, total_trades_count - 1),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ${points.id}
          `;
        }
        throw insertErr;
      }
    }

    const engagementCredits = await sql`
      SELECT * FROM engagement_credits
      WHERE student_id = ${studentIdNum} AND session = ${normalizedSession}
    `;

    if (engagementCredits.length > 0) {
      await sql`
        UPDATE engagement_credits
        SET total_credits = LEAST(total_credits + ${creditsGained}, 100),
            last_updated = CURRENT_TIMESTAMP
        WHERE student_id = ${studentIdNum} AND session = ${normalizedSession}
      `;
    } else {
      await sql`
        INSERT INTO engagement_credits (student_id, session, total_credits)
        VALUES (${studentIdNum}, ${normalizedSession}, ${creditsGained})
      `;
    }

    const updatedEngagementCredits = await sql`
      SELECT total_credits FROM engagement_credits
      WHERE student_id = ${studentIdNum} AND session = ${normalizedSession}
    `;

    const finalEC =
      updatedEngagementCredits.length > 0
        ? Number(updatedEngagementCredits[0].total_credits)
        : newTotalEC;

    try {
      await sql`
        UPDATE student_grades
        SET engagement_credits = ${finalEC}, updated_at = CURRENT_TIMESTAMP
        WHERE student_id = ${studentIdNum} AND session = ${normalizedSession}
      `;
      await recalculateAndSaveGrade(studentIdNum, normalizedSession);
    } catch (gradeError) {
      console.error("[Trade] grade sync failed (non-critical):", gradeError);
    }

    const updatedPoints = await sql`
      SELECT * FROM student_activity_points WHERE id = ${points.id}
    `;

    void sendEcTradeSuccessEmail({
      studentId: studentIdNum,
      pointsTraded: pointsToTradeNum,
      creditsGained,
      totalEc: newTotalEC,
    });

    return NextResponse.json({
      success: true,
      points: updatedPoints[0],
      creditsGained,
      totalEC: finalEC,
      lifetimeEC: finalEC,
      message: `Successfully traded ${pointsToTradeNum} points for ${creditsGained} Engagement Credit(s)!`,
    });
  } catch (error) {
    console.error("Error processing trade:", error);
    return NextResponse.json({ error: "Failed to process trade" }, { status: 500 });
  }
}
