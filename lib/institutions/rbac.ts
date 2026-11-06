import { NextResponse, type NextRequest } from "next/server"
import { requireInstitutionAdmin, type InstitutionAdminRole, type InstitutionSession } from "@/lib/institutions/auth"
import { institutionHasPermission, type InstitutionPermission } from "@/lib/institutions/permissions"
import { sql } from "@/lib/db"

export const UNIT_SCOPED_ROLES: readonly InstitutionAdminRole[] = ["college_admin", "department_admin"]

export type InstitutionAdminScope = {
  institutionId: number
  organizationUnitId: number | null
  unitIds: number[]
  scoped: boolean
}

const ROLE_RANK: Record<string, number> = {
  owner: 100,
  institution_admin: 80,
  academic_admin: 70,
  college_admin: 60,
  department_admin: 50,
  institution_it_admin: 45,
  institution_security_admin: 45,
  institution_analytics_admin: 45,
  billing_admin: 40,
  research_admin: 40,
  analytics_viewer: 20,
}

export function institutionRoleRank(role: string | null | undefined): number {
  return ROLE_RANK[String(role ?? "")] ?? 0
}

/** Least-privilege role assignment: cannot grant a role at or above your own, except owner. */
export function canAssignInstitutionRole(actorRole: string, targetRole: string): boolean {
  const target = String(targetRole ?? "").trim()
  if (target === "faculty" || target === "student") return true
  if (!(target in ROLE_RANK)) return false
  if (actorRole === "owner") return true
  if (target === "owner") return false
  return institutionRoleRank(actorRole) > institutionRoleRank(target)
}

export function targetUnitIsDescendantOf(
  units: Array<{ id: number; parentId: number | null; institutionId: number }>,
  adminUnitId: number,
  targetUnitId: number,
  institutionId: number,
): boolean {
  if (adminUnitId === targetUnitId) {
    const self = units.find((row) => row.id === targetUnitId)
    return self != null && self.institutionId === institutionId
  }
  const byId = new Map(units.map((row) => [row.id, row]))
  let current = byId.get(targetUnitId)
  const seen = new Set<number>()
  while (current) {
    if (current.institutionId !== institutionId) return false
    if (current.id === adminUnitId) return true
    if (current.parentId == null) return false
    if (seen.has(current.id)) return false
    seen.add(current.id)
    current = byId.get(current.parentId)
  }
  return false
}

export function collectUnitSubtreeIds(
  units: Array<{ id: number; parentId: number | null; institutionId: number }>,
  rootUnitId: number,
  institutionId: number,
): number[] {
  const root = units.find((row) => row.id === rootUnitId && row.institutionId === institutionId)
  if (!root) return []
  const ids = new Set<number>([root.id])
  let grew = true
  while (grew) {
    grew = false
    for (const unit of units) {
      if (unit.institutionId !== institutionId) continue
      if (unit.parentId != null && ids.has(unit.parentId) && !ids.has(unit.id)) {
        ids.add(unit.id)
        grew = true
      }
    }
  }
  return [...ids]
}

export function courseIsInAdminScope(
  scope: InstitutionAdminScope,
  course: { universityId: number | null; organizationUnitId: number | null },
): boolean {
  if (course.universityId !== scope.institutionId) return false
  if (!scope.scoped) return true
  if (course.organizationUnitId == null) return false
  return scope.unitIds.includes(course.organizationUnitId)
}

export async function getOrganizationUnitSubtree(
  institutionId: number,
  unitId: number,
): Promise<number[]> {
  const id = Math.trunc(Number(unitId))
  const inst = Math.trunc(Number(institutionId))
  if (!Number.isFinite(id) || id < 1 || !Number.isFinite(inst) || inst < 1) return []
  const rows = (await sql`
    WITH RECURSIVE tree AS (
      SELECT id, parent_unit_id, institution_id
      FROM organization_units
      WHERE id = ${id} AND institution_id = ${inst}
      UNION ALL
      SELECT child.id, child.parent_unit_id, child.institution_id
      FROM organization_units child
      INNER JOIN tree ON child.parent_unit_id = tree.id
      WHERE child.institution_id = ${inst}
    )
    SELECT id FROM tree
  `) as { id: number }[]
  return rows.map((row) => Number(row.id)).filter((n) => Number.isFinite(n) && n > 0)
}

