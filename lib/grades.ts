// Grade Calculation Utilities
// Centralized logic for calculating and managing student grades

import { sql } from "@/lib/db";
import { getAttemptDisplayGrade } from "@/lib/attempt-grade-display";
import { calculateLetterGrade } from "@/lib/grade-utils";
import { classroomRawPointsToCanvasPercent } from "@/lib/classroom-points-grade-scale";
import { getRewardsPolicyForStudent } from "@/lib/rewards-policy.server";
import { classroomPointsSessionKeys } from "@/lib/trade-center-student-access";
import { expandSessionKeysForGradeLookup, normalizeSessionForStorage } from "@/lib/session-catalog";

export { calculateLetterGrade };

export type GradeCalculationOptions = {
  /** Student gradebook: only count attempts the instructor has finalized for release. */
  releasedAttemptsOnly?: boolean;
};

export interface GradeWeights {
  id: number;
  session: string;
  quiz_weight: number;
  homework_weight: number;
  midterm_weight: number;
  final_weight: number;
  attendance_weight: number;
  project_weight: number;
  classroom_weight: number;
  engagement_weight: number;
  total_weight: number;
  is_active: boolean;
}

export interface StudentGrade {
  id: number;
  student_id: number;
  session: string;
  quiz_score: number;
  homework_score: number;
  midterm_score: number;
  final_score: number;
  attendance_score: number;
  project_score: number;
  classroom_score: number;
  engagement_credits: number;
  quiz_contribution: number;
  homework_contribution: number;
  midterm_contribution: number;
  final_contribution: number;
  attendance_contribution: number;
  project_contribution: number;
  classroom_contribution: number;
  engagement_contribution: number;
  total_score: number;
  letter_grade: string | null;
  notes: string | null;
  is_locked: boolean;
  /** When true, recalculation keeps gradebook/manual attendance instead of QR/session %. */
  attendance_manual_override?: boolean;
}

export interface EngagementCredits {
  id: number;
  student_id: number;
  session: string;
  practice_hub_credits: number;
  playground_credits: number;
  lecture_reading_credits: number;
  syllabus_credits: number;
  course_evaluation_credits: number;
  total_credits: number;
}

// Grade rollover trade deductions (points deducted from 100% scale per category)
export interface GradeRolloverDeductions {
  quiz: number;
  homework: number;
  midterm: number;
  final: number;
  attendance: number;
  project: number;
  classroom: number;
  engagement: number;
}

export async function getGradeRolloverDeductions(
  studentId: number,
  session: string
): Promise<GradeRolloverDeductions> {
  const sessionForStorage = await normalizeSessionForStorage(session);
  try {
    const result = await sql`
      SELECT source_category, COALESCE(SUM(points_deducted), 0)::int as total
      FROM (
        SELECT source_category, points_deducted
        FROM grade_rollover_trades
        WHERE student_id = ${studentId} AND session = ${sessionForStorage}
        UNION ALL
        SELECT source_category, points_deducted
        FROM grade_extra_attempt_trades
        WHERE student_id = ${studentId} AND session = ${sessionForStorage}
      ) trade_deductions
      GROUP BY source_category
    `;
    const defaults: GradeRolloverDeductions = {
      quiz: 0,
      homework: 0,
      midterm: 0,
      final: 0,
      attendance: 0,
      project: 0,
      classroom: 0,
      engagement: 0,
    };
    for (const row of result) {
      const cat = row.source_category as keyof GradeRolloverDeductions;
      if (cat in defaults) {
        defaults[cat] = Number(row.total) || 0;
      }
    }
    return defaults;
  } catch (error) {
    console.error("[Grades] Error fetching rollover deductions:", error);
    return {
      quiz: 0,
      homework: 0,
      midterm: 0,
      final: 0,
      attendance: 0,
      project: 0,
      classroom: 0,
      engagement: 0,
    };
  }
}

export function courseGradeWeightSessionKey(courseId: number): string {
  return `course:${courseId}`
}

async function resolveCourseIdsForGradeSession(session: string): Promise<number[]> {
  if (session.startsWith("course:")) {
    const id = Number(session.slice("course:".length))
    return Number.isFinite(id) ? [id] : []
  }
  if (!session || session === "ALL") return []
  try {
    const rows = await sql`
      SELECT DISTINCT course_id
      FROM sessions
      WHERE TRIM(UPPER(code)) = TRIM(UPPER(${session}))
        AND course_id IS NOT NULL
    `
    return rows
      .map((row) => Number((row as { course_id?: number }).course_id))
      .filter((id) => Number.isFinite(id))
  } catch {
    return []
  }
}

/** Course-scoped row first (`course:{id}`), then the session key, then the legacy ALL fallback. */
export async function getGradeWeights(
  session: string,
  courseId?: number | null,
): Promise<GradeWeights | null> {
  try {
    const resolvedCourseIds =
      courseId != null && Number.isFinite(courseId)
        ? [Number(courseId)]
        : await resolveCourseIdsForGradeSession(session)

    for (const id of resolvedCourseIds) {
      const courseKey = courseGradeWeightSessionKey(id)
      const courseRows = await sql`
        SELECT * FROM grade_weights WHERE session = ${courseKey} LIMIT 1
      `
      if (courseRows[0]) return courseRows[0] as GradeWeights
    }

    const result = await sql`
      SELECT * FROM grade_weights
      WHERE session = ${session} OR session = 'ALL'
      ORDER BY CASE WHEN session = ${session} THEN 0 ELSE 1 END
      LIMIT 1
    `

    return (result[0] as GradeWeights | null) ?? null
  } catch (error) {
    console.error("Error fetching grade weights:", error)
    return null
  }
}

