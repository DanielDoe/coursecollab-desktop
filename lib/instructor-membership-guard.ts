import { NextResponse } from "next/server"
import { getInstructorMembership, instructorTierRank } from "@/lib/instructor-membership"
import {
  INSTRUCTOR_MEMBERSHIP_PLANS,
  type InstructorMembershipFeatures,
  type InstructorMembershipTier,
} from "@/lib/instructor-membership-constants"

export async function requireInstructorMinTier(
  instructorId: number,
  minTier: InstructorMembershipTier,
  message: string,
) {
  try {
    const { getEffectiveInstructorAccess } = await import("@/lib/entitlements/resolver")
    const access = await getEffectiveInstructorAccess(instructorId)
    const effective = access.institutionalEntitlement
      ? "Teams"
      : (access.personalTier ?? "Free")
    if (instructorTierRank(effective) >= instructorTierRank(minTier)) {
      return { ok: true as const, tier: effective }
    }
  } catch {
    /* fall through */
  }
  const membership = await getInstructorMembership(instructorId)
  const tier = membership?.tier ?? "Free"
  if (instructorTierRank(tier) < instructorTierRank(minTier)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: message }, { status: 403 }),
    }
  }
  return { ok: true as const, tier }
}

export async function requireInstructorFeature(
  instructorId: number,
  feature: keyof InstructorMembershipFeatures,
  message: string,
) {
  try {
    const { hasFeatureAccess } = await import("@/lib/entitlements/resolver")
    const access = await hasFeatureAccess("instructor", instructorId, feature)
    if (access.allowed) {
      return { ok: true as const, tier: (access.personalTier as InstructorMembershipTier) ?? "Free" }
    }
  } catch {
    /* fall through to personal membership */
  }
  const membership = await getInstructorMembership(instructorId)
  const tier = membership?.tier ?? "Free"
  const plan =
    INSTRUCTOR_MEMBERSHIP_PLANS.find((p) => p.id === tier) ??
    INSTRUCTOR_MEMBERSHIP_PLANS.find((p) => p.id === "Free")
  if (!plan?.features[feature]) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: message }, { status: 403 }),
    }
  }
  return { ok: true as const, tier }
}
