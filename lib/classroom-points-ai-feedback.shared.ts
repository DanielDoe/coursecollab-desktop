export type ClassroomPointAiFeedbackPayload = Record<string, unknown> & {
  aiGraded?: boolean
  feedback?: string
  instructorFeedback?: string
  evaluatedAt?: string
}

export function parseAiFeedbackFromReason(reason: string | null | undefined): string | null {
  if (!reason) return null
  const marker = " — AI: "
  const idx = reason.indexOf(marker)
  if (idx === -1) return null
  const text = reason.slice(idx + marker.length).trim()
  return text || null
}

export function stripAiSuffixFromReason(reason: string | null | undefined): string {
  if (!reason) return ""
  const marker = " — AI: "
  const idx = reason.indexOf(marker)
  return (idx === -1 ? reason : reason.slice(0, idx)).trim()
}

export function upsertReasonWithAiFeedback(baseReason: string, feedback: string): string {
  const base = stripAiSuffixFromReason(baseReason) || baseReason.trim()
  const note = feedback.trim()
  if (!note) return base.slice(0, 500)
  const combined = `${base} — AI: ${note}`
  return combined.length > 500 ? `${combined.slice(0, 497)}...` : combined
}

export function classroomPointHasAiFeedback(row: {
  reason?: string | null
  ai_feedback?: unknown
}): boolean {
  if (parseAiFeedbackFromReason(row.reason)) return true
  if (row.ai_feedback && typeof row.ai_feedback === "object") {
    const af = row.ai_feedback as Record<string, unknown>
    return Boolean(String(af.feedback ?? af.instructorFeedback ?? "").trim())
  }
  if (typeof row.ai_feedback === "string") {
    try {
      const parsed = JSON.parse(row.ai_feedback) as Record<string, unknown>
      return Boolean(String(parsed.feedback ?? parsed.instructorFeedback ?? "").trim())
    } catch {
      return false
    }
  }
  return false
}

function parseClassroomAiFeedbackObject(aiFeedback: unknown): Record<string, unknown> | null {
  if (aiFeedback && typeof aiFeedback === "object") {
    return aiFeedback as Record<string, unknown>
  }
  if (typeof aiFeedback === "string") {
    try {
      return JSON.parse(aiFeedback) as Record<string, unknown>
    } catch {
      return null
    }
  }
  return null
}

/** AI-evaluated classroom submissions show a provisional score until instructor confirms. */
export function classroomPointIsProvisional(row: {
  category?: string | null
  status?: string | null
  ai_feedback?: unknown
}): boolean {
  const af = parseClassroomAiFeedbackObject(row.ai_feedback)
  if (af?.provisionalScore === true) return true
  if (af?.requiresInstructorApproval === true) return true
  const category = String(row.category ?? "")
  if (
    af?.aiGraded === true &&
    (category === "solution_submission" || category === "code_submission") &&
    row.status !== "rejected"
  ) {
    return true
  }
  return false
}

export function resolveClassroomPointFeedbackText(row: {
  reason?: string | null
  ai_feedback?: unknown
}): string | null {
  if (row.ai_feedback && typeof row.ai_feedback === "object") {
    const af = row.ai_feedback as Record<string, unknown>
    const fromJson = String(af.feedback ?? af.instructorFeedback ?? af.remark ?? "").trim()
    if (fromJson) return fromJson
  }
  if (typeof row.ai_feedback === "string") {
    try {
      const parsed = JSON.parse(row.ai_feedback) as Record<string, unknown>
      const fromJson = String(parsed.feedback ?? parsed.instructorFeedback ?? parsed.remark ?? "").trim()
      if (fromJson) return fromJson
    } catch {
      /* ignore */
    }
  }
  return parseAiFeedbackFromReason(row.reason)
}
