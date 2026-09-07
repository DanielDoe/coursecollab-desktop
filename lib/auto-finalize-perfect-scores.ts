import { sql } from "@/lib/db"
import { getAttemptDisplayGrade } from "@/lib/attempt-grade-display"
import { getCourseAutoFinalizePerfectScores } from "@/lib/course-grading-policy-settings"
import { ensureResultsFinalizedColumns } from "@/lib/ensure-results-finalized-columns"
import { setResultsFinalized } from "@/lib/results-finalized"

/**
 * When course policy enables it, mark instructor results as finalized for perfect (100%) scores
 * with no pending manual review.
 */
export async function tryAutoFinalizePerfectScore(attemptId: number): Promise<boolean> {
  try {
    await ensureResultsFinalizedColumns()

    const rows = await sql`
      SELECT
        qa.results_finalized_at,
        qa.completed_at,
        q.course_id,
        EXISTS (
          SELECT 1 FROM quiz_answers qans
          WHERE qans.attempt_id = qa.id
            AND qans.requires_review = true
            AND qans.reviewed_at IS NULL
            AND qans.reviewed_by IS NULL
            AND qans.override_points IS NULL
        ) AS has_pending_review
      FROM quiz_attempts qa
      JOIN quizzes q ON q.id = qa.quiz_id
      WHERE qa.id = ${attemptId} AND qa.deleted_at IS NULL
      LIMIT 1
    `
    const row = rows[0] as
      | {
          results_finalized_at: unknown
          completed_at: unknown
          course_id: number | null
          has_pending_review: boolean
        }
      | undefined
    if (!row?.completed_at || row.results_finalized_at != null || row.has_pending_review) {
      return false
    }
    if (!row.course_id) return false

    const policyRows = await sql`
      SELECT grading_policy FROM course_policies WHERE course_id = ${row.course_id} LIMIT 1
    `
    if (!getCourseAutoFinalizePerfectScores(policyRows[0]?.grading_policy)) {
      return false
    }

    const grade = await getAttemptDisplayGrade(String(attemptId))
    if (!grade || grade.percentage + 0.001 < 100) {
      return false
    }

    await setResultsFinalized(attemptId, true, "System (auto-finalize)")
    return true
  } catch (e) {
    console.warn("[auto-finalize-perfect] Skipped:", e)
    return false
  }
}

/** When policy is newly enabled, finalize existing perfect scores for the course. */
export async function backfillAutoFinalizePerfectScoresForCourse(
  courseId: number,
): Promise<number> {
  await ensureResultsFinalizedColumns()
  const rows = await sql`
    SELECT qa.id
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa.quiz_id
    WHERE q.course_id = ${courseId}
      AND qa.deleted_at IS NULL
      AND qa.completed_at IS NOT NULL
      AND qa.results_finalized_at IS NULL
    ORDER BY qa.id ASC
  `
  let finalized = 0
  for (const row of rows as { id: number }[]) {
    if (await tryAutoFinalizePerfectScore(Number(row.id))) finalized++
  }
  return finalized
}