// Calculate weighted total score
export function calculateTotalScore(
  scores: {
    quiz: number;
    homework: number;
    midterm: number;
    final: number;
    attendance: number;
    project: number;
    classroom: number;
    engagement: number;
  },
  weights: GradeWeights
): {
  total: number;
  contributions: {
    quiz: number;
    homework: number;
    midterm: number;
    final: number;
    attendance: number;
    project: number;
    classroom: number;
    engagement: number;
  };
} {
  // Convert engagement credits to score (100 credits = 100%)
  const engagementScore = Math.min((scores.engagement / 100) * 100, 100);
  
  const contributions = {
    quiz: (scores.quiz * weights.quiz_weight) / 100,
    homework: (scores.homework * weights.homework_weight) / 100,
    midterm: (scores.midterm * weights.midterm_weight) / 100,
    final: (scores.final * weights.final_weight) / 100,
    attendance: (scores.attendance * weights.attendance_weight) / 100,
    project: (scores.project * weights.project_weight) / 100,
    classroom: (scores.classroom * weights.classroom_weight) / 100,
    engagement: (engagementScore * weights.engagement_weight) / 100,
  };
  
  const total =
    contributions.quiz +
    contributions.homework +
    contributions.midterm +
    contributions.final +
    contributions.attendance +
    contributions.project +
    contributions.classroom +
    contributions.engagement;
  
  return { total: Math.round(total * 100) / 100, contributions };
}

// Fetch and calculate quiz average for a student
export async function calculateQuizAverage(
  studentId: number,
  session?: string,
  options?: GradeCalculationOptions,
): Promise<number> {
  const releasedOnly = options?.releasedAttemptsOnly === true;
  try {
    // Per attempt: % = points / sum(question weights). Per quiz: **best** attempt only (MAX pct).
    // Category score: mean of those per-quiz bests (so retakes never pull a quiz below the student’s high score).
    let query;

    if (session) {
      query = sql`
        WITH scored AS (
          SELECT
            qa.quiz_id,
            CASE
              WHEN qa.total_questions = 100
                AND COALESCE(qa.total_score_override, qa.score)::DECIMAL <= 100
                THEN COALESCE(qa.total_score_override, qa.score)::DECIMAL
              WHEN COALESCE(
                (SELECT SUM(COALESCE(qq.max_points, qq.points, 1)) FROM quiz_questions qq WHERE qq.quiz_id = qa.quiz_id),
                0
              ) > 0 THEN (
                COALESCE(qa.total_score_override, qa.score)::DECIMAL / COALESCE(
                  (SELECT SUM(COALESCE(qq.max_points, qq.points, 1)) FROM quiz_questions qq WHERE qq.quiz_id = qa.quiz_id),
                  1
                )
              ) * 100
              ELSE 0::numeric
            END AS pct
          FROM quiz_attempts qa
          INNER JOIN quizzes q ON qa.quiz_id = q.id
          INNER JOIN students s ON qa.student_id = s.id
          WHERE qa.student_id = ${studentId}
            AND q.assessment_type = 'quiz'
            AND (q.counts_toward_course_grade IS DISTINCT FROM false)
            AND s.section = ${session}
            AND qa.completed_at IS NOT NULL
            AND (qa.is_final_grade IS DISTINCT FROM false)
            AND (${releasedOnly} = false OR qa.results_finalized_at IS NOT NULL)
        ),
        per_quiz AS (
          SELECT quiz_id, MAX(pct)::numeric AS quiz_pct
          FROM scored
          GROUP BY quiz_id
        )
        SELECT COALESCE(AVG(quiz_pct), 0)::numeric AS avg_score
        FROM per_quiz
      `;
    } else {
      query = sql`
        WITH scored AS (
          SELECT
            qa.quiz_id,
            CASE
              WHEN qa.total_questions = 100
                AND COALESCE(qa.total_score_override, qa.score)::DECIMAL <= 100
                THEN COALESCE(qa.total_score_override, qa.score)::DECIMAL
              WHEN COALESCE(
                (SELECT SUM(COALESCE(qq.max_points, qq.points, 1)) FROM quiz_questions qq WHERE qq.quiz_id = qa.quiz_id),
                0
              ) > 0 THEN (
                COALESCE(qa.total_score_override, qa.score)::DECIMAL / COALESCE(
                  (SELECT SUM(COALESCE(qq.max_points, qq.points, 1)) FROM quiz_questions qq WHERE qq.quiz_id = qa.quiz_id),
                  1
                )
              ) * 100
              ELSE 0::numeric
            END AS pct
          FROM quiz_attempts qa
          INNER JOIN quizzes q ON qa.quiz_id = q.id
          INNER JOIN students s ON qa.student_id = s.id
          WHERE qa.student_id = ${studentId}
            AND q.assessment_type = 'quiz'
            AND (q.counts_toward_course_grade IS DISTINCT FROM false)
            AND qa.completed_at IS NOT NULL
            AND (qa.is_final_grade IS DISTINCT FROM false)
            AND (${releasedOnly} = false OR qa.results_finalized_at IS NOT NULL)
        ),
        per_quiz AS (
          SELECT quiz_id, MAX(pct)::numeric AS quiz_pct
          FROM scored
          GROUP BY quiz_id
        )
        SELECT COALESCE(AVG(quiz_pct), 0)::numeric AS avg_score
        FROM per_quiz
      `;
    }

    const result = await query;
    const avgScore = Number(result[0]?.avg_score) || 0;

    return Math.min(avgScore, 100); // Cap at 100%
  } catch (error) {
    console.error(`[Grades] Error calculating quiz average for student ${studentId}:`, error);
    return 0;
  }
}

