import { sql } from "@/lib/db"

export class TenantIntegrityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TenantIntegrityError"
  }
}

export function sameInstitutionIds(
  a: number | null | undefined,
  b: number | null | undefined,
): boolean {
  if (a == null || b == null) return false
  const left = Number(a)
  const right = Number(b)
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false
  return Math.trunc(left) === Math.trunc(right)
}

/** A PVAMU department may not have a UH college as parent. */
export function organizationUnitParentMayAttach(
  childInstitutionId: number,
  parentInstitutionId: number | null | undefined,
): boolean {
  return sameInstitutionIds(childInstitutionId, parentInstitutionId)
}

/** Course and organization unit must share an institution when both are set. */
export function courseMayBelongToOrganizationUnit(
  courseUniversityId: number | null | undefined,
  unitInstitutionId: number | null | undefined,
): boolean {
  return sameInstitutionIds(courseUniversityId, unitInstitutionId)
}

/** Institution license cannot scope another institution's course. */
export function licenseMayScopeCourse(
  licenseInstitutionId: number,
  courseUniversityId: number | null | undefined,
): boolean {
  return sameInstitutionIds(licenseInstitutionId, courseUniversityId)
}

export function licenseMayScopeOrganizationUnit(
  licenseInstitutionId: number,
  unitInstitutionId: number | null | undefined,
): boolean {
  return sameInstitutionIds(licenseInstitutionId, unitInstitutionId)
}

export async function assertOrganizationUnitParentSameInstitution(
  institutionId: number,
  parentUnitId: number | null | undefined,
): Promise<void> {
  if (parentUnitId == null) return
  const id = Math.trunc(Number(parentUnitId))
  if (!Number.isFinite(id) || id < 1) {
    throw new TenantIntegrityError("Invalid parent organization unit")
  }
  const rows = (await sql`
    SELECT institution_id FROM organization_units WHERE id = ${id} LIMIT 1
  `) as { institution_id: number }[]
  const parentInstitutionId = rows[0]?.institution_id ?? null
  if (!organizationUnitParentMayAttach(institutionId, parentInstitutionId)) {
    throw new TenantIntegrityError(
      "Organization unit parent must belong to the same institution",
    )
  }
}

export async function assertCourseOrganizationUnitSameInstitution(
  courseUniversityId: number | null | undefined,
  organizationUnitId: number | null | undefined,
): Promise<void> {
  if (organizationUnitId == null) return
  const id = Math.trunc(Number(organizationUnitId))
  if (!Number.isFinite(id) || id < 1) {
    throw new TenantIntegrityError("Invalid organization unit")
  }
  const rows = (await sql`
    SELECT institution_id FROM organization_units WHERE id = ${id} LIMIT 1
  `) as { institution_id: number }[]
  const unitInstitutionId = rows[0]?.institution_id ?? null
  if (!courseMayBelongToOrganizationUnit(courseUniversityId, unitInstitutionId)) {
    throw new TenantIntegrityError(
      "Course organization unit must belong to the same institution as the course",
    )
  }
}

export async function assertLicenseCourseScopesSameInstitution(
  licenseId: number,
  courseIds: number[],
): Promise<void> {
  const ids = [...new Set(courseIds.map((n) => Math.trunc(Number(n))).filter((n) => Number.isFinite(n) && n >= 1))]
  if (ids.length === 0) return
  const licenseRows = (await sql`
    SELECT institution_id FROM institution_licenses WHERE id = ${licenseId} LIMIT 1
  `) as { institution_id: number }[]
  const licenseInstitutionId = licenseRows[0]?.institution_id
  if (licenseInstitutionId == null) {
    throw new TenantIntegrityError("License not found")
  }
  const courseRows = (await sql`
    SELECT id, university_id FROM courses WHERE id = ANY(${ids}::int[])
  `) as { id: number; university_id: number | null }[]
  const byId = new Map(courseRows.map((row) => [Number(row.id), row.university_id]))
  for (const courseId of ids) {
    const universityId = byId.get(courseId)
    if (universityId === undefined) {
      throw new TenantIntegrityError(`Course ${courseId} not found`)
    }
    if (!licenseMayScopeCourse(Number(licenseInstitutionId), universityId)) {
      throw new TenantIntegrityError(
        "Institution license cannot scope a course that belongs to another institution",
      )
    }
  }
}

export async function assertLicenseOrganizationUnitScopesSameInstitution(
  licenseId: number,
  organizationUnitIds: number[],
): Promise<void> {
  const ids = [
    ...new Set(
      organizationUnitIds.map((n) => Math.trunc(Number(n))).filter((n) => Number.isFinite(n) && n >= 1),
    ),
  ]
  if (ids.length === 0) return
  const licenseRows = (await sql`
    SELECT institution_id FROM institution_licenses WHERE id = ${licenseId} LIMIT 1
  `) as { institution_id: number }[]
  const licenseInstitutionId = licenseRows[0]?.institution_id
  if (licenseInstitutionId == null) {
    throw new TenantIntegrityError("License not found")
  }
  const unitRows = (await sql`
    SELECT id, institution_id FROM organization_units WHERE id = ANY(${ids}::int[])
  `) as { id: number; institution_id: number }[]
  const byId = new Map(unitRows.map((row) => [Number(row.id), Number(row.institution_id)]))
  for (const unitId of ids) {
    const unitInstitutionId = byId.get(unitId)
    if (unitInstitutionId == null) {
      throw new TenantIntegrityError(`Organization unit ${unitId} not found`)
    }
    if (!licenseMayScopeOrganizationUnit(Number(licenseInstitutionId), unitInstitutionId)) {
      throw new TenantIntegrityError(
        "Institution license cannot scope an organization unit that belongs to another institution",
      )
    }
  }
}
