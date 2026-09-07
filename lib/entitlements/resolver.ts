import { sql } from "@/lib/db"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import {
  getPersonalMembershipTier,
  hasActiveDonationTrial,
  hasActiveTrial,
  isBetaUser,
} from "@/lib/membership"
import { getInstructorMembership } from "@/lib/instructor-membership"
import { membershipAssessmentBenefitsAllowedForStudent } from "@/lib/assessment-privilege-governance"
import {
  coveredLicenseToEntitlement,
  findInstructorCoveredLicenses,
  findStudentCoveredLicenses,
} from "@/lib/institutions/coverage"
import {
  personalInstructorBundle,
  personalStudentBundle,
  toFeatureAccessResult,
} from "@/lib/entitlements/merge"
import { bundleGrantsInstructorTeaching, bundleGrantsStudentLearning, studentPlanFeatures } from "@/lib/entitlements/feature-bundles"
import type {
  EffectiveInstructorAccess,
  EffectiveStudentAccess,
  EntitlementContext,
  FeatureAccessResult,
  ResolvedEntitlement,
} from "@/lib/entitlements/types"
import type { MembershipFeatures } from "@/lib/membership-constants"
import type { InstructorMembershipFeatures } from "@/lib/instructor-membership-constants"
import { instructorPlanFeatures } from "@/lib/entitlements/feature-bundles"

async function loadPersistedEntitlements(
  userType: "student" | "instructor",
  userId: number,
): Promise<ResolvedEntitlement[]> {
  try {
    await ensureInstitutionSchema()
    const rows = (await sql`
      SELECT
        id, institution_id, organization_unit_id, license_id, scope_type, scope_id,
        entitlement_type, entitlement_source, feature_bundle, valid_from, valid_until, status, metadata
      FROM user_entitlements
      WHERE user_type = ${userType}
        AND user_id = ${userId}
        AND status = 'active'
        AND (valid_from IS NULL OR valid_from <= NOW())
        AND (valid_until IS NULL OR valid_until > NOW())
    `) as Array<Record<string, unknown>>
    return rows.map((row) => ({
      entitlementId: `persisted:${row.id}`,
      userId,
      institutionId: row.institution_id != null ? Number(row.institution_id) : null,
      organizationUnitId: row.organization_unit_id != null ? Number(row.organization_unit_id) : null,
      licenseId: row.license_id != null ? Number(row.license_id) : null,
      scopeType: (row.scope_type as ResolvedEntitlement["scopeType"]) ?? "user",
      scopeId: row.scope_id != null ? Number(row.scope_id) : null,
      entitlementType: row.entitlement_type as ResolvedEntitlement["entitlementType"],
      entitlementSource: row.entitlement_source as ResolvedEntitlement["entitlementSource"],
      featureBundle: row.feature_bundle as ResolvedEntitlement["featureBundle"],
      validFrom: row.valid_from ? String(row.valid_from) : null,
      validUntil: row.valid_until ? String(row.valid_until) : null,
      status: "active",
      metadata: (row.metadata as Record<string, unknown>) ?? {},
    }))
  } catch {
    return []
  }
}

export async function getEffectiveEntitlements(
  userType: "student" | "instructor",
  userId: number,
  context: EntitlementContext = {},
): Promise<ResolvedEntitlement[]> {
  const persisted = await loadPersistedEntitlements(userType, userId)
  if (userType === "student") {
    const rows: ResolvedEntitlement[] = [...persisted]
    if (await isBetaUser(userId)) {
      rows.push({
        entitlementId: `beta:${userId}`,
        userId,
        scopeType: "user",
        entitlementType: "beta_trailblazer",
        entitlementSource: "beta",
        featureBundle: "student_trailblazer",
        status: "active",
      })
    }
    if (await hasActiveTrial(userId)) {
      rows.push({
        entitlementId: `trial:${userId}`,
        userId,
        scopeType: "user",
        entitlementType: "trial_trailblazer",
        entitlementSource: "trial",
        featureBundle: "student_trailblazer",
        status: "active",
      })
    }
    if (await hasActiveDonationTrial(userId)) {
      rows.push({
        entitlementId: `donation:${userId}`,
        userId,
        scopeType: "user",
        entitlementType: "donation_trailblazer",
        entitlementSource: "donation",
        featureBundle: "student_trailblazer",
        status: "active",
      })
    }
    const personalTier = await getPersonalMembershipTier(userId)
    rows.push({
      entitlementId: `personal-student:${userId}`,
      userId,
      scopeType: "user",
      entitlementType: "personal_student_tier",
      entitlementSource: "personal_purchase",
      featureBundle: personalStudentBundle(personalTier),
      status: "active",
    })
    const licenses = await findStudentCoveredLicenses(userId, context)
    for (const license of licenses) {
      rows.push(coveredLicenseToEntitlement(license, "institution_student_access"))
    }
    return rows
  }

  const membership = await getInstructorMembership(userId)
  const personalTier = membership?.tier ?? "Free"
  const rows: ResolvedEntitlement[] = [
    ...persisted,
    {
      entitlementId: `personal-instructor:${userId}`,
      userId,
      scopeType: "user",
      entitlementType: "personal_instructor_tier",
      entitlementSource: "personal_purchase",
      featureBundle: personalInstructorBundle(personalTier),
      status: "active",
    },
  ]
  const licenses = await findInstructorCoveredLicenses(userId, context)
  for (const license of licenses) {
    rows.push(coveredLicenseToEntitlement(license, "institution_instructor_access"))
  }
  return rows
}

