import type { MatchBand } from "@/lib/guest/career/types"

/** Bump when scoring logic changes — invalidates cached analyses. */
export const CAREER_ANALYSIS_ALGORITHM_VERSION = "1.0.0"

/** Bump when dimension weights change. */
export const CAREER_MATCH_WEIGHTS_VERSION = "1.0.0"

export type MatchDimensionKey = keyof typeof CAREER_MATCH_WEIGHTS

/** Central weights — do not scatter in UI. Must sum to 1. */
export const CAREER_MATCH_WEIGHTS = {
  skillsMatch: 0.35,
  experienceAlignment: 0.2,
  roleTitleAlignment: 0.1,
  educationQualifications: 0.1,
  keywordCoverage: 0.1,
  resumeImpact: 0.1,
  atsReadability: 0.05,
} as const

export const MATCH_BAND_LABELS: Record<MatchBand, string> = {
  NEEDS_ALIGNMENT: "Needs alignment",
  DEVELOPING_MATCH: "Developing match",
  STRONG_MATCH: "Strong match",
  EXCELLENT_ALIGNMENT: "Excellent alignment",
}

export function scoreToMatchBand(score: number): MatchBand {
  if (score >= 88) return "EXCELLENT_ALIGNMENT"
  if (score >= 75) return "STRONG_MATCH"
  if (score >= 55) return "DEVELOPING_MATCH"
  return "NEEDS_ALIGNMENT"
}

export function matchBandHeadline(band: MatchBand): string {
  switch (band) {
    case "EXCELLENT_ALIGNMENT":
      return "Excellent alignment with this opportunity."
    case "STRONG_MATCH":
      return "Your background aligns well with this opportunity."
    case "DEVELOPING_MATCH":
      return "You have relevant strengths with room to strengthen your fit."
    default:
      return "Several areas need alignment before this application is competitive."
  }
}

/** Human-friendly target — not 100%. Jobscan-style guidance without copying. */
export const MATCH_TARGET_GUIDANCE =
  "Aim for strong alignment (75%+) with evidence-backed improvements — not keyword stuffing."

export const MATCH_SCORE_DISCLAIMER =
  "This score estimates how closely your résumé aligns with the supplied opportunity. It is not a score produced by an employer's ATS."

export { GUEST_RESUME_MATCH_CREDIT_COST } from "@/lib/guest/career/guest-ai-credit-costs"
