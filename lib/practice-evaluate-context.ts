import { sql } from "@/lib/db"
import {
  calculatePracticeQuestionXp,
  DEFAULT_PRACTICE_HUB_POLICY,
  type PracticeHubPolicy,
} from "@/lib/practice-hub-policy-settings"
import { getPracticeHubPolicyForCourse } from "@/lib/practice-hub-policy-settings.server"

export type PracticeEvaluateContext = {
  policy: PracticeHubPolicy
  attemptNumber: number
  courseId: number | null
}

export async function loadPracticeEvaluateContext(
  attemptId: number | null | undefined,
  questionId: number | string,
): Promise<PracticeEvaluateContext> {
  if (attemptId == null) {
    return { policy: { ...DEFAULT_PRACTICE_HUB_POLICY }, attemptNumber: 1, courseId: null }
  }

  const qid = Number(questionId)
  const rows = await sql`
    SELECT
      s.course_id,
      (
        SELECT COUNT(*)::int
        FROM practice_answers pa
        WHERE pa.attempt_id = ${attemptId}
          AND pa.bank_question_id = ${qid}
      ) AS prior_attempts
    FROM practice_attempts pat
    JOIN students s ON s.id = pat.student_id
    WHERE pat.id = ${attemptId}
    LIMIT 1
  `
  const row = rows[0] as { course_id?: number; prior_attempts?: number } | undefined

  const courseId = row?.course_id != null ? Number(row.course_id) : null
  const policy = await getPracticeHubPolicyForCourse(courseId)
  const prior = Number(row?.prior_attempts ?? 0)

  return {
    policy,
    attemptNumber: prior + 1,
    courseId,
  }
}

export function practiceAttemptLimitExceeded(policy: PracticeHubPolicy, attemptNumber: number): boolean {
  return policy.max_attempts_per_question > 0 && attemptNumber > policy.max_attempts_per_question
}

export function resolveServerPracticeXp(
  policy: PracticeHubPolicy,
  isCorrect: boolean,
  input: { difficulty?: string | null; responseTimeMs?: number | null; attemptNumber: number },
): number {
  if (!isCorrect) return 0
  return calculatePracticeQuestionXp(policy, input).xp
}

export function shouldShowPracticeAnswerReview(policy: PracticeHubPolicy, isCorrect: boolean): boolean {
  return isCorrect || policy.show_explanations_after_wrong
}