// Fetch and calculate homework average for a student
// Same as quizzes: **best** attempt % per homework (quiz_id), then mean across homeworks.
// `is_final_grade IS DISTINCT FROM false` matches quiz grading (counts legacy null finals).
export async function calculateHomeworkAverage(
  studentId: number,
  session?: string,
  options?: GradeCalculationOptions,
): Promise<number> {
  const releasedOnly = options?.releasedAttemptsOnly === true;
  try {
    let query;

    if (session) {
      query = sql`
        WITH scored AS (
          SELECT
            qa.quiz_id,
            CASE
              WHEN qa.total_questions = 100
                AND COALESCE(qa.total_score_override, qa.score)::DECIMAL <= 100
                THEN COALESCE(qa.total_score_override, qa.score)::DECIMAL
              WHEN COALESCE(
                (SELECT SUM(COALESCE(qq.max_points, qq.points, 1)) FROM quiz_questions qq WHERE qq.quiz_id = qa.quiz_id),
                0
              ) > 0 THEN (
                COALESCE(qa.total_score_override, qa.score)::DECIMAL / COALESCE(
                  (SELECT SUM(COALESCE(qq.max_points, qq.points, 1)) FROM quiz_questions qq WHERE qq.quiz_id = qa.quiz_id),
                  1
                )
              ) * 100
              ELSE 0::numeric
            END AS pct
          FROM quiz_attempts qa
          INNER JOIN quizzes q ON qa.quiz_id = q.id
          INNER JOIN students s ON qa.student_id = s.id
          WHERE qa.student_id = ${studentId}
            AND q.assessment_type = 'homework'
            AND (q.counts_toward_course_grade IS DISTINCT FROM false)
            AND s.section = ${session}
            AND qa.completed_at IS NOT NULL
            AND (qa.is_final_grade IS DISTINCT FROM false)
            AND (${releasedOnly} = false OR qa.results_finalized_at IS NOT NULL)
        ),
        per_assignment AS (
          SELECT quiz_id, MAX(pct)::numeric AS assignment_pct
          FROM scored
          GROUP BY quiz_id
        )
        SELECT COALESCE(AVG(assignment_pct), 0)::numeric AS avg_score
        FROM per_assignment
      `;
    } else {
      query = sql`
        WITH scored AS (
          SELECT
            qa.quiz_id,
            CASE
              WHEN qa.total_questions = 100
                AND COALESCE(qa.total_score_override, qa.score)::DECIMAL <= 100
                THEN COALESCE(qa.total_score_override, qa.score)::DECIMAL
              WHEN COALESCE(
                (SELECT SUM(COALESCE(qq.max_points, qq.points, 1)) FROM quiz_questions qq WHERE qq.quiz_id = qa.quiz_id),
                0
              ) > 0 THEN (
                COALESCE(qa.total_score_override, qa.score)::DECIMAL / COALESCE(
                  (SELECT SUM(COALESCE(qq.max_points, qq.points, 1)) FROM quiz_questions qq WHERE qq.quiz_id = qa.quiz_id),
                  1
                )
              ) * 100
              ELSE 0::numeric
            END AS pct
          FROM quiz_attempts qa
          INNER JOIN quizzes q ON qa.quiz_id = q.id
          INNER JOIN students s ON qa.student_id = s.id
          WHERE qa.student_id = ${studentId}
            AND q.assessment_type = 'homework'
            AND (q.counts_toward_course_grade IS DISTINCT FROM false)
            AND qa.completed_at IS NOT NULL
            AND (qa.is_final_grade IS DISTINCT FROM false)
            AND (${releasedOnly} = false OR qa.results_finalized_at IS NOT NULL)
        ),
        per_assignment AS (
          SELECT quiz_id, MAX(pct)::numeric AS assignment_pct
          FROM scored
          GROUP BY quiz_id
        )
        SELECT COALESCE(AVG(assignment_pct), 0)::numeric AS avg_score
        FROM per_assignment
      `;
    }

    const result = await query;
    const avgScore = Number(result[0]?.avg_score) || 0;

    return Math.min(avgScore, 100); // Cap at 100%
  } catch (error) {
    console.error(`[Grades] Error calculating homework average for student ${studentId}:`, error);
    return 0;
  }
}

/**
 * Mean of **best** display % per quiz — same basis as instructor/student results and Canvas
 * (`getAttemptDisplayGrade`). Avoids treating `quiz_attempts.score` as 0–100 when it is still raw
 * points on section-weighted exams (which produced ~22% instead of ~70%).
 */
async function averageBestCategoryPercentFromAttempts(
  studentId: number,
  session: string | undefined,
  kind: "midterm" | "final",
  options?: GradeCalculationOptions,
): Promise<number> {
  const releasedOnly = options?.releasedAttemptsOnly === true;
  // Use only scalar bindings — Neon's sql tag does not support nested sql`...` fragments
  // (they emit invalid SQL / wrong parameter boundaries).
  const kindKey = kind === "final" ? "final" : "midterm";
  const sessionTrim =
    session != null && String(session).trim() !== ""
      ? String(session).trim()
      : "";

  const rows = await sql`
    SELECT qa.id AS attempt_id, qa.quiz_id
    FROM quiz_attempts qa
    INNER JOIN quizzes q ON qa.quiz_id = q.id
    INNER JOIN students s ON s.id = qa.student_id
    WHERE qa.student_id = ${studentId}
      AND (
        (${kindKey} = 'final' AND LOWER(TRIM(COALESCE(q.assessment_type::text, ''))) IN ('final', 'finals', 'final_exam'))
        OR
        (${kindKey} = 'midterm' AND (q.assessment_type = 'mid_semester' OR q.assessment_type = 'midsem'))
      )
      AND (q.counts_toward_course_grade IS DISTINCT FROM false)
      AND qa.completed_at IS NOT NULL
      AND (qa.is_final_grade IS DISTINCT FROM false)
      AND (${releasedOnly} = false OR qa.results_finalized_at IS NOT NULL)
      AND (
        ${sessionTrim} = ''
        OR TRIM(s.section) = TRIM(${sessionTrim})
        OR EXISTS (
          SELECT 1 FROM sessions sess
          WHERE sess.id = s.session_id AND TRIM(sess.code) = TRIM(${sessionTrim})
        )
      )
  `;

  const byQuiz = new Map<number, number[]>();
  for (const r of rows as { attempt_id: number; quiz_id: number }[]) {
    const qid = Number(r.quiz_id);
    const aid = Number(r.attempt_id);
    if (!Number.isFinite(qid) || !Number.isFinite(aid)) continue;
    const arr = byQuiz.get(qid) ?? [];
    arr.push(aid);
    byQuiz.set(qid, arr);
  }

  const perQuizBests: number[] = [];
  for (const [, attemptIds] of byQuiz) {
    let best = 0;
    for (const aid of attemptIds) {
      const g = await getAttemptDisplayGrade(String(aid));
      if (g != null && Number.isFinite(g.percentage) && g.percentage > best) {
        best = g.percentage;
      }
    }
    perQuizBests.push(best);
  }

  if (perQuizBests.length === 0) return 0;
  const avg =
    perQuizBests.reduce((a, b) => a + b, 0) / perQuizBests.length;
  return Math.min(100, Math.round(avg * 100) / 100);
}

