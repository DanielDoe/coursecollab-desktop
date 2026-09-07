import { NextResponse } from "next/server"
import { getEffectiveMembershipTier } from "@/lib/membership"
import { createAccessDeniedResponse } from "@/lib/membership-guard"
import type { MembershipTier } from "@/lib/membership-constants"
import { canAccessPracticeHub, PRACTICE_HUB_MIN_TIER } from "@/lib/practice-hub-access"

export async function checkPracticeHubAccess(studentId: number): Promise<{
  allowed: boolean
  tier: MembershipTier
  upgradeRequired: MembershipTier
  deniedResponse: NextResponse | null
}> {
  let allowed = false
  let tier = await getEffectiveMembershipTier(studentId)
  try {
    const { getEffectiveStudentAccess } = await import("@/lib/entitlements/resolver")
    const access = await getEffectiveStudentAccess(studentId)
    if (access.institutionalEntitlement === "institution_student_access" || access.learningFeatures) {
      allowed = true
    }
  } catch {
    allowed = canAccessPracticeHub(tier)
  }
  if (!allowed) allowed = canAccessPracticeHub(tier)

  return {
    allowed,
    tier,
    upgradeRequired: PRACTICE_HUB_MIN_TIER,
    deniedResponse: allowed
      ? null
      : NextResponse.json(
          createAccessDeniedResponse("Practice Hub", PRACTICE_HUB_MIN_TIER, tier),
          { status: 403 },
        ),
  }
}
