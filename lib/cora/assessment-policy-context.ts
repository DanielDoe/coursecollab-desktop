/**
 * Strip hidden solution material before it is sent to Cora.
 */

import type { CoraAssessmentPolicyResult } from "@/lib/cora/assessment-policy"
import type { CoraProblemContext } from "@/lib/cora/types"

const HIDDEN_KEYS = [
  "correct_answer",
  "correctAnswer",
  "expected_answer",
  "expectedAnswer",
  "answer_key",
  "answerKey",
  "instructor_solution",
  "instructorSolution",
  "hidden_tests",
  "hiddenTests",
  "reference_code",
  "referenceCode",
  "private_feedback",
  "privateFeedback",
  "explanation",
  "referenceSteps",
  "answer_guidelines",
  "answerGuidelines",
  "rubric",
  "grading_rubric",
  "gradingRubric",
] as const

export function sanitizeProblemForCoraPolicy(
  problem: CoraProblemContext | null | undefined,
  policy: CoraAssessmentPolicyResult,
): CoraProblemContext | null {
  if (!problem) return null
  if (policy.canUseHiddenSolutionContext) return problem
  const { expectedAnswer: _ea, explanation: _ex, referenceSteps: _rs, ...rest } = problem
  return rest
}

export function sanitizeRecordForCoraPolicy<T extends Record<string, unknown>>(
  record: T,
  policy: CoraAssessmentPolicyResult,
): T {
  if (policy.canUseHiddenSolutionContext) return record
  const next = { ...record }
  for (const key of HIDDEN_KEYS) {
    if (key in next) delete next[key]
  }
  return next
}

export function filterAnswerGuidelines(
  guidelines: unknown,
  policy: CoraAssessmentPolicyResult,
): unknown[] {
  if (policy.canUseHiddenSolutionContext) {
    return Array.isArray(guidelines) ? guidelines : []
  }
  return []
}