// Fetch midterm category score: **best** attempt % per mid_semester assessment, then mean if several exist.
export async function getMidtermScore(
  studentId: number,
  session?: string,
  options?: GradeCalculationOptions,
): Promise<number> {
  try {
    return await averageBestCategoryPercentFromAttempts(
      studentId,
      session,
      "midterm",
      options,
    );
  } catch (error) {
    console.error("Error fetching midterm score:", error);
    return 0;
  }
}

// Fetch final category score: **best** attempt % per final-type quiz where `counts_toward_course_grade` is on; mean across those exams.
export async function getFinalScore(
  studentId: number,
  session?: string,
  options?: GradeCalculationOptions,
): Promise<number> {
  try {
    return await averageBestCategoryPercentFromAttempts(
      studentId,
      session,
      "final",
      options,
    );
  } catch (error) {
    console.error("Error fetching final score:", error);
    return 0;
  }
}

// Fetch attendance percentage for a student (credit-weighted from points on sessions scored so far)
export async function getAttendancePercentage(
  studentId: number,
  session?: string
): Promise<number> {
  try {
    const { getStudentAttendanceSoFar } = await import("@/lib/attendance-percentage")
    const stats = await getStudentAttendanceSoFar(studentId, session)
    return stats.percentage
  } catch (error) {
    console.error("Error fetching attendance percentage:", error);
    return 0;
  }
}

/**
 * Roster fields used to build `student_grades.session` lookup keys for Canvas export.
 * Merges keys from `sessions.code`, denormalized `students.section`, and `students.canvas_section` so rows
 * seeded with the long Canvas section string still match when the export uses the short catalog code first.
 */
export type AttendanceCanvasExportRosterContext = {
  sessionCode: string | null | undefined;
  studentSection: string | null | undefined;
  rosterSection: string | null | undefined;
  canvasSection: string | null | undefined;
  /**
   * When non-empty (section-scoped export), aggregate grades across all `students` rows that share the same
   * SIS User ID or school `student_id` in that section. Deduped roster rows prefer the PK that has quiz
   * attempts; manually seeded `student_grades` may still be attached to the sibling row.
   */
  sectionVariantsForSiblingMerge: string[];
};

function clampAttendanceForExport(n: number): number {
  return Math.min(Math.max(Number(n) || 0, 0), 100);
}

async function gatherAttendanceGradeSessionKeys(
  ctx: AttendanceCanvasExportRosterContext
): Promise<string[]> {
  const fragments: string[] = [];
  for (const v of [ctx.sessionCode, ctx.studentSection, ctx.rosterSection, ctx.canvasSection]) {
    if (v != null && String(v).trim() !== "") fragments.push(String(v).trim());
  }
  if (fragments.length === 0) return [];
  const expanded = await Promise.all(fragments.map((f) => expandSessionKeysForGradeLookup(f)));
  const keys = new Set<string>();
  for (const arr of expanded) {
    for (const k of arr) {
      if (k) keys.add(k);
    }
  }
  return [...keys];
}

/**
 * Max attendance % across `student_grades` for the given students.
 * Always includes `session = 'ALL'` alongside catalog keys so a seeded course row (`ELEG1304P01`) that is still
 * 0 does not hide a manually populated `ALL` row (common when imports only touch one of the two).
 */
async function maxAttendanceGradeForStudents(
  studentIds: number[],
  sessionKeys: string[]
): Promise<number | null> {
  if (studentIds.length === 0) return null;
  const keys =
    sessionKeys.length > 0
      ? [...new Set([...sessionKeys.map((k) => String(k).trim()).filter(Boolean), "ALL"])]
      : ["ALL"];
  const row = await sql`
    SELECT MAX(attendance_score::numeric) AS mx
    FROM student_grades
    WHERE student_id = ANY(${studentIds}::int[])
      AND TRIM(session) = ANY(${keys}::text[])
  `;
  if (row.length > 0 && row[0].mx != null) return Number(row[0].mx);
  return null;
}

async function resolveSiblingStudentIdsForAttendanceExport(
  anchorStudentId: number,
  sectionVariants: string[]
): Promise<number[]> {
  if (sectionVariants.length === 0) return [anchorStudentId];
  const rows = await sql`
    WITH anchor AS (
      SELECT
        id,
        TRIM(COALESCE(sis_user_id::text, '')) AS su,
        TRIM(COALESCE(student_id::text, '')) AS school
      FROM students
      WHERE id = ${anchorStudentId}
    )
    SELECT s.id
    FROM students s
    CROSS JOIN anchor a
    WHERE (
        s.id = a.id
        OR (
          a.su <> ''
          AND TRIM(COALESCE(s.sis_user_id::text, '')) = a.su
        )
        OR (
          a.school <> ''
          AND TRIM(COALESCE(s.student_id::text, '')) = a.school
        )
      )
      AND (
        TRIM(s.section) = ANY(${sectionVariants}::text[])
        OR EXISTS (
          SELECT 1 FROM sessions sess
          WHERE sess.id = s.session_id
            AND TRIM(sess.code) = ANY(${sectionVariants}::text[])
        )
      )
  `;
  const ids = (rows as { id: number }[]).map((r) => Number(r.id)).filter((n) => Number.isFinite(n));
  return ids.length > 0 ? ids : [anchorStudentId];
}

/** One `student_grades` row used to override Canvas export with instructor / Grades Management values. */
export type StudentGradesCanvasSnapshot = {
  quiz_score: number;
  homework_score: number;
  midterm_score: number;
  final_score: number;
  project_score: number;
  classroom_score: number;
  engagement_credits: number;
  attendance_score: number;
  attendance_manual_override: boolean;
};

