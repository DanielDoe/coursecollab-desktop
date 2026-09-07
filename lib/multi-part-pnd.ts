/** Client-safe PND helpers for multi-part upload pending (no Node fs imports). */

function parseAnswerDataRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null
  if (typeof raw === "object") return raw as Record<string, unknown>
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return null
    }
  }
  return null
}

/** True when AI finalized upload points on this multi-part question. */
export function isMultiPartUploadAiFinalized(q: {
  question_type?: string
  answer_data?: unknown
  override_points?: number | null
  ai_feedback?: unknown
}): boolean {
  if ((q.question_type || "").toLowerCase() !== "multi_part") return false
  if (q.override_points != null && q.override_points !== undefined) return true

  const ad = parseAnswerDataRecord(q.answer_data)
  const g = ad?.multi_part_grading as Record<string, unknown> | undefined
  if (g?.upload_pending === false) return true

  let af: Record<string, unknown> | null = null
  if (q.ai_feedback && typeof q.ai_feedback === "object") {
    af = q.ai_feedback as Record<string, unknown>
  } else if (typeof q.ai_feedback === "string") {
    try {
      af = JSON.parse(q.ai_feedback) as Record<string, unknown>
    } catch {
      af = null
    }
  }
  return af?.multiPartAiGraded === true && af?.uploadPending !== true
}

/**
 * True when upload portion is still awaiting instructor review or a successful AI re-eval.
 * AI-successful uploads (upload_pending false / multiPartAiGraded) are final unless instructor overrides.
 */
export function isMultiPartUploadPendingReview(q: {
  question_type?: string
  requires_review?: boolean
  answer_data?: unknown
  override_points?: number | null
  reviewed_at?: string | null
  reviewed_by?: string | null
  ai_feedback?: unknown
}): boolean {
  if ((q.question_type || "").toLowerCase() !== "multi_part") return false
  if (q.override_points != null && q.override_points !== undefined) return false
  if (isMultiPartUploadAiFinalized(q)) return false

  const ad = parseAnswerDataRecord(q.answer_data)
  const g = ad?.multi_part_grading as Record<string, unknown> | undefined
  if (g?.upload_pending === true) return true
  if (g?.upload_max != null && Number(g.upload_max) > 0 && q.requires_review === true) return true

  let af: Record<string, unknown> | null = null
  if (q.ai_feedback && typeof q.ai_feedback === "object") {
    af = q.ai_feedback as Record<string, unknown>
  } else if (typeof q.ai_feedback === "string") {
    try {
      af = JSON.parse(q.ai_feedback) as Record<string, unknown>
    } catch {
      af = null
    }
  }
  if (af?.uploadPending === true) return true
  if (af?.requiresManualReview === true && af?.multiPartAiGraded !== true) {
    return g?.upload_max != null && Number(g.upload_max) > 0
  }
  return false
}
