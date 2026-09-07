import { sql } from "@/lib/db"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { resolveStudentEnrollmentContext } from "@/lib/student-enrollment-context"
import type { EntitlementContext, ResolvedEntitlement } from "@/lib/entitlements/types"

export type CoveredLicense = {
  licenseId: number
  institutionId: number
  institutionName: string
  planId: string
  endDate: string | null
  includedCoraCredits: number | null
  seatLimitStudents: number | null
  scopeType: string
}

type LicenseRow = {
  license_id: number
  institution_id: number
  institution_name: string
  plan_id: string
  end_date: string | null
  included_cora_credits: number | null
  seat_limit_students: number | null
  scope_type: string
}

function toCovered(row: LicenseRow): CoveredLicense {
  return {
    licenseId: Number(row.license_id),
    institutionId: Number(row.institution_id),
    institutionName: String(row.institution_name),
    planId: String(row.plan_id),
    endDate: row.end_date ? String(row.end_date) : null,
    includedCoraCredits: row.included_cora_credits != null ? Number(row.included_cora_credits) : null,
    seatLimitStudents: row.seat_limit_students != null ? Number(row.seat_limit_students) : null,
    scopeType: String(row.scope_type),
  }
}

async function activeLicensesForCourse(courseId: number): Promise<CoveredLicense[]> {
  await ensureInstitutionSchema()
  const rows = (await sql`
    SELECT
      l.id AS license_id,
      l.institution_id,
      u.name AS institution_name,
      l.plan_id,
      l.end_date,
      l.included_cora_credits,
      l.seat_limit_students,
      COALESCE(s.scope_type, l.scope_type) AS scope_type
    FROM institution_licenses l
    JOIN universities u ON u.id = l.institution_id
    LEFT JOIN institution_license_scopes s ON s.license_id = l.id
    WHERE l.status = 'active'
      AND l.contract_status = 'active'
      AND (l.start_date IS NULL OR l.start_date <= CURRENT_DATE)
      AND (l.end_date IS NULL OR l.end_date >= CURRENT_DATE)
      AND (
        l.scope_type = 'institution'
        OR (s.course_id IS NOT NULL AND s.course_id = ${courseId})
        OR (l.scope_type = 'course' AND l.scope_id = ${courseId})
      )
  `) as LicenseRow[]
  return rows.map(toCovered)
}

export async function findStudentCoveredLicenses(
  studentId: number,
  context: EntitlementContext = {},
): Promise<CoveredLicense[]> {
  let courseId = context.courseId ?? null
  if (courseId == null) {
    const enrollment = await resolveStudentEnrollmentContext(studentId)
    courseId = enrollment.courseId
  }
  if (courseId == null || !Number.isFinite(courseId)) return []
  const licenses = await activeLicensesForCourse(courseId)
  if (context.institutionId) {
    return licenses.filter((l) => l.institutionId === context.institutionId)
  }
  return licenses
}

export async function findInstructorCoveredLicenses(
  instructorId: number,
  context: EntitlementContext = {},
): Promise<CoveredLicense[]> {
  await ensureInstitutionSchema()
  if (context.courseId && Number.isFinite(context.courseId)) {
    return activeLicensesForCourse(context.courseId)
  }

  const rows = (await sql`
    SELECT
      l.id AS license_id,
      l.institution_id,
      u.name AS institution_name,
      l.plan_id,
      l.end_date,
      l.included_cora_credits,
      l.seat_limit_students,
      COALESCE(s.scope_type, l.scope_type) AS scope_type
    FROM institution_licenses l
    JOIN universities u ON u.id = l.institution_id
    LEFT JOIN institution_license_scopes s ON s.license_id = l.id
    LEFT JOIN courses c ON c.id = COALESCE(s.course_id, CASE WHEN l.scope_type = 'course' THEN l.scope_id END)
    LEFT JOIN course_staff cs ON cs.course_id = c.id AND cs.instructor_id = ${instructorId} AND cs.is_active = true
    WHERE l.status = 'active'
      AND l.contract_status = 'active'
      AND (l.start_date IS NULL OR l.start_date <= CURRENT_DATE)
      AND (l.end_date IS NULL OR l.end_date >= CURRENT_DATE)
      AND (
        c.instructor_id = ${instructorId}
        OR cs.instructor_id = ${instructorId}
        OR l.scope_type = 'institution'
      )
  `) as LicenseRow[]

  const seen = new Set<number>()
  const out: CoveredLicense[] = []
  for (const row of rows) {
    const id = Number(row.license_id)
    if (seen.has(id)) continue
    seen.add(id)
    out.push(toCovered(row))
  }
  return out
}

export function coveredLicenseToEntitlement(
  license: CoveredLicense,
  type: "institution_student_access" | "institution_instructor_access",
): ResolvedEntitlement {
  return {
    entitlementId: `license:${license.licenseId}:${type}`,
    institutionId: license.institutionId,
    licenseId: license.licenseId,
    scopeType: (license.scopeType as ResolvedEntitlement["scopeType"]) || "course",
    entitlementType: type,
    entitlementSource: "institution",
    featureBundle: type,
    validUntil: license.endDate,
    status: "active",
    metadata: { providedBy: license.institutionName, planId: license.planId },
  }
}
