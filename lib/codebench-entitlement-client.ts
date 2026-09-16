import { MEMBERSHIP_PLANS, type MembershipTier } from "@/lib/membership-constants"

/**
 * Client-safe CodeBench access check from an already-resolved effective tier.
 * Source of truth: MEMBERSHIP_PLANS[].features.codeBench (all student tiers).
 * Keep this file free of db / entitlements imports so Client Components can use it.
 */
export function studentTierHasCodeBenchAccess(
  tier: MembershipTier | string | null | undefined,
): boolean {
  if (!tier) return true
  const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)
  return plan ? Boolean(plan.features.codeBench) : true
}

/**
 * Cora-powered CodeBench actions (explain, debug, improve, suggest fix).
 * Scholar sees the affordances but cannot execute these requests.
 */
export function studentTierHasCodeBenchCoraAccess(
  tier: MembershipTier | string | null | undefined,
): boolean {
  if (!tier) return false
  const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)
  return Boolean(plan?.features.codeBenchCora)
}

/** sessionStorage key for short-lived client access cache (cleared on membership change). */
export const CODEBENCH_ACCESS_CACHE_KEY = "codebench_access_v3"
/** Legacy keys — clear on membership refresh so Scholar is not stuck behind old Trailblazer cache. */
export const CODEBENCH_ACCESS_CACHE_KEY_LEGACY = "codebench_trailblazer_access"
export const CODEBENCH_ACCESS_CACHE_KEY_V2 = "codebench_access_v2"

export function clearCodebenchAccessCache(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(CODEBENCH_ACCESS_CACHE_KEY)
    sessionStorage.removeItem(CODEBENCH_ACCESS_CACHE_KEY_V2)
    sessionStorage.removeItem(CODEBENCH_ACCESS_CACHE_KEY_LEGACY)
  } catch {
    /* ignore */
  }
}
