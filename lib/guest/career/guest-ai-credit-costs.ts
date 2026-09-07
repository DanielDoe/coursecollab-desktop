/** Client-safe credit cost constants — no DB imports. */
export const GUEST_CAREER_AI_FEATURE_COSTS = {
  resume_match: 40,
  resume_review: 35,
  interview_prep: 50,
  statement_draft: 45,
  application_plan: 25,
} as const

export type GuestCareerAiFeature = keyof typeof GUEST_CAREER_AI_FEATURE_COSTS

export function guestCareerAiCreditCost(feature: GuestCareerAiFeature): number {
  return GUEST_CAREER_AI_FEATURE_COSTS[feature]
}

/** @deprecated use guestCareerAiCreditCost("resume_match") */
export const GUEST_RESUME_MATCH_CREDIT_COST = GUEST_CAREER_AI_FEATURE_COSTS.resume_match
