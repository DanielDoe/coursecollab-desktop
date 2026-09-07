export type EntitlementSource =
  | "personal_purchase"
  | "institution"
  | "college"
  | "department"
  | "program"
  | "course"
  | "grant"
  | "promotion"
  | "trial"
  | "admin_override"
  | "beta"
  | "donation"

export type EntitlementScopeType =
  | "global"
  | "institution"
  | "college"
  | "department"
  | "program"
  | "course"
  | "user"

export type EntitlementStatus = "pending" | "active" | "expired" | "revoked" | "suspended"

export type EntitlementType =
  | "personal_student_tier"
  | "personal_instructor_tier"
  | "institution_student_access"
  | "institution_instructor_access"
  | "trial_trailblazer"
  | "donation_trailblazer"
  | "beta_trailblazer"
  | "grant"
  | "promotion"
  | "admin_override"

export type FeatureBundleId =
  | "student_scholar"
  | "student_explorer"
  | "student_trailblazer"
  | "instructor_free"
  | "instructor_pro"
  | "instructor_teams"
  | "institution_student_access"
  | "institution_instructor_access"

export type EntitlementContext = {
  courseId?: number | null
  organizationUnitId?: number | null
  institutionId?: number | null
}

export type ResolvedEntitlement = {
  entitlementId: string
  userId?: number | null
  institutionId?: number | null
  organizationUnitId?: number | null
  licenseId?: number | null
  scopeType: EntitlementScopeType
  scopeId?: string | number | null
  entitlementType: EntitlementType
  entitlementSource: EntitlementSource
  featureBundle: FeatureBundleId
  validFrom?: string | null
  validUntil?: string | null
  status: EntitlementStatus
  metadata?: Record<string, unknown>
}

export type FeatureAccessResult = {
  allowed: boolean
  source: EntitlementSource | "none"
  institutionId: number | null
  licenseId: number | null
  scopeType: EntitlementScopeType | null
  scopeId: string | number | null
  expiresAt: string | null
  personalTier: string | null
  institutionalEntitlement: EntitlementType | null
  featureBundle: FeatureBundleId | null
  providedBy: string | null
}

export type EffectiveStudentAccess = FeatureAccessResult & {
  personalTier: "Scholar" | "Explorer" | "Trailblazer"
  learningFeatures: boolean
  gradedAttemptPerksAllowed: boolean
}

export type EffectiveInstructorAccess = FeatureAccessResult & {
  personalTier: "Free" | "Pro" | "Teams"
  teachingFeatures: boolean
}
