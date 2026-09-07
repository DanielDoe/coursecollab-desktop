import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { ensureTradeCenterConfigSchema } from "@/lib/ensure-trade-center-config-schema";
import { requireAuthenticatedStudentTradeAccess } from "@/lib/trade-center-student-access";
import { resolveTradeCenterWeek } from "@/lib/trade-center-server";
import {
  applyTradePointDeduction,
  ensureCarriedOverPointsColumn,
  tradableActivityPoints,
} from "@/lib/trade-center-carry-forward";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pointsToDonate, poolType } = body;

    const studentRes = await requireAuthenticatedStudentTradeAccess(
      request,
      body.studentId ?? body.studentDatabaseId,
      String(body.session ?? ""),
    );
    if (!studentRes.ok) {
      return NextResponse.json({ error: studentRes.error }, { status: studentRes.status });
    }
    const studentIdNum = studentRes.studentId;
    const session = studentRes.normalizedSession;

    if (!body.session || !pointsToDonate) {
      return NextResponse.json(
        { error: "Session and points to donate are required" },
        { status: 400 }
      );
    }

    if (poolType === "DIRECT") {
      return NextResponse.json(
        {
          error:
            "Peer-to-peer donations require instructor approval. Submit a donation request from the Peers tab instead.",
          useDonationRequests: true,
        },
        { status: 403 },
      );
    }

    const pointsToDonateNum = parseInt(String(pointsToDonate), 10);
    if (!Number.isFinite(pointsToDonateNum) || pointsToDonateNum <= 0) {
      return NextResponse.json({ error: "Invalid points amount" }, { status: 400 });
    }

    const { weekStart: weekStartDate } = await resolveTradeCenterWeek(session);

    await ensureTradeCenterConfigSchema();
    await ensureCarriedOverPointsColumn();

    // Check trade center config
    const config = await sql`
      SELECT * FROM trade_center_config
      WHERE (session = ${session} OR session = 'ALL')
        AND is_active = true
      ORDER BY CASE WHEN session = ${session} THEN 0 ELSE 1 END
      LIMIT 1
    `;

    if (config.length === 0 || !config[0].donations_enabled) {
      return NextResponse.json(
        { error: "Donations are currently disabled" },
        { status: 403 }
      );
    }

    const minDonation = config[0].min_donation_points || 100;
    if (pointsToDonateNum < minDonation) {
      return NextResponse.json(
        { error: `Minimum donation is ${minDonation} points` },
        { status: 400 }
      );
    }

    // Get donor activity points (lock row to prevent concurrent overdraft)
    const donorPoints = await sql`
      SELECT * FROM student_activity_points
      WHERE student_id = ${studentIdNum}
        AND session = ${session}
        AND week_start_date = ${weekStartDate}
      FOR UPDATE
    `;

    if (donorPoints.length === 0) {
      return NextResponse.json(
        { error: "No activity points found for this week" },
        { status: 404 }
      );
    }

    const points = donorPoints[0] as {
      id: number;
      practice_points: number;
      playground_points: number;
      reading_points: number;
      carried_over_points?: number;
    };

    const tradable = tradableActivityPoints(points);
    if (tradable < pointsToDonateNum) {
      return NextResponse.json(
        { error: "Insufficient points to donate" },
        { status: 400 }
      );
    }

    const deducted = applyTradePointDeduction(
      pointsToDonateNum,
      Number(points.carried_over_points ?? 0),
      Number(points.practice_points ?? 0),
      Number(points.playground_points ?? 0),
      Number(points.reading_points ?? 0),
    );

    // Handle different donation types
    if (poolType === "COMMUNITY") {
      await sql`
        UPDATE student_activity_points
        SET
          carried_over_points = ${deducted.carriedOver},
          practice_points = ${deducted.practice},
          playground_points = ${deducted.playground},
          reading_points = ${deducted.reading},
          total_donations_count = total_donations_count + 1,
          total_donated_points = total_donated_points + ${pointsToDonateNum},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${points.id}
      `;

      try {
        await sql`
          INSERT INTO trade_transactions (
            student_id, session, transaction_type,
            points_used, donation_pool_type
          )
          VALUES (
            ${studentIdNum}, ${session}, 'DONATION',
            ${pointsToDonateNum}, 'COMMUNITY'
          )
        `;
      } catch (insertErr) {
        await sql`
          UPDATE student_activity_points
          SET
            carried_over_points = ${Number(points.carried_over_points ?? 0)},
            practice_points = ${Number(points.practice_points ?? 0)},
            playground_points = ${Number(points.playground_points ?? 0)},
            reading_points = ${Number(points.reading_points ?? 0)},
            total_donations_count = GREATEST(0, total_donations_count - 1),
            total_donated_points = GREATEST(0, total_donated_points - ${pointsToDonateNum}),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${points.id}
        `;
        throw insertErr;
      }

      return NextResponse.json({
        success: true,
        message: `Successfully donated ${pointsToDonateNum} points to the Community Pool!`,
        donationType: "COMMUNITY",
      });
    }

    return NextResponse.json(
      { error: "Invalid donation type. Use 'COMMUNITY' for community pool donations." },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error processing donation:", error);
    return NextResponse.json(
      { error: "Failed to process donation" },
      { status: 500 }
    );
  }
}

