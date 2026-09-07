import type { MembershipTier } from "@/lib/membership-constants"

/** All student tiers include some Cora Credits; Scholar is limited (Lite-capable). */
export function canAccessAiTutor(tier: MembershipTier | null): boolean {
  if (!tier) return false
  return tier === "Scholar" || tier === "Explorer" || tier === "Trailblazer"
}

export const AI_TUTOR_UPGRADE_MESSAGE =
  "Need more Cora Credits? Upgrade your membership or buy a Cora Credit Pack from Membership."

/** @deprecated use AI_TUTOR_UPGRADE_MESSAGE — kept for API backward compatibility */
export const CORA_UPGRADE_MESSAGE = AI_TUTOR_UPGRADE_MESSAGE