/**
 * Best matching `student_grades` row for Canvas export (same session key expansion + sibling merge as attendance export).
 * When present, category columns in the CSV should use these values so instructor edits in Grades Management win.
 */
export async function fetchStudentGradesSnapshotForCanvasExport(
  studentId: number,
  rosterCtx: AttendanceCanvasExportRosterContext | null,
  sessionCodeFallback: string | null | undefined,
  sectionVariantsForOrder: string[],
): Promise<StudentGradesCanvasSnapshot | null> {
  try {
    let keys: string[] = [];
    if (rosterCtx) {
      keys = await gatherAttendanceGradeSessionKeys(rosterCtx);
    }
    if (keys.length === 0 && sessionCodeFallback && String(sessionCodeFallback).trim()) {
      keys = await expandSessionKeysForGradeLookup(String(sessionCodeFallback).trim());
    }
    const keysSet = new Set(keys.map((k) => String(k).trim()).filter(Boolean));
    keysSet.add("ALL");
    const keysForSql = [...keysSet].filter(Boolean);
    if (keysForSql.length === 0) {
      keysForSql.push("ALL");
    }

    const variants = rosterCtx?.sectionVariantsForSiblingMerge ?? [];
    const studentIds =
      variants.length > 0
        ? await resolveSiblingStudentIdsForAttendanceExport(studentId, variants)
        : [studentId];

    const preferredTrim =
      (sectionVariantsForOrder[0] && String(sectionVariantsForOrder[0]).trim()) ||
      keysForSql.find((k) => String(k).toUpperCase() !== "ALL") ||
      "";

    let rows: Record<string, unknown>[];
    if (preferredTrim) {
      rows = await sql`
        SELECT
          COALESCE(sg.quiz_score::float, 0) AS quiz_score,
          COALESCE(sg.homework_score::float, 0) AS homework_score,
          COALESCE(sg.midterm_score::float, 0) AS midterm_score,
          COALESCE(sg.final_score::float, 0) AS final_score,
          COALESCE(sg.project_score::float, 0) AS project_score,
          COALESCE(sg.classroom_score::float, 0) AS classroom_score,
          COALESCE(sg.engagement_credits::float, 0) AS engagement_credits,
          COALESCE(sg.attendance_score::float, 0) AS attendance_score,
          COALESCE(sg.attendance_manual_override, false) AS attendance_manual_override
        FROM student_grades sg
        WHERE sg.student_id = ANY(${studentIds}::int[])
          AND TRIM(sg.session) = ANY(${keysForSql}::text[])
        ORDER BY
          CASE
            WHEN TRIM(sg.session) = TRIM(${preferredTrim}) THEN 0
            WHEN TRIM(sg.session) = 'ALL' THEN 2
            ELSE 1
          END,
          sg.id DESC
        LIMIT 1
      `;
    } else {
      rows = await sql`
        SELECT
          COALESCE(sg.quiz_score::float, 0) AS quiz_score,
          COALESCE(sg.homework_score::float, 0) AS homework_score,
          COALESCE(sg.midterm_score::float, 0) AS midterm_score,
          COALESCE(sg.final_score::float, 0) AS final_score,
          COALESCE(sg.project_score::float, 0) AS project_score,
          COALESCE(sg.classroom_score::float, 0) AS classroom_score,
          COALESCE(sg.engagement_credits::float, 0) AS engagement_credits,
          COALESCE(sg.attendance_score::float, 0) AS attendance_score,
          COALESCE(sg.attendance_manual_override, false) AS attendance_manual_override
        FROM student_grades sg
        WHERE sg.student_id = ANY(${studentIds}::int[])
          AND TRIM(sg.session) = ANY(${keysForSql}::text[])
        ORDER BY
          CASE WHEN TRIM(sg.session) = 'ALL' THEN 1 ELSE 0 END,
          sg.id DESC
        LIMIT 1
      `;
    }

    if (!rows.length) return null;
    const r = rows[0] as Record<string, unknown>;
    return {
      quiz_score: Number(r.quiz_score) || 0,
      homework_score: Number(r.homework_score) || 0,
      midterm_score: Number(r.midterm_score) || 0,
      final_score: Number(r.final_score) || 0,
      project_score: Number(r.project_score) || 0,
      classroom_score: Number(r.classroom_score) || 0,
      engagement_credits: Number(r.engagement_credits) || 0,
      attendance_score: Number(r.attendance_score) || 0,
      attendance_manual_override: r.attendance_manual_override === true,
    };
  } catch (error) {
    console.error("[Grades] fetchStudentGradesSnapshotForCanvasExport:", error);
    return null;
  }
}

/** Map `quizzes.assessment_type` to the category % stored on `student_grades` for Canvas overrides. */
export function getCanvasCategoryPercentFromSnapshot(
  snap: StudentGradesCanvasSnapshot,
  assessmentType: string | null | undefined,
): number {
  const t = String(assessmentType ?? "quiz").toLowerCase();
  let v = snap.quiz_score;
  if (t === "homework") v = snap.homework_score;
  else if (t === "mid_semester") v = snap.midterm_score;
  else if (t === "final") v = snap.final_score;
  return Math.min(100, Math.max(0, Number(v) || 0));
}

/**
 * Attendance % for Canvas export: **only** `student_grades.attendance_score` (manual / import / gradebook).
 * Does not use QR `attendance_records`.
 *
 * - Expands session keys from every roster fragment (short code + long Canvas section + denormalized section).
 * - If no row matches those keys, falls back to `session = 'ALL'`.
 * - For section-scoped exports, merges scores across duplicate `students` rows (same SIS / school id).
 */
