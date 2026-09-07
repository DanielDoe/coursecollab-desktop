import type {
  EntitlementSource,
  FeatureAccessResult,
  FeatureBundleId,
  ResolvedEntitlement,
} from "@/lib/entitlements/types"

const SOURCE_RANK: Record<EntitlementSource, number> = {
  admin_override: 100,
  beta: 90,
  trial: 80,
  donation: 75,
  grant: 70,
  promotion: 65,
  institution: 60,
  college: 55,
  department: 50,
  program: 45,
  course: 40,
  personal_purchase: 20,
}

const BUNDLE_RANK: Record<FeatureBundleId, number> = {
  institution_instructor_access: 80,
  instructor_teams: 70,
  instructor_pro: 50,
  instructor_free: 10,
  institution_student_access: 80,
  student_trailblazer: 70,
  student_explorer: 40,
  student_scholar: 10,
}

export function isEntitlementActive(row: ResolvedEntitlement, now = new Date()): boolean {
  if (row.status !== "active") return false
  if (row.validFrom && new Date(row.validFrom).getTime() > now.getTime()) return false
  if (row.validUntil && new Date(row.validUntil).getTime() <= now.getTime()) return false
  return true
}

export function pickHighestEntitlement(rows: ResolvedEntitlement[]): ResolvedEntitlement | null {
  const active = rows.filter((r) => isEntitlementActive(r))
  if (active.length === 0) return null
  return [...active].sort((a, b) => {
    const bundle = (BUNDLE_RANK[b.featureBundle] ?? 0) - (BUNDLE_RANK[a.featureBundle] ?? 0)
    if (bundle !== 0) return bundle
    return (SOURCE_RANK[b.entitlementSource] ?? 0) - (SOURCE_RANK[a.entitlementSource] ?? 0)
  })[0]!
}

export function toFeatureAccessResult(
  rows: ResolvedEntitlement[],
  personalTier: string | null,
): FeatureAccessResult {
  const highest = pickHighestEntitlement(rows)
  if (!highest) {
    return {
      allowed: false,
      source: "none",
      institutionId: null,
      licenseId: null,
      scopeType: null,
      scopeId: null,
      expiresAt: null,
      personalTier,
      institutionalEntitlement: null,
      featureBundle: null,
      providedBy: null,
    }
  }
  const institutional =
    highest.entitlementType === "institution_student_access" ||
    highest.entitlementType === "institution_instructor_access"
      ? highest.entitlementType
      : null
  return {
    allowed: true,
    source: highest.entitlementSource,
    institutionId: highest.institutionId ?? null,
    licenseId: highest.licenseId ?? null,
    scopeType: highest.scopeType,
    scopeId: highest.scopeId ?? null,
    expiresAt: highest.validUntil ?? null,
    personalTier,
    institutionalEntitlement: institutional,
    featureBundle: highest.featureBundle,
    providedBy: typeof highest.metadata?.providedBy === "string" ? highest.metadata.providedBy : null,
  }
}

export function personalStudentBundle(tier: string | null | undefined): FeatureBundleId {
  if (tier === "Trailblazer") return "student_trailblazer"
  if (tier === "Explorer") return "student_explorer"
  return "student_scholar"
}

export function personalInstructorBundle(tier: string | null | undefined): FeatureBundleId {
  if (tier === "Teams") return "instructor_teams"
  if (tier === "Pro") return "instructor_pro"
  return "instructor_free"
}
