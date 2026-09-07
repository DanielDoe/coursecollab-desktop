import { sql } from "@/lib/db"
import { ensureResultsFinalizedColumns } from "@/lib/ensure-results-finalized-columns"
import { reconcileFinalExamCircuitGradesForAttempt } from "@/lib/promote-provisional-circuit-scores"
import { createNotification } from "@/lib/create-notification"

export type ResultsFinalizedFields = {
  results_finalized: boolean
  results_finalized_at: string | null
  results_finalized_by: string | null
}

export function resultsFinalizedFieldsFromAttempt(
  attempt: Record<string, unknown>,
): ResultsFinalizedFields {
  const at = attempt.results_finalized_at
  return {
    results_finalized: at != null,
    results_finalized_at: at != null ? String(at) : null,
    results_finalized_by:
      attempt.results_finalized_by != null ? String(attempt.results_finalized_by) : null,
  }
}

export async function resolveInstructorDisplayName(instructorId: number): Promise<string | null> {
  const rows = await sql`
    SELECT name, username FROM instructors WHERE id = ${instructorId} LIMIT 1
  `
  if (rows.length === 0) return null
  const row = rows[0] as { name?: string | null; username?: string | null }
  return row.name?.trim() || row.username?.trim() || null
}

export async function setResultsFinalized(
  attemptId: string | number,
  finalized: boolean,
  finalizedBy?: string | null,
): Promise<ResultsFinalizedFields> {
  await ensureResultsFinalizedColumns()

  if (finalized) {
    const result = await sql`
      UPDATE quiz_attempts
      SET results_finalized_at = NOW(),
          results_finalized_by = ${finalizedBy ?? null}
      WHERE id = ${attemptId}
        AND deleted_at IS NULL
      RETURNING results_finalized_at, results_finalized_by
    `
    if (result.length === 0) {
      throw new Error("Attempt not found")
    }
    await reconcileFinalExamCircuitGradesForAttempt(Number(attemptId), finalizedBy ?? null)

    if (finalizedBy !== "submit") {
      try {
        const rows = await sql`
          SELECT
            qa.student_id,
            qa.score,
            q.title,
            q.assessment_type,
            (
              SELECT COALESCE(SUM(COALESCE(qq.max_points, qq.points, 1)), 0)
              FROM quiz_questions qq
              WHERE qq.quiz_id = q.id
            ) AS total_points
          FROM quiz_attempts qa
          JOIN quizzes q ON q.id = qa.quiz_id
          WHERE qa.id = ${attemptId}
            AND qa.deleted_at IS NULL
          LIMIT 1
        `
        const row = rows[0] as
          | {
              student_id: number
              score: number | null
              title: string
              assessment_type: string | null
              total_points: number | null
            }
          | undefined
        if (row?.student_id && row.title) {
          const typeMap: Record<string, string> = {
            quiz: "quiz",
            homework: "homework",
            mid_semester: "mid-semester exam",
            final: "final exam",
          }
          const assessmentLabel =
            typeMap[String(row.assessment_type || "quiz").toLowerCase()] || "assessment"
          const total = Number(row.total_points) || 0
          const score = Number(row.score) || 0
          const scorePct = total > 0 ? Math.round((score / total) * 100) : null
          const scoreLine =
            scorePct != null ? `${scorePct}% (${score}/${total} pts)` : "view your score"
          await createNotification({
            studentId: row.student_id,
            type: "grade",
            title: `Grade posted: ${row.title}`,
            message: `Your ${assessmentLabel} grade is now available — ${scoreLine}.`,
            link: `/student/dashboard-v2/grades`,
          }).catch((e) => console.warn("[ResultsFinalized] grade notification:", e))
        }
      } catch (e) {
        console.warn("[ResultsFinalized] grade notification lookup failed:", e)
      }
    }

    return resultsFinalizedFieldsFromAttempt(result[0] as Record<string, unknown>)
  }

  const result = await sql`
    UPDATE quiz_attempts
    SET results_finalized_at = NULL,
        results_finalized_by = NULL
    WHERE id = ${attemptId}
      AND deleted_at IS NULL
    RETURNING results_finalized_at, results_finalized_by
  `
  if (result.length === 0) {
    throw new Error("Attempt not found")
  }
  return resultsFinalizedFieldsFromAttempt(result[0] as Record<string, unknown>)
}
