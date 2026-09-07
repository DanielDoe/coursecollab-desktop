/**
 * Shared "pending manual review" detection for results UI and PDF.
 * Auto-gradable keyed questions (MCQ, T/F, select all, etc.) must not show PND
 * after answer-key grading — including wrong answers scored 0.
 */
import { getCanonicalAiFeedbackPercent } from "@/lib/ai-points-consistency"
import { isCircuitSubmissionPendingReview } from "@/lib/circuit-submission"
import { canVerifyLocally } from "@/lib/local-answer-verification"
import { isMultiPartUploadPendingReview } from "@/lib/multi-part-pnd"
import { hasStudentAnswerContent } from "@/lib/student-answer-presence"

export type QuestionPendingReviewRow = {
  requires_review?: boolean
  points_earned?: number | null
  ai_feedback?: unknown
  question_type?: string
  answer_data?: unknown
  selected_answer?: unknown
  code?: string | null
  override_points?: number | null
  reviewed_at?: string | null
  reviewed_by?: string | null
  is_correct?: boolean | null
}

/** True when this question was already handled by an instructor (override or explicit review). */
export function isInstructorResolvedForPnd(q: QuestionPendingReviewRow): boolean {
  if (q.override_points != null && q.override_points !== undefined) return true
  // Multi-part: AI-finalized upload is a final grade — only override counts as instructor resolution.
  if ((q.question_type || "").toLowerCase() === "multi_part") {
    return !isMultiPartUploadPendingReview(q)
  }
  if (q.reviewed_at != null && q.reviewed_at !== undefined) return true
  if (q.reviewed_by != null && String(q.reviewed_by).trim() !== "") return true
  return false
}

function canonicalAiPercentForUi(feedback: unknown): number | undefined {
  const c = getCanonicalAiFeedbackPercent(feedback)
  if (c != null) return c
  if (feedback && typeof feedback === "object" && feedback !== null) {
    const score = (feedback as { score?: unknown }).score
    if (score != null && Number.isFinite(Number(score))) return Number(score)
  }
  return undefined
}

/** True when an answer-key question was already auto-graded (correct, wrong, or partial). */
function isAutoGradedKeyedQuestion(question: QuestionPendingReviewRow): boolean {
  const qType = question.question_type || ""
  if (!canVerifyLocally(qType)) return false

  if (isInstructorResolvedForPnd(question)) return true
  if (question.is_correct === true) return true
  if (question.is_correct === false && question.requires_review !== true) return true
  if (question.reviewed_at != null && String(question.reviewed_at).trim() !== "") return true
  if (Number(question.points_earned ?? 0) > 0) return true
  if (question.reviewed_by === "student:self") return true

  return false
}

/** Show "PND%" / pending badge only when grading genuinely has not completed. */
export function isPendingManualReview(question: QuestionPendingReviewRow): boolean {
  if (!hasStudentAnswerContent(question)) return false

  const qType = (question.question_type || "").toLowerCase()
  if (qType === "multi_part" && isMultiPartUploadPendingReview(question)) {
    return true
  }
  if (qType === "circuit_submission" && isCircuitSubmissionPendingReview(question)) {
    return true
  }

  if (isAutoGradedKeyedQuestion(question)) return false

  if (!question.requires_review) return false
  if (isInstructorResolvedForPnd(question)) return false

  const pts = question.points_earned ?? 0
  const score = canonicalAiPercentForUi(question.ai_feedback) ?? null
  return pts === 0 && (score === 0 || score === null || score === undefined)
}
