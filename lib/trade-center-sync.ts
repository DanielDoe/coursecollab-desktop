// Trade Center Activity Points Sync
// Automatically syncs points from Practice Hub, Playground, and Lecture Reading to student_activity_points

import { sql } from "@/lib/db";
import { getPracticeHubPolicyForCourse } from "@/lib/practice-hub-policy-settings.server"
import { ensureTradeCenterConfigSchema } from "@/lib/ensure-trade-center-config-schema";
import { resolveTradeSessionForStudent } from "@/lib/trade-center-student-access";
import { getCreateStudentActivityPointsTableSql } from "@/lib/student-activity-points-ddl";
import {
  calculateCombinedPracticeWeeklyPoints,
  calculatePlaygroundWeeklyPointsFromSessions,
  calculateReadingWeeklyPoints,
  getDefaultTradeCenterCaps,
} from "@/lib/engagement-points-system";
import {
  DEFAULT_TRADE_CENTER_CONFIG,
  getWeekEndExclusiveDateString,
  getWeekStartDateString,
  mergeCapsFromConfig,
  parseTradeCenterConfigRow,
  type TradeCenterConfigRow,
} from "@/lib/trade-center-shared";

interface SyncResult {
  practicePoints: number;
  playgroundPoints: number;
  readingPoints: number;
  totalPoints: number;
}

export type SyncActivityPointsOptions = {
  /** Any date in the target trade week; week bounds come from config weekly_reset_day. */
  referenceDate?: string;
};

async function loadActiveConfig(normalizedSession: string): Promise<TradeCenterConfigRow> {
  try {
    await ensureTradeCenterConfigSchema();
    const config = await sql`
      SELECT * FROM trade_center_config
      WHERE (session = ${normalizedSession} OR session = 'ALL')
        AND is_active = true
      ORDER BY CASE WHEN session = ${normalizedSession} THEN 0 ELSE 1 END
      LIMIT 1
    `;
    if (config.length > 0) {
      return parseTradeCenterConfigRow(config[0] as Record<string, unknown>);
    }
  } catch {
    /* table may be missing */
  }
  return { ...DEFAULT_TRADE_CENTER_CONFIG };
}

/**
 * Sync activity points for a student from all sources
 * This is called automatically when activities occur
 */