export async function getAttendanceForCanvasExport(
  studentId: number,
  sessionFallback?: string | null,
  rosterCtx?: AttendanceCanvasExportRosterContext | null
): Promise<number> {
  try {
    let keys: string[] = [];
    if (rosterCtx) {
      keys = await gatherAttendanceGradeSessionKeys(rosterCtx);
    }
    if (keys.length === 0 && sessionFallback && String(sessionFallback).trim()) {
      keys = await expandSessionKeysForGradeLookup(String(sessionFallback).trim());
    }
    if (keys.length === 0 && !rosterCtx) {
      return 0;
    }

    const variants = rosterCtx?.sectionVariantsForSiblingMerge ?? [];
    const studentIdsForGradeLookup =
      variants.length > 0
        ? await resolveSiblingStudentIdsForAttendanceExport(studentId, variants)
        : [studentId];

    const mx = await maxAttendanceGradeForStudents(
      studentIdsForGradeLookup,
      keys.length > 0 ? keys : []
    );
    if (mx != null) return clampAttendanceForExport(mx);
  } catch (error) {
    console.error("Error fetching attendance from student_grades for export:", error);
  }
  return 0;
}

// Fetch project score for a student (sum of project scores; per-member overrides replace group total for that project)
export async function getProjectScore(
  studentId: number,
  session?: string
): Promise<number> {
  try {
    const sessionForStorage =
      session && String(session).trim()
        ? await normalizeSessionForStorage(String(session).trim())
        : null;

    const result = sessionForStorage
      ? await sql`
          SELECT COALESCE(SUM(COALESCE(pmo.score_0_50, ps.total_score)::numeric), 0) as total_project_score
          FROM projects p
          JOIN project_scores ps ON p.id = ps.project_id
          JOIN groups g ON p.group_id = g.id
          JOIN group_members gm ON g.id = gm.group_id
          LEFT JOIN project_member_score_overrides pmo
            ON pmo.project_id = p.id AND pmo.student_id = gm.student_id
          WHERE gm.student_id = ${studentId}
            AND g.session = ${sessionForStorage}
        `
      : await sql`
          SELECT COALESCE(SUM(COALESCE(pmo.score_0_50, ps.total_score)::numeric), 0) as total_project_score
          FROM projects p
          JOIN project_scores ps ON p.id = ps.project_id
          JOIN groups g ON p.group_id = g.id
          JOIN group_members gm ON g.id = gm.group_id
          LEFT JOIN project_member_score_overrides pmo
            ON pmo.project_id = p.id AND pmo.student_id = gm.student_id
          WHERE gm.student_id = ${studentId}
        `;

    const totalScore = Number(result[0]?.total_project_score) || 0;

    // Convert to percentage (assuming max project score is 50, scale to 100)
    return Math.min((totalScore / 50) * 100, 100);
  } catch (error) {
    console.error("Error fetching project score:", error);
    return 0;
  }
}

// Fetch classroom points total for a student (returns 0–100 Canvas/category %)
export async function getClassroomPoints(
  studentId: number,
  session?: string
): Promise<number> {
  try {
    let totalPoints = 0

    if (session && String(session).trim()) {
      const keys = await classroomPointsSessionKeys(String(session).trim())
      const result = await sql`
        SELECT COALESCE(SUM(points), 0) as total_points
        FROM classroom_points
        WHERE student_id = ${studentId}
          AND (status = 'approved' OR status IS NULL)
          AND session = ANY(${keys}::text[])
      `
      totalPoints = Number(result[0]?.total_points) || 0
    } else {
      const result = await sql`
        SELECT COALESCE(SUM(points), 0) as total_points
        FROM classroom_points
        WHERE student_id = ${studentId}
          AND (status = 'approved' OR status IS NULL)
      `
      totalPoints = Number(result[0]?.total_points) || 0
    }

    const policy = await getRewardsPolicyForStudent(studentId);
    /* Canvas / gradebook: 10-pt category slice → 0–100% (see classroomTenPointSliceToCanvasPercent). */
    return classroomRawPointsToCanvasPercent(totalPoints, policy.points_for_full_grade);
  } catch (error) {
    console.error("Error fetching classroom points:", error);
    return 0;
  }
}

