// Server-side membership access guard utilities
import { getEffectiveMembershipTier } from "./membership"
import { MEMBERSHIP_PLANS, type MembershipTier } from "./membership-constants"
import { type NextResponse } from "next/server"

export async function checkMembershipAccess(
  studentId: number,
  feature: "leaderboard" | "codeBench" | "earlyAccess"
): Promise<{ allowed: boolean; tier: MembershipTier; message?: string; upgradeRequired?: MembershipTier }> {
  // Use effective tier (Trailblazer for beta users)
  const tier = await getEffectiveMembershipTier(studentId)
  const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)

  if (!plan) {
    return {
      allowed: false,
      tier: "Scholar",
      message: "Invalid membership tier",
    }
  }

  const hasAccess = plan.features[feature]

  if (hasAccess) {
    return { allowed: true, tier }
  }

  // Determine required tier
  let requiredTier: MembershipTier = "Explorer"
  for (const planOption of MEMBERSHIP_PLANS) {
    if (planOption.features[feature]) {
      requiredTier = planOption.id
      break
    }
  }

  return {
    allowed: false,
    tier,
    message: `This feature requires ${requiredTier} membership or higher`,
    upgradeRequired: requiredTier,
  }
}

export function createAccessDeniedResponse(
  feature: string,
  upgradeRequired: MembershipTier,
  tier: MembershipTier
) {
  const plan = MEMBERSHIP_PLANS.find((p) => p.id === upgradeRequired)
  return {
    error: "Membership upgrade required",
    message: `${feature} is only available with ${plan?.displayName || upgradeRequired} membership or higher. Your current tier: ${tier}`,
    upgradeRequired,
    currentTier: tier,
  }
}

