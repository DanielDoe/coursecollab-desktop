import { sql } from "@/lib/db"
import { getPlatformDefaultAssessmentPerksGraceDays } from "@/lib/assessment-perks-expiry"
import { isSingleSittingExamAssessmentDbType } from "@/lib/final-exam-policy"

/**
 * Quiz ids where this student has an active deadline extension: membership/instructor rollover
 * OR attempt_overrides with extra attempts (same rules as GET /api/[type]/take/[id]).
 * Extensions expire when the course assessment perks grace window ends (deadline + N days).
 */
export async function getQuizIdsWithDeadlineExtensionForStudent(
  studentId: number,
  quizIds: number[],
): Promise<Set<number>> {
  const unique = [...new Set(quizIds.filter((id) => Number.isFinite(id) && id > 0))]
  if (unique.length === 0) return new Set()

  const platformDefault = getPlatformDefaultAssessmentPerksGraceDays()

  const rollover = (await sql`
    SELECT sar.quiz_id, q.assessment_type
    FROM student_assessment_rollovers sar
    INNER JOIN quizzes q ON q.id = sar.quiz_id AND q.deleted_at IS NULL
    LEFT JOIN course_policies cp ON cp.course_id = q.course_id
    WHERE sar.student_id = ${studentId}
      AND sar.quiz_id = ANY(${unique}::int[])
      AND sar.expires_at > NOW()
      AND (
        q.available_until IS NULL
        OR NOW() <= q.available_until + (
          COALESCE(
            NULLIF((cp.grading_policy->>'assessment_perks_grace_days_after_deadline')::int, -1),
            ${platformDefault}
          ) * INTERVAL '1 day'
        )
      )
  `) as { quiz_id: number; assessment_type?: string | null }[]

  const set = new Set<number>()
  for (const r of rollover) {
    if (isSingleSittingExamAssessmentDbType(r.assessment_type)) continue
    set.add(r.quiz_id)
  }

  try {
    const ov = (await sql`
      SELECT ao.quiz_id
      FROM attempt_overrides ao
      INNER JOIN quizzes q ON q.id = ao.quiz_id AND q.deleted_at IS NULL
      LEFT JOIN course_policies cp ON cp.course_id = q.course_id
      WHERE ao.student_id = ${studentId}
        AND ao.quiz_id = ANY(${unique}::int[])
        AND ao.is_active = TRUE
        AND (ao.expires_at IS NULL OR ao.expires_at > NOW())
        AND COALESCE(ao.additional_attempts, 0) > 0
        AND (
          q.available_until IS NULL
          OR NOW() <= q.available_until + (
            COALESCE(
              NULLIF((cp.grading_policy->>'assessment_perks_grace_days_after_deadline')::int, -1),
              ${platformDefault}
            ) * INTERVAL '1 day'
          )
        )
    `) as { quiz_id: number }[]
    for (const r of ov) set.add(r.quiz_id)
  } catch {
    /* attempt_overrides may be absent */
  }

  return set
}

export async function hasDeadlineExtensionForStudentQuiz(
  studentId: number,
  quizId: number,
): Promise<boolean> {
  const s = await getQuizIdsWithDeadlineExtensionForStudent(studentId, [quizId])
  return s.has(quizId)
}