// Calculate Engagement Credits from Practice Hub, Playground, Lecture Reading, and Syllabus review
export async function calculateEngagementCredits(
  studentId: number,
  session?: string
): Promise<EngagementCredits> {
  const sessionToUse = session || "ALL";

  let syllabusCredits = 0;
  try {
    const { getSyllabusEngagementCredits } = await import("@/lib/syllabus/syllabus-view-points");
    syllabusCredits = await getSyllabusEngagementCredits(studentId);
  } catch (error) {
    console.error("[Grades] Error fetching syllabus engagement credits:", error);
  }

  // Always calculate from activity sources (never short-circuit on engagement_credits row —
  // that table is also written by recalculate and trade routes, so reading it here caused stale zeros).
  let practiceHubCredits = 0;
  let playgroundCredits = 0;
  let lectureReadingCredits = 0;

  try {
    // Practice Hub credits (based on actual scores and performance)
    try {
      const practiceResult = await sql`
        SELECT
          COUNT(*)::int AS attempt_count,
          AVG(score_percentage)::float AS avg_score,
          SUM(score_percentage)::float AS total_score_points
        FROM (
          SELECT score_percentage
          FROM practice_attempts
          WHERE student_id = ${studentId}
            AND completed_at IS NOT NULL
          UNION ALL
          SELECT score_percentage
          FROM lecture_sample_practice_attempts
          WHERE student_id = ${studentId}
        ) combined
      `;
      
      const attemptCount = Number(practiceResult[0]?.attempt_count) || 0;
      const avgScore = Number(practiceResult[0]?.avg_score) || 0;
      const totalScorePoints = Number(practiceResult[0]?.total_score_points) || 0;
      
      // Calculate credits based on:
      // 1. Participation: 0.5 points per completed attempt (max 20 attempts = 10 points)
      // 2. Performance: Average score * 0.4 (max 40 points for 100% avg)
      // Total max: 50 points
      const participationCredits = Math.min(attemptCount * 0.5, 10);
      const performanceCredits = (avgScore / 100) * 40;
      practiceHubCredits = Math.min(participationCredits + performanceCredits, 50);
    } catch (error) {
      console.error("[Grades] Error calculating practice hub credits:", error);
      practiceHubCredits = 0;
    }
    
    // Playground credits (based on actual score points accumulated)
    try {
      // First get the student_id string from students table
      const studentResult = await sql`
        SELECT student_id
        FROM students
        WHERE id = ${studentId}
      `;
      
      if (studentResult.length > 0 && studentResult[0]?.student_id) {
        const studentIdString = studentResult[0].student_id;
        const playgroundResult = await sql`
          SELECT 
            COUNT(*) as session_count,
            SUM(score) as total_points,
            AVG(score) as avg_score_per_session,
            SUM(correct_answers) as total_correct,
            SUM(questions_answered) as total_questions
          FROM playground_results
          WHERE student_id = ${studentIdString}
            AND completed_at IS NOT NULL
        `;
        
        const sessionCount = Number(playgroundResult[0]?.session_count) || 0;
        const totalPoints = Number(playgroundResult[0]?.total_points) || 0;
        const avgScorePerSession = Number(playgroundResult[0]?.avg_score_per_session) || 0;
        const totalCorrect = Number(playgroundResult[0]?.total_correct) || 0;
        const totalQuestions = Number(playgroundResult[0]?.total_questions) || 0;
        
        // Calculate credits based on:
        // 1. Participation: 0.3 points per completed session (max 20 sessions = 6 points)
        // 2. Performance: Total points / 10 (max 24 points for 240+ total points)
        // Total max: 30 points
        const participationCredits = Math.min(sessionCount * 0.3, 6);
        const performanceCredits = Math.min(totalPoints / 10, 24);
        playgroundCredits = Math.min(participationCredits + performanceCredits, 30);
      }
    } catch (error) {
      console.error("[Grades] Error calculating playground credits:", error);
      playgroundCredits = 0;
    }
    
    // Lecture Reading credits: slide-open ratio sum (max 20)
    try {
      const { calculateLectureSlideViewRatioSum } = await import("@/lib/lecture-slide-view-scoring");
      const { calculateGradebookReadingCredits } = await import("@/lib/engagement-points-system");
      const ratioSum = await calculateLectureSlideViewRatioSum(studentId);
      lectureReadingCredits = calculateGradebookReadingCredits(ratioSum);
    } catch (error) {
      console.error("[Grades] Error calculating lecture reading credits:", error);
      lectureReadingCredits = 0;
    }
    
    const activityCredits = practiceHubCredits + playgroundCredits + lectureReadingCredits;
    const { getApprovedCourseEvaluationCredits, COURSE_EVALUATION_ENGAGEMENT_CREDITS } =
      await import("@/lib/course-evaluation-engagement");
    const courseEvaluationCredits = await getApprovedCourseEvaluationCredits(studentId, sessionToUse);
    const activityCap = Math.max(0, 100 - COURSE_EVALUATION_ENGAGEMENT_CREDITS);
    const cappedActivity = Math.min(activityCredits + syllabusCredits, activityCap);
    let totalCredits = Math.min(cappedActivity + courseEvaluationCredits, 100);

    // Preserve Trade Center EC already applied (stored total may exceed fresh auto calc until next activity).
    try {
      const existing = await sql`
        SELECT total_credits FROM engagement_credits
        WHERE student_id = ${studentId} AND session = ${sessionToUse}
        LIMIT 1
      `;
      if (existing.length > 0) {
        const prev = Number(existing[0].total_credits) || 0;
        totalCredits = Math.min(Math.max(totalCredits, prev), 100);
      }
    } catch {
      /* non-fatal */
    }
    
    return {
      id: 0, // Will be set when saved
      student_id: studentId,
      session: session || "ALL",
      practice_hub_credits: Math.round(practiceHubCredits * 100) / 100,
      playground_credits: Math.round(playgroundCredits * 100) / 100,
      lecture_reading_credits: Math.round(lectureReadingCredits * 100) / 100,
      syllabus_credits: Math.round(syllabusCredits * 100) / 100,
      course_evaluation_credits: Math.round(courseEvaluationCredits * 100) / 100,
      total_credits: Math.round(totalCredits * 100) / 100,
    };
  } catch (error) {
    console.error("[Grades] Error calculating engagement credits:", error);
    return {
      id: 0,
      student_id: studentId,
      session: session || "ALL",
      practice_hub_credits: 0,
      playground_credits: 0,
      lecture_reading_credits: 0,
      syllabus_credits: syllabusCredits,
      course_evaluation_credits: 0,
      total_credits: Math.round(syllabusCredits * 100) / 100,
    };
  }
}

