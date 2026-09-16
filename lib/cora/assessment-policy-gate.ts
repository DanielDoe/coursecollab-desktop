/**
 * Single server-side Ask Cora gate used by every student entry point.
 * Evaluate policy → sanitize context → optionally refuse before the model runs.
 */

import {
  buildGuidedPolicyPrompt,
  type CoraAssessmentPolicyResult,
} from "@/lib/cora/assessment-policy"
import {
  filterAnswerGuidelines,
  sanitizeProblemForCoraPolicy,
} from "@/lib/cora/assessment-policy-context"
import { validateCoraAssessmentOutput } from "@/lib/cora/assessment-policy-output"
import {
  recordAskCoraAssessmentEvent,
  resolveStudentInstitutionId,
} from "@/lib/cora/assessment-policy-analytics"
import {
  resolveAskCoraPolicy,
  resolveInputFromProblem,
  type ResolvedAskCoraPolicy,
} from "@/lib/cora/assessment-policy-resolve"
import type { CoraProblemContext } from "@/lib/cora/types"
import { mergeMessagesForAnswerSeekingCheck } from "@/lib/cora/security/assessment-integrity"

export type AskCoraGate = {
  resolved: ResolvedAskCoraPolicy
  policy: CoraAssessmentPolicyResult
  problem: CoraProblemContext | null
  blockBeforeModel: boolean
  refusalMessage: string | null
  promptAppendix: string
}

export async function enforceAskCoraGate(input: {
  studentId: number
  message?: string | null
  problem?: CoraProblemContext | null
  source?: string | null
  quizId?: number | null
  questionId?: number | null
  bankQuestionId?: number | null
  attemptId?: number | null
  questionType?: string | null
  subquestionTypes?: Array<string | null | undefined>
  conversationHistory?: Array<{ role?: string; content?: string }> | null
}): Promise<AskCoraGate> {
  const integrityMessage = mergeMessagesForAnswerSeekingCheck(
    input.message,
    input.conversationHistory,
  )
  const fromProblem = resolveInputFromProblem(input.studentId, integrityMessage, input.problem, {
    attemptId: input.attemptId,
  })
  const resolved = await resolveAskCoraPolicy({
    ...fromProblem,
    message: integrityMessage,
    source: input.source ?? fromProblem.source,
    quizId: input.quizId ?? fromProblem.quizId,
    questionId: input.questionId ?? fromProblem.questionId,
    bankQuestionId: input.bankQuestionId ?? fromProblem.bankQuestionId,
    attemptId: input.attemptId ?? fromProblem.attemptId,
    questionType: input.questionType ?? fromProblem.questionType,
    subquestionTypes: input.subquestionTypes,
  })

  const policy = resolved.policy
  const problem = sanitizeProblemForCoraPolicy(input.problem, policy)
  const refusal =
    policy.mode === "DISABLED"
      ? policy.refusalMessage
      : policy.answerSeeking && policy.mode === "GUIDED_ONLY"
        ? policy.refusalMessage
        : null

  return {
    resolved,
    policy,
    problem,
    blockBeforeModel: Boolean(refusal),
    refusalMessage: refusal,
    promptAppendix: buildGuidedPolicyPrompt(policy),
  }
}

export function applyAskCoraOutputGate(raw: string, policy: CoraAssessmentPolicyResult) {
  return validateCoraAssessmentOutput(raw, policy)
}

export function guidelinesAllowedForPolicy(
  guidelines: unknown,
  policy: CoraAssessmentPolicyResult,
) {
  return filterAnswerGuidelines(guidelines, policy)
}

export async function logAskCoraGateEvent(args: {
  studentId: number
  gate: AskCoraGate
  answerBlocked?: boolean
  providedConceptualGuidance?: boolean
}): Promise<void> {
  const institutionId = await resolveStudentInstitutionId(args.studentId)
  await recordAskCoraAssessmentEvent({
    studentId: args.studentId,
    courseId: args.gate.resolved.courseId,
    institutionId,
    assessmentId: args.gate.resolved.assessmentId,
    assessmentType: args.gate.resolved.assessmentType,
    questionId: args.gate.resolved.questionId,
    bankQuestionId: args.gate.resolved.bankQuestionId,
    questionType: args.gate.resolved.questionType,
    attemptId: args.gate.resolved.attemptId,
    source: args.gate.resolved.source,
    policy: args.gate.policy,
    answerBlocked: args.answerBlocked ?? args.gate.blockBeforeModel,
    providedConceptualGuidance: args.providedConceptualGuidance,
    topic: args.gate.resolved.topic,
  })
}