export async function syncActivityPoints(
  studentId: number,
  session: string,
  syncOptions?: SyncActivityPointsOptions
): Promise<SyncResult> {
  try {
    const normalizedSession = await resolveTradeSessionForStudent(session, studentId);

    let caps = getDefaultTradeCenterCaps();
    let tcConfig = { ...DEFAULT_TRADE_CENTER_CONFIG };

    try {
      tcConfig = await loadActiveConfig(normalizedSession);
      caps = mergeCapsFromConfig(tcConfig);
    } catch {
      // Continue with defaults
    }

    const carryForward = await import("@/lib/trade-center-carry-forward");
    await carryForward.ensureWeekOpeningCarryColumn();

    const ref = syncOptions?.referenceDate?.trim();
    const weekStartDate = getWeekStartDateString(
      ref ? new Date(ref) : new Date(),
      tcConfig.weekly_reset_day,
    );
    const weekEndExclusive = getWeekEndExclusiveDateString(weekStartDate);

    // 1. Practice Hub attempts (excluding lecture sample practice)
    let practicePoints = 0;
    if (tcConfig.practice_enabled) {
      let hubAttempts = 0;
      let hubAvgScore = 0;
      let hubEngagement: { basePerAttempt?: number; scoreDivisor?: number } | undefined;

      try {
        const studentCourse = await sql`SELECT course_id FROM students WHERE id = ${studentId} LIMIT 1`;
        const hubPolicy = await getPracticeHubPolicyForCourse(
          studentCourse[0]?.course_id != null ? Number(studentCourse[0].course_id) : null,
        );
        if (hubPolicy.sync_engagement_points) {
          hubEngagement = {
            basePerAttempt: hubPolicy.engagement_base_per_attempt,
            scoreDivisor: hubPolicy.engagement_score_divisor,
          };
          const hubResult = await sql`
      SELECT
        COUNT(*)::int AS attempt_count,
        AVG(score_percentage)::float AS avg_score
      FROM practice_attempts
      WHERE student_id = ${studentId}
        AND completed_at IS NOT NULL
        AND completed_at >= ${weekStartDate}::date
        AND completed_at < ${weekEndExclusive}::date
    `;

          hubAttempts = Number(hubResult[0]?.attempt_count) || 0;
          hubAvgScore = Number(hubResult[0]?.avg_score) || 0;
        }
      } catch {
        const hubResult = await sql`
      SELECT
        COUNT(*)::int AS attempt_count,
        AVG(score_percentage)::float AS avg_score
      FROM practice_attempts
      WHERE student_id = ${studentId}
        AND completed_at IS NOT NULL
        AND completed_at >= ${weekStartDate}::date
        AND completed_at < ${weekEndExclusive}::date
    `;
        hubAttempts = Number(hubResult[0]?.attempt_count) || 0;
        hubAvgScore = Number(hubResult[0]?.avg_score) || 0;
      }

    const sampleResult = await sql`
      SELECT
        COUNT(*) FILTER (WHERE is_correct)::int AS correct_count,
        COUNT(*) FILTER (WHERE NOT is_correct)::int AS wrong_count
      FROM lecture_sample_practice_attempts
      WHERE student_id = ${studentId}
        AND completed_at >= ${weekStartDate}::date
        AND completed_at < ${weekEndExclusive}::date
    `;

    const sampleCorrect = Number(sampleResult[0]?.correct_count) || 0;
    const sampleWrong = Number(sampleResult[0]?.wrong_count) || 0;

    let flashKnown = 0;
    let flashSessions = 0;
    try {
      const { fetchWeeklyFlashcardEngagementStats } = await import("@/lib/flashcard-study-engagement");
      const flashStats = await fetchWeeklyFlashcardEngagementStats(
        studentId,
        weekStartDate,
        weekEndExclusive,
      );
      flashKnown = flashStats.knownFirstTime;
      flashSessions = flashStats.sessionsComplete;
    } catch {
      /* table may not exist yet */
    }

      practicePoints = calculateCombinedPracticeWeeklyPoints(
        hubAttempts,
        hubAvgScore,
        sampleCorrect,
        sampleWrong,
        caps,
        flashKnown,
        flashSessions,
        hubEngagement,
      );
    }

    let playgroundPoints = 0;
    if (tcConfig.playground_enabled) {
      const studentResult = await sql`
        SELECT student_id FROM students WHERE id = ${studentId}
      `;

      if (studentResult.length > 0 && studentResult[0]?.student_id) {
        const studentIdString = studentResult[0].student_id;

        const playgroundResult = await sql`
          SELECT
            COUNT(*)::int AS session_count,
            AVG(pr.score)::float AS avg_score_per_session
          FROM playground_results pr
          JOIN playground_sessions ps ON pr.session_id = ps.id
          WHERE pr.student_id = ${studentIdString}
            AND pr.questions_answered > 0
            AND pr.score > 0
            AND (
              pr.completed_at IS NOT NULL
              OR (pr.questions_answered >= COALESCE(ps.question_count, pr.questions_answered))
            )
            AND COALESCE(pr.completed_at, ps.created_at) >= ${weekStartDate}::date
            AND COALESCE(pr.completed_at, ps.created_at) < ${weekEndExclusive}::date
        `;

        const playgroundSessions = Number(playgroundResult[0]?.session_count) || 0;
        const playgroundAvgScore = Number(playgroundResult[0]?.avg_score_per_session) || 0;

        playgroundPoints = calculatePlaygroundWeeklyPointsFromSessions(
          playgroundSessions,
          playgroundAvgScore,
          caps,
        );
      }
    }

    let readingPoints = 0;
    if (tcConfig.reading_enabled) {
      const { calculateWeeklyLectureReadingPoints } = await import("@/lib/lecture-slide-view-scoring");
      const { countWeeklyCourseNoteReads } = await import("@/lib/course-note-view-scoring");
      const slidesOpened = await calculateWeeklyLectureReadingPoints(studentId, weekStartDate);
      const notesRead = await countWeeklyCourseNoteReads(studentId, weekStartDate);
      readingPoints = calculateReadingWeeklyPoints(slidesOpened + notesRead, caps);
    }

    const totalPoints = practicePoints + playgroundPoints + readingPoints;

    const {
      resolveCarriedOverForWeek,
      reconcileSpendablePoints,
      getTotalPointsSpentThisWeek,
      inferWeekOpeningCarry,
    } = carryForward;

    const existingRow = await sql`
      SELECT
        carried_over_points,
        week_opening_carry,
        practice_points,
        playground_points,
        reading_points
      FROM student_activity_points
      WHERE student_id = ${studentId}
        AND session = ${normalizedSession}
        AND week_start_date = ${weekStartDate}::date
      LIMIT 1
    `;

    const gross = {
      practice: practicePoints,
      playground: playgroundPoints,
      reading: readingPoints,
    };

    let weekOpeningCarry: number;
    if (existingRow.length > 0) {
      const row = existingRow[0] as {
        carried_over_points: number | null;
        week_opening_carry: number | null;
        practice_points: number;
        playground_points: number;
        reading_points: number;
      };
      const totalSpent = await getTotalPointsSpentThisWeek(
        studentId,
        normalizedSession,
        weekStartDate,
        weekEndExclusive,
      );
      weekOpeningCarry = inferWeekOpeningCarry(
        row.week_opening_carry,
        Number(row.carried_over_points ?? 0),
        totalSpent,
        gross,
        {
          practice: Number(row.practice_points ?? 0),
          playground: Number(row.playground_points ?? 0),
          reading: Number(row.reading_points ?? 0),
        },
      );
    } else {
      weekOpeningCarry = await resolveCarriedOverForWeek(
        studentId,
        normalizedSession,
        weekStartDate,
        tcConfig.weekly_reset_day,
      );
    }

    const reconciled = await reconcileSpendablePoints(
      studentId,
      normalizedSession,
      weekStartDate,
      weekEndExclusive,
      gross,
      weekOpeningCarry,
    );

    try {
      await sql.unsafe(getCreateStudentActivityPointsTableSql());
    } catch {
      // Table might already exist
    }

    await sql`
      INSERT INTO student_activity_points (
        student_id, session, week_start_date,
        practice_points, playground_points, reading_points,
        carried_over_points, week_opening_carry
      )
      VALUES (
        ${studentId}, ${normalizedSession}, ${weekStartDate}::date,
        ${reconciled.practice}, ${reconciled.playground}, ${reconciled.reading},
        ${reconciled.carriedOver}, ${weekOpeningCarry}
      )
      ON CONFLICT (student_id, session, week_start_date)
      DO UPDATE SET
        practice_points = EXCLUDED.practice_points,
        playground_points = EXCLUDED.playground_points,
        reading_points = EXCLUDED.reading_points,
        carried_over_points = EXCLUDED.carried_over_points,
        week_opening_carry = COALESCE(
          student_activity_points.week_opening_carry,
          EXCLUDED.week_opening_carry
        ),
        updated_at = CURRENT_TIMESTAMP
    `;

    return {
      practicePoints: reconciled.practice,
      playgroundPoints: reconciled.playground,
      readingPoints: reconciled.reading,
      totalPoints: reconciled.practice + reconciled.playground + reconciled.reading + reconciled.carriedOver,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Sync activity points after a specific activity (called from API endpoints)
 */
export async function syncActivityPointsAfterAction(
  studentId: number,
  session: string,
): Promise<void> {
  try {
    await syncActivityPoints(studentId, session);
  } catch {
    // Don't throw - background sync
  }
  try {
    const { recalculateAndSaveGrade } = await import("@/lib/grades");
    await recalculateAndSaveGrade(studentId, session);
  } catch {
    // Grade sync is best-effort; trade center points already updated
  }
}
