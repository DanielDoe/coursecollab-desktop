/**
 * Guest platform types — separate PURPOSE (onboarding) from CAPABILITIES (authorization).
 */

/** Why the person joined — analytics/onboarding only, not authorization. */
export type GuestOnboardingPurpose =
  | "recommendation_letter"
  | "career_application"
  | "graduate_school"
  | "scholarship"
  | "other_academic"
  /** @deprecated legacy value — treat as other_academic */
  | "other"

/** What the account may do — derived from plan + entitlements. */
export type GuestCapability =
  | "recommendations.request"
  | "recommendations.track"
  | "recommendations.materials"
  | "messages.use"
  | "career.resume"
  | "career.application"
  | "career.interview"
  | "career.cora"
  | "career.documents"
  | "cora.generateRecommendationBrief"
  | "cora.reviewResume"
  | "cora.prepareInterview"
  | "cora.helpApplication"

export type GuestPlan = "guest_free" | "cora_career_essentials" | "cora_career"

export type GuestEntitlementStatus = "active" | "refunded" | "revoked"

export type GuestEntitlementRow = {
  student_id: number
  plan: GuestPlan
  status: GuestEntitlementStatus
  starts_at: Date | string
  /** Always null for lifetime Cora Career — feature access does not expire */
  expires_at: Date | string | null
  cora_credit_limit: number | null
  updated_at: Date | string
}