export async function resolveInstitutionAdminScope(
  session: InstitutionSession,
): Promise<InstitutionAdminScope> {
  const scoped = (UNIT_SCOPED_ROLES as readonly string[]).includes(session.role)
  const organizationUnitId = session.organizationUnitId
  if (!scoped || organizationUnitId == null) {
    return {
      institutionId: session.institutionId,
      organizationUnitId,
      unitIds: [],
      scoped: false,
    }
  }
  const unitIds = await getOrganizationUnitSubtree(session.institutionId, organizationUnitId)
  return {
    institutionId: session.institutionId,
    organizationUnitId,
    unitIds,
    scoped: unitIds.length > 0,
  }
}

export async function canAccessOrganizationUnit(
  session: InstitutionSession,
  targetUnitId: number,
): Promise<boolean> {
  const scope = await resolveInstitutionAdminScope(session)
  const rows = (await sql`
    SELECT id, institution_id FROM organization_units WHERE id = ${targetUnitId} LIMIT 1
  `) as { id: number; institution_id: number }[]
  const unit = rows[0]
  if (!unit || Number(unit.institution_id) !== session.institutionId) return false
  if (!scope.scoped) return true
  return scope.unitIds.includes(Number(unit.id))
}

export async function canAccessInstitutionCourse(
  session: InstitutionSession,
  courseId: number,
): Promise<boolean> {
  const scope = await resolveInstitutionAdminScope(session)
  const rows = (await sql`
    SELECT university_id, organization_unit_id FROM courses WHERE id = ${courseId} LIMIT 1
  `) as { university_id: number | null; organization_unit_id: number | null }[]
  const course = rows[0]
  if (!course) return false
  return courseIsInAdminScope(scope, {
    universityId: course.university_id != null ? Number(course.university_id) : null,
    organizationUnitId: course.organization_unit_id != null ? Number(course.organization_unit_id) : null,
  })
}

export function unitTypeCompatibleWithRole(role: string, unitType: string | null | undefined): boolean {
  const type = String(unitType ?? "").trim().toLowerCase()
  if (!type) return true
  if (role === "college_admin") return type === "college" || type === "school"
  if (role === "department_admin") return type === "department" || type === "program"
  return true
}

export async function organizationUnitAssignableToRole(
  institutionId: number,
  unitId: number,
  role: string,
): Promise<boolean> {
  const rows = (await sql`
    SELECT unit_type, institution_id FROM organization_units WHERE id = ${unitId} LIMIT 1
  `) as { unit_type: string | null; institution_id: number }[]
  const unit = rows[0]
  if (!unit || Number(unit.institution_id) !== institutionId) return false
  return unitTypeCompatibleWithRole(role, unit.unit_type)
}

export async function resolveMetricOrganizationUnitIds(
  scope: InstitutionAdminScope,
  requestedUnitId: number | null,
): Promise<number[] | null> {
  if (scope.scoped) return scope.unitIds
  if (requestedUnitId != null && Number.isFinite(requestedUnitId) && requestedUnitId > 0) {
    return getOrganizationUnitSubtree(scope.institutionId, requestedUnitId)
  }
  return null
}

export async function requireInstitutionPermission(
  request: NextRequest,
  permission: InstitutionPermission,
): Promise<
  | { ok: true; session: InstitutionSession; scope: InstitutionAdminScope }
  | { ok: false; response: NextResponse }
> {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth
  if (!institutionHasPermission(auth.session.role, permission)) {
    return { ok: false, response: NextResponse.json({ error: "Not authorized" }, { status: 403 }) }
  }
  const scope = await resolveInstitutionAdminScope(auth.session)
  return { ok: true, session: auth.session, scope }
}