export async function getEffectiveStudentAccess(
  studentId: number,
  context: EntitlementContext = {},
): Promise<EffectiveStudentAccess> {
  const personalTier = await getPersonalMembershipTier(studentId)
  const rows = await getEffectiveEntitlements("student", studentId, context)
  const base = toFeatureAccessResult(rows, personalTier)
  const learning = rows.some(
    (r) => r.status === "active" && bundleGrantsStudentLearning(r.featureBundle),
  )
  const institutional = rows.some(
    (r) => r.entitlementType === "institution_student_access" && r.status === "active",
  )
  const courseAllows =
    context.courseId != null
      ? await membershipAssessmentBenefitsAllowedForStudent(studentId, context.courseId)
      : false
  return {
    ...base,
    allowed: learning || personalTier !== "Scholar",
    personalTier,
    learningFeatures: learning,
    gradedAttemptPerksAllowed: courseAllows,
    institutionalEntitlement: institutional ? "institution_student_access" : base.institutionalEntitlement,
  }
}

export async function getEffectiveInstructorAccess(
  instructorId: number,
  context: EntitlementContext = {},
): Promise<EffectiveInstructorAccess> {
  const membership = await getInstructorMembership(instructorId)
  const personalTier = membership?.tier ?? "Free"
  const rows = await getEffectiveEntitlements("instructor", instructorId, context)
  const base = toFeatureAccessResult(rows, personalTier)
  const teaching = rows.some(
    (r) => r.status === "active" && bundleGrantsInstructorTeaching(r.featureBundle),
  )
  return {
    ...base,
    allowed: teaching || personalTier !== "Free",
    personalTier,
    teachingFeatures: teaching,
  }
}

export async function getEntitlementSources(
  userType: "student" | "instructor",
  userId: number,
  context: EntitlementContext = {},
): Promise<ResolvedEntitlement[]> {
  return getEffectiveEntitlements(userType, userId, context)
}

export async function hasFeatureAccess(
  userType: "student" | "instructor",
  userId: number,
  feature: string,
  context: EntitlementContext = {},
): Promise<FeatureAccessResult> {
  if (userType === "student") {
    const access = await getEffectiveStudentAccess(userId, context)
    const graded = feature === "quizAttempts" || feature === "assessmentRollover" || feature === "saveAndFinishLater"
    if (graded && !access.gradedAttemptPerksAllowed) {
      return { ...access, allowed: false }
    }
    const bundle = access.featureBundle ?? personalStudentBundle(access.personalTier)
    const features = studentPlanFeatures(bundle)
    const value = features[feature as keyof MembershipFeatures]
    const allowed =
      typeof value === "boolean"
        ? value
        : typeof value === "number"
          ? value > 0
          : value === "unlimited"
            ? true
            : Boolean(value)
    return { ...access, allowed }
  }

  const access = await getEffectiveInstructorAccess(userId, context)
  const bundle = access.featureBundle ?? personalInstructorBundle(access.personalTier)
  const features = instructorPlanFeatures(bundle)
  const value = features[feature as keyof InstructorMembershipFeatures]
  const allowed = value === true || value === "unlimited" || (typeof value === "number" && value > 0)
  return { ...access, allowed }
}

export async function studentHasInstitutionalLearningAccess(
  studentId: number,
  courseId?: number | null,
): Promise<boolean> {
  const licenses = await findStudentCoveredLicenses(studentId, { courseId: courseId ?? undefined })
  return licenses.length > 0
}
