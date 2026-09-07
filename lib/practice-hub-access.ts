import type { MembershipTier } from "@/lib/membership-constants"
import { practiceAccessLevelForTier } from "@/lib/practice-tier-access"

export const PRACTICE_HUB_MIN_TIER: MembershipTier = "Explorer"

export function canAccessPracticeHub(tier: MembershipTier | null | undefined): boolean {
  if (!tier) return false
  return practiceAccessLevelForTier(tier) !== "none"
}
