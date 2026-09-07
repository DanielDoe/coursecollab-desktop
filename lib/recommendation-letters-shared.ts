/** Client-safe recommendation letter helpers (no DB / Node-only deps). */

export const RECOMMENDATION_PURPOSES = [
  "scholarship",
  "internship",
  "graduate_school",
  "job_application",
  "research_opportunity",
  "other",
] as const

export type RecommendationPurpose = (typeof RECOMMENDATION_PURPOSES)[number]

export const RECOMMENDATION_STATUSES = [
  "requested",
  "approved",
  "rejected",
  "info_requested",
  "student_form_pending",
  "ai_generated",
  "student_selected",
  "instructor_review_pending",
  "revision_requested",
  "finalized",
  "downloaded",
] as const

export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number]

export const TONE_OPTIONS = [
  "professional",
  "warm_supportive",
  "research_focused",
  "leadership_focused",
  "technical_excellence",
] as const

export type LetterTone = (typeof TONE_OPTIONS)[number]

export function purposeLabel(purpose: string): string {
  const map: Record<string, string> = {
    scholarship: "Scholarship",
    internship: "Internship",
    graduate_school: "Graduate school",
    job_application: "Job application",
    research_opportunity: "Research opportunity",
    other: "Other",
  }
  return map[purpose] ?? purpose
}

/**
 * Parenthetical label for standard purposes on the formal Re: line.
 * When purpose is `other`, the full Re: line comes from {@link formatRecommendationReLine} instead.
 */
export function letterPurposeLineDisplay(
  purpose: string | null | undefined,
  purposeOtherDetail?: string | null,
): string {
  const p = typeof purpose === "string" ? purpose.trim().toLowerCase() : ""
  if (p === "other") {
    const d = typeof purposeOtherDetail === "string" ? purposeOtherDetail.trim() : ""
    return d.slice(0, 240) || "Other"
  }
  if (!p) return "Other"
  return purposeLabel(p)
}

/**
 * Full Re: subject line on the letterhead.
 * Standard purposes: `Re: Recommendation — {student} ({purpose label})`.
 * Other / custom: the instructor or student phrase is the entire subject (only `Re:` is added if missing).
 */
export function formatRecommendationReLine(
  studentName: string,
  purpose: string | null | undefined,
  purposeOtherDetail?: string | null,
): string | null {
  const p = typeof purpose === "string" ? purpose.trim().toLowerCase() : ""
  const name = studentName.trim() || "Student"

  if (p === "other") {
    const custom = typeof purposeOtherDetail === "string" ? purposeOtherDetail.trim() : ""
    if (!custom) return `Re: Recommendation — ${name} (Other)`
    const cleaned = custom.replace(/\s+/g, " ").trim().slice(0, 500)
    if (/^re\s*:/i.test(cleaned)) {
      return cleaned.endsWith(":") ? cleaned : `${cleaned}:`
    }
    return `Re: ${cleaned}`
  }

  const purposeText = letterPurposeLineDisplay(purpose, purposeOtherDetail)
  if (!purposeText) return null
  return `Re: Recommendation — ${name} (${purposeText})`
}
