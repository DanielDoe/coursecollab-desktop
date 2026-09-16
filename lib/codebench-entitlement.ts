import { hasFeatureAccess } from "@/lib/entitlements"
import { getEffectiveMembershipTier, isBetaUser } from "@/lib/membership"
import type { MembershipTier } from "@/lib/membership-constants"
import {
  studentTierHasCodeBenchAccess,
  studentTierHasCodeBenchCoraAccess,
} from "@/lib/codebench-entitlement-client"

export {
  studentTierHasCodeBenchAccess,
  studentTierHasCodeBenchCoraAccess,
  CODEBENCH_ACCESS_CACHE_KEY,
  CODEBENCH_ACCESS_CACHE_KEY_LEGACY,
  clearCodebenchAccessCache,
} from "@/lib/codebench-entitlement-client"

export type StudentCodeBenchEntitlement = {
  access: boolean
  coraAccess: boolean
  tier: MembershipTier
}

export type StudentCodeBenchCapabilities = {
  codebenchAccess: boolean
  execution: boolean
  liveClassroom: boolean
  challenges: boolean
  gamification: boolean
  analytics: boolean
  coraAccess: boolean
  coraCredits: null
  tier: MembershipTier
}

/**
 * Server-side CodeBench entitlement. Resolves membership/institutional access
 * from the authenticated student id — never from client-supplied plan claims.
 *
 * `access` = core CodeBench (IDE, run, Live Classroom, challenges).
 * `coraAccess` = Cora-powered CodeBench actions.
 */
export async function getStudentCodeBenchEntitlement(
  studentId: number,
): Promise<StudentCodeBenchEntitlement> {
  if (await isBetaUser(studentId)) {
    return { access: true, coraAccess: true, tier: "Trailblazer" }
  }

  const [codeBenchFeature, coraFeature, tier] = await Promise.all([
    hasFeatureAccess("student", studentId, "codeBench"),
    hasFeatureAccess("student", studentId, "codeBenchCora"),
    getEffectiveMembershipTier(studentId),
  ])

  return {
    access: codeBenchFeature.allowed || studentTierHasCodeBenchAccess(tier),
    coraAccess: coraFeature.allowed || studentTierHasCodeBenchCoraAccess(tier),
    tier,
  }
}

export async function getStudentCodeBenchCapabilities(
  studentId: number,
): Promise<StudentCodeBenchCapabilities> {
  const entitlement = await getStudentCodeBenchEntitlement(studentId)
  return {
    codebenchAccess: entitlement.access,
    execution: entitlement.access,
    liveClassroom: entitlement.access,
    challenges: entitlement.access,
    gamification: entitlement.access,
    analytics: entitlement.access,
    coraAccess: entitlement.coraAccess,
    coraCredits: null,
    tier: entitlement.tier,
  }
}
