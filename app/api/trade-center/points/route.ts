import { type NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { syncActivityPoints } from "@/lib/trade-center-sync";
import { normalizeSessionForStorage } from "@/lib/session-catalog";
import { getCreateStudentActivityPointsTableSql } from "@/lib/student-activity-points-ddl";
import { calculateEcFromPoints, getPointsPerEc } from "@/lib/engagement-points-system";
import { mergeCapsFromConfig } from "@/lib/trade-center-shared";
import { resolveTradeCenterWeek, loadActiveTradeCenterConfig } from "@/lib/trade-center-server";
import {
  requireAuthenticatedStudentTradeAccess,
  resolveStudentIdFromBody,
} from "@/lib/trade-center-student-access";
import {
  ensureCarriedOverPointsColumn,
  fetchLifetimeEngagementCredits,
  tradableActivityPoints,
} from "@/lib/trade-center-carry-forward";
import { getCourseAssessmentPerksForStudent } from "@/lib/assessment-privilege-governance";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionParam = searchParams.get("session") || "ALL";
  const studentIdParam = searchParams.get("studentId");

  const access = await requireAuthenticatedStudentTradeAccess(request, studentIdParam, sessionParam);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const studentIdNum = access.studentId;
    const normalizedSession = access.normalizedSession;

    const { weekStart: weekStartDate } = await resolveTradeCenterWeek(normalizedSession);
    const configRow = await loadActiveTradeCenterConfig(normalizedSession);
    const caps = mergeCapsFromConfig(configRow);
    const governance = await getCourseAssessmentPerksForStudent(studentIdNum);

    await ensureCarriedOverPointsColumn();
    const lifetimeEngagementCredits = await fetchLifetimeEngagementCredits(
      studentIdNum,
      normalizedSession,
    );

    // Always sync points from modules first to ensure data is up-to-date
    try {
      await syncActivityPoints(studentIdNum, normalizedSession);
    } catch (syncError: any) {
      // If error is about missing tables, try to create them and retry
      if (syncError?.message?.includes('does not exist')) {
        try {
          await sql.unsafe(getCreateStudentActivityPointsTableSql());
          
          // Retry sync with normalized session
          await syncActivityPoints(studentIdNum, normalizedSession);
        } catch (createError) {
          // Continue with empty state
        }
      }
      // Continue even if sync fails - we'll return empty state
    }

    // Get or create student activity points for current week
    let points: any[] = [];
    try {
      points = await sql`
        SELECT * FROM student_activity_points
        WHERE student_id = ${studentIdNum}
          AND session = ${normalizedSession}
          AND week_start_date = ${weekStartDate}::date
      `;
    } catch (queryError: any) {
      if (queryError?.message?.includes('does not exist')) {
        try {
          await sql.unsafe(getCreateStudentActivityPointsTableSql());
          
          // Retry query
          points = await sql`
            SELECT * FROM student_activity_points
            WHERE student_id = ${studentIdNum}
              AND session = ${normalizedSession}
              AND week_start_date = ${weekStartDate}::date
          `;
        } catch (createError) {
          // Return empty state
          return NextResponse.json({
            points: {
              id: null,
              student_id: studentIdNum,
              session: normalizedSession,
              practice_points: 0,
              playground_points: 0,
              reading_points: 0,
              total_points: 0,
              engagement_credits: 0,
              week_start_date: weekStartDate,
            },
            canTrade: configRow.trading_enabled,
            tradingEnabled: configRow.trading_enabled,
            donationsEnabled: configRow.donations_enabled,
            config: caps,
            governance,
            ecAvailable: 0,
          });
        }
      } else {
        throw queryError;
      }
    }

    if (points.length === 0) {
      // Create new record for this week with synced points
      const synced = await syncActivityPoints(studentIdNum, normalizedSession);
      
      // Fetch the newly created record
      const newPoints = await sql`
        SELECT * FROM student_activity_points
        WHERE student_id = ${studentIdNum}
          AND session = ${normalizedSession}
          AND week_start_date = ${weekStartDate}::date
      `;

      if (newPoints.length > 0) {
        const row = newPoints[0];
        const tradable = tradableActivityPoints(row);
        const ecAvailable = calculateEcFromPoints(tradable, {
          multiplier: configRow.ec_conversion_multiplier,
          maxEc: configRow.max_engagement_credits,
          currentEc: lifetimeEngagementCredits,
        });
        return NextResponse.json({
          points: { ...row, tradable_points: tradable, lifetime_engagement_credits: lifetimeEngagementCredits },
          canTrade: configRow.trading_enabled,
          tradingEnabled: configRow.trading_enabled,
          donationsEnabled: configRow.donations_enabled,
          config: caps,
          governance,
          ecAvailable,
          lifetimeEngagementCredits,
          pointsPerEc: getPointsPerEc(configRow.ec_conversion_multiplier),
        });
      }

      // Fallback: create empty record
      await sql`
        INSERT INTO student_activity_points (
          student_id, session, week_start_date,
          practice_points, playground_points, reading_points
        )
        VALUES (
          ${studentIdNum}, ${normalizedSession}, ${weekStartDate},
          ${synced?.practicePoints || 0}, ${synced?.playgroundPoints || 0}, ${synced?.readingPoints || 0}
        )
      `;

      const finalPoints = await sql`
        SELECT * FROM student_activity_points
        WHERE student_id = ${studentIdNum}
          AND session = ${normalizedSession}
          AND week_start_date = ${weekStartDate}::date
      `;

      const row = finalPoints[0];
      const tradable = row ? tradableActivityPoints(row) : synced?.totalPoints || 0;
      const ecAvailableNew = calculateEcFromPoints(tradable, {
        multiplier: configRow.ec_conversion_multiplier,
        maxEc: configRow.max_engagement_credits,
        currentEc: lifetimeEngagementCredits,
      });

      return NextResponse.json({
        points: row
          ? { ...row, tradable_points: tradable, lifetime_engagement_credits: lifetimeEngagementCredits }
          : null,
        canTrade: configRow.trading_enabled,
        tradingEnabled: configRow.trading_enabled,
        donationsEnabled: configRow.donations_enabled,
        config: caps,
        governance,
        ecAvailable: ecAvailableNew,
        lifetimeEngagementCredits,
        pointsPerEc: getPointsPerEc(configRow.ec_conversion_multiplier),
      });
    }

    const row = points[0];
    const tradable = tradableActivityPoints(row);
    const ecAvailable = calculateEcFromPoints(tradable, {
      multiplier: configRow.ec_conversion_multiplier,
      maxEc: configRow.max_engagement_credits,
      currentEc: lifetimeEngagementCredits,
    });

    return NextResponse.json({
      points: { ...row, tradable_points: tradable, lifetime_engagement_credits: lifetimeEngagementCredits },
      canTrade: configRow.trading_enabled,
      tradingEnabled: configRow.trading_enabled,
      donationsEnabled: configRow.donations_enabled,
      config: caps,
      governance,
      ecAvailable,
      lifetimeEngagementCredits,
      pointsPerEc: getPointsPerEc(configRow.ec_conversion_multiplier),
    });
  } catch (error: any) {
    // Return empty state instead of error to prevent UI crash
    let fallbackWeekStartDate: string;
    let fallbackStudentId: number;
    try {
      const { searchParams } = new URL(request.url);
      const sessionParam = searchParams.get("session") || "ALL";
      const normalized = await normalizeSessionForStorage(sessionParam);
      const week = await resolveTradeCenterWeek(normalized);
      fallbackWeekStartDate = week.weekStart;
    } catch {
      fallbackWeekStartDate = new Date().toISOString().split("T")[0];
    }
    
    try {
      const { searchParams } = new URL(request.url);
      const studentId = searchParams.get("studentId");
      const resolved = await resolveStudentIdFromBody(studentId);
      fallbackStudentId = resolved.ok ? resolved.studentId : 0;
    } catch {
      fallbackStudentId = 0;
    }
    
    return NextResponse.json({
      points: {
        id: null,
        student_id: fallbackStudentId,
        session: "ALL",
        practice_points: 0,
        playground_points: 0,
        reading_points: 0,
        total_points: 0,
        engagement_credits: 0,
        week_start_date: fallbackWeekStartDate,
      },
      canTrade: false,
      tradingEnabled: false,
      donationsEnabled: false,
      ecAvailable: 0,
    });
  }
}