// Recalculate and save student grade
export async function recalculateAndSaveGrade(
  studentId: number,
  session: string
): Promise<StudentGrade | null> {
  try {
    // Get weights
    const weights = await getGradeWeights(session);
    if (!weights) {
      console.error(`[Grades] Grade weights not found for session ${session}`);
      throw new Error("Grade weights not found");
    }

    const sessionForStorage = await normalizeSessionForStorage(session);
    const existingGradeRows = await sql`
      SELECT attendance_score, attendance_manual_override
      FROM student_grades
      WHERE student_id = ${studentId} AND session = ${sessionForStorage}
      LIMIT 1
    `;
    const existingGrade = existingGradeRows[0] as
      | { attendance_score: unknown; attendance_manual_override: boolean | null }
      | undefined;
    const attendanceManual = existingGrade?.attendance_manual_override === true;
    const storedAttendance =
      existingGrade != null && existingGrade.attendance_score != null
        ? Number(existingGrade.attendance_score)
        : NaN;

    // Fetch all category scores (gradebook attendance must not be replaced by QR % when manual)
    const [
      quizScore,
      homeworkScore,
      midtermScore,
      finalScore,
      attendanceScore,
      projectScore,
      classroomScore,
      engagementData,
    ] = await Promise.all([
      calculateQuizAverage(studentId, session),
      calculateHomeworkAverage(studentId, session),
      getMidtermScore(studentId, session),
      getFinalScore(studentId, session),
      attendanceManual && Number.isFinite(storedAttendance)
        ? Promise.resolve(storedAttendance)
        : getAttendancePercentage(studentId, session),
      getProjectScore(studentId, session),
      getClassroomPoints(studentId, session),
      calculateEngagementCredits(studentId, session),
    ]);

    // Apply grade rollover trade deductions (points traded for rollover extensions)
    const deductions = await getGradeRolloverDeductions(studentId, session);
    const applyDeduction = (raw: number, cat: keyof GradeRolloverDeductions) =>
      Math.max(0, (raw || 0) - (deductions[cat] || 0));

    const quizScoreAdj = applyDeduction(quizScore, "quiz");
    const homeworkScoreAdj = applyDeduction(homeworkScore, "homework");
    const midtermScoreAdj = applyDeduction(midtermScore, "midterm");
    const finalScoreAdj = applyDeduction(finalScore, "final");
    const attendanceScoreAdj = applyDeduction(attendanceScore, "attendance");
    const projectScoreAdj = applyDeduction(projectScore, "project");
    const classroomScoreAdj = applyDeduction(classroomScore, "classroom");
    const engagementScoreAdj = applyDeduction(engagementData.total_credits, "engagement");

    // Calculate total score (using adjusted scores after deductions)
    const { total, contributions } = calculateTotalScore(
      {
        quiz: quizScoreAdj,
        homework: homeworkScoreAdj,
        midterm: midtermScoreAdj,
        final: finalScoreAdj,
        attendance: attendanceScoreAdj,
        project: projectScoreAdj,
        classroom: classroomScoreAdj,
        engagement: engagementScoreAdj,
      },
      weights
    );
    
    const letterGrade = calculateLetterGrade(total);

    // Save or update engagement credits
    await sql`
      INSERT INTO engagement_credits (
        student_id, session,
        practice_hub_credits, playground_credits, lecture_reading_credits, total_credits
      )
      VALUES (
        ${studentId}, ${sessionForStorage},
        ${engagementData.practice_hub_credits}, ${engagementData.playground_credits},
        ${engagementData.lecture_reading_credits}, ${engagementData.total_credits}
      )
      ON CONFLICT (student_id, session)
      DO UPDATE SET
        practice_hub_credits = EXCLUDED.practice_hub_credits,
        playground_credits = EXCLUDED.playground_credits,
        lecture_reading_credits = EXCLUDED.lecture_reading_credits,
        total_credits = EXCLUDED.total_credits,
        last_updated = CURRENT_TIMESTAMP
    `;

    // Save or update student grade (session must satisfy DB session check after widen-grades migration)
    const result = await sql`
      INSERT INTO student_grades (
        student_id, session,
        quiz_score, homework_score, midterm_score, final_score,
        attendance_score, project_score, classroom_score, engagement_credits,
        quiz_contribution, homework_contribution, midterm_contribution, final_contribution,
        attendance_contribution, project_contribution, classroom_contribution, engagement_contribution,
        total_score, letter_grade,
        attendance_manual_override
      )
      VALUES (
        ${studentId}, ${sessionForStorage},
        ${quizScoreAdj}, ${homeworkScoreAdj}, ${midtermScoreAdj}, ${finalScoreAdj},
        ${attendanceScoreAdj}, ${projectScoreAdj}, ${classroomScoreAdj}, ${engagementScoreAdj},
        ${contributions.quiz}, ${contributions.homework}, ${contributions.midterm}, ${contributions.final},
        ${contributions.attendance}, ${contributions.project}, ${contributions.classroom}, ${contributions.engagement},
        ${total}, ${letterGrade},
        ${attendanceManual}
      )
      ON CONFLICT (student_id, session)
      DO UPDATE SET
        quiz_score = EXCLUDED.quiz_score,
        homework_score = EXCLUDED.homework_score,
        midterm_score = EXCLUDED.midterm_score,
        final_score = EXCLUDED.final_score,
        attendance_score = EXCLUDED.attendance_score,
        project_score = EXCLUDED.project_score,
        classroom_score = EXCLUDED.classroom_score,
        engagement_credits = EXCLUDED.engagement_credits,
        quiz_contribution = EXCLUDED.quiz_contribution,
        homework_contribution = EXCLUDED.homework_contribution,
        midterm_contribution = EXCLUDED.midterm_contribution,
        final_contribution = EXCLUDED.final_contribution,
        attendance_contribution = EXCLUDED.attendance_contribution,
        project_contribution = EXCLUDED.project_contribution,
        classroom_contribution = EXCLUDED.classroom_contribution,
        engagement_contribution = EXCLUDED.engagement_contribution,
        total_score = EXCLUDED.total_score,
        letter_grade = EXCLUDED.letter_grade,
        attendance_manual_override = EXCLUDED.attendance_manual_override,
        last_calculated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    
    return result[0] as StudentGrade | null;
  } catch (error) {
    console.error("Error recalculating student grade:", error);
    return null;
  }
}

/**
 * After `quiz_attempts` score or overrides change, upsert the student's `student_grades` row
 * so the instructor gradebook and course total stay in sync.
 */
export async function syncGradebookForAttempt(attemptId: number): Promise<void> {
  try {
    const rows = await sql`
      SELECT qa.student_id, s.section
      FROM quiz_attempts qa
      INNER JOIN students s ON s.id = qa.student_id
      WHERE qa.id = ${attemptId}
      LIMIT 1
    `;
    const row = rows[0] as { student_id: number; section: string | null } | undefined;
    if (!row) return;
    const studentId = Number(row.student_id);
    if (!Number.isFinite(studentId) || studentId <= 0) return;
    const section =
      row.section != null && String(row.section).trim() !== ""
        ? String(row.section).trim()
        : "ALL";
    await recalculateAndSaveGrade(studentId, section);
  } catch (e) {
    console.error("[Grades] syncGradebookForAttempt failed", { attemptId, e });
  }
}

/** After attendance is marked or edited, refresh `student_grades` (unless manual override is set). */
export async function syncGradebookForAttendanceMark(
  studentId: number,
  section: string | null | undefined,
): Promise<void> {
  try {
    const trimmed = section != null ? String(section).trim() : "";
    if (!trimmed) return;
    await recalculateAndSaveGrade(studentId, trimmed);
  } catch (e) {
    console.error("[Grades] syncGradebookForAttendanceMark failed", { studentId, section, e });
  }
}
