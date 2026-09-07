import { circuitSubmissionHasRequiredUpload } from "@/lib/circuit-submission"
import {
  classroomBasePointsFromScorePercent,
  classroomPointsWithBooster,
} from "@/lib/classroom-point-booster"
import { clampClassroomPointsForDb } from "@/lib/ensure-classroom-points-schema"
import {
  REFERENCE_ANSWER_FEEDBACK_MARKER,
  stripReferenceAnswerFeedbackHeader,
  withReferenceAnswerFeedbackHeader,
} from "@/lib/resolve-reference-answer-for-ai"

/** Classroom points use submission-based credit; AI rubric scores are advisory only. */
export const CLASSROOM_SCORE_POLICY = "submission_full_credit" as const

export function classroomSolutionHasSubmittableWork(studentAnswer: unknown): boolean {
  return circuitSubmissionHasRequiredUpload(studentAnswer)
}

export function classroomCodeHasSubmittableWork(code: string | null | undefined): boolean {
  return Boolean(String(code ?? "").trim())
}

export function classroomSubmissionScorePercent(hasWork: boolean): number {
  return hasWork ? 100 : 0
}

export function resolveClassroomPointsFromSubmission(opts: {
  hasWork: boolean
  timingBooster: number
}): { scorePercent: number; basePoints: number; pointsAwarded: number } {
  const scorePercent = classroomSubmissionScorePercent(opts.hasWork)
  const basePoints = classroomBasePointsFromScorePercent(scorePercent)
  const pointsAwarded = clampClassroomPointsForDb(
    classroomPointsWithBooster(basePoints, opts.timingBooster),
  )
  return { scorePercent, basePoints, pointsAwarded }
}

/** Re-evaluation and backfill must never lower a student's points. */
export function mergeClassroomPointsPreservingGains(
  previousPoints: number,
  computedPoints: number,
): number {
  const prev = Number(previousPoints) || 0
  const next = Number(computedPoints) || 0
  return clampClassroomPointsForDb(Math.max(prev, next))
}

export const CLASSROOM_REFERENCE_HEADER_MARKER = REFERENCE_ANSWER_FEEDBACK_MARKER

/** Standard header prepended to AI feedback so every student sees the same stated solution. */
export function formatClassroomReferenceAnswerHeader(
  expectedAnswer: string | null | undefined,
): string | null {
  const ref = String(expectedAnswer ?? "").trim()
  if (!ref) return null
  return `${CLASSROOM_REFERENCE_HEADER_MARKER}:\n${ref}`
}

export function stripClassroomReferenceAnswerHeader(feedback: string): string {
  return stripReferenceAnswerFeedbackHeader(feedback)
}

export function withClassroomReferenceAnswerHeader(
  aiFeedback: string,
  expectedAnswer: string | null | undefined,
): string {
  return withReferenceAnswerFeedbackHeader(aiFeedback, expectedAnswer)
}

export function buildClassroomAiFeedbackPayload(opts: {
  instructorFeedback: string
  expectedAnswerReference?: string | null
  scorePercent: number
  pointsAwarded: number
  advisoryAiScore?: number
  requiresManualReview?: boolean
  extra?: Record<string, unknown>
}): Record<string, unknown> {
  const referenceAnswer = String(opts.expectedAnswerReference ?? "").trim() || undefined
  const normalizedFeedback = withClassroomReferenceAnswerHeader(
    opts.instructorFeedback,
    referenceAnswer,
  )
  return {
    aiGraded: true,
    provisionalScore: true,
    scorePolicy: CLASSROOM_SCORE_POLICY,
    feedback: normalizedFeedback,
    instructorFeedback: normalizedFeedback,
    referenceAnswer,
    score: opts.scorePercent,
    advisoryAiScore: opts.advisoryAiScore,
    pointsEarned: opts.pointsAwarded,
    requiresManualReview: opts.requiresManualReview ?? true,
    requiresInstructorApproval: true,
    evaluatedAt: new Date().toISOString(),
    ...opts.extra,
  }
}
