import { sql } from "@/lib/db"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { getActiveInstitutionLicense } from "@/lib/institutions/licenses"

export type OrgTreeNode = {
  id: string
  unitId: number | null
  courseId: number | null
  type: string
  name: string
  code: string | null
  activeStudents: number
  activeCourses: number
  coverage: "covered" | "partial" | "none"
  children: OrgTreeNode[]
}

export async function getInstitutionOrganizationModule(institutionId: number) {
  await ensureInstitutionSchema()
  const license = await getActiveInstitutionLicense(institutionId)
  const licenseId = license ? Number(license.id) : null

  const [units, scopedCourses, summary, admins] = await Promise.all([
    sql`
      SELECT id, parent_unit_id, unit_type, name, code
      FROM organization_units
      WHERE institution_id = ${institutionId}
      ORDER BY name
    `,
    licenseId
      ? sql`
          SELECT DISTINCT c.id, c.course_code, c.course_title, s.organization_unit_id
          FROM institution_license_scopes s
          JOIN courses c ON c.id = s.course_id
          WHERE s.license_id = ${licenseId}
        `
      : Promise.resolve([]),
    sql`
      SELECT
        COUNT(*) FILTER (WHERE unit_type IN ('college', 'school'))::int AS colleges,
        COUNT(*) FILTER (WHERE unit_type = 'department')::int AS departments,
        COUNT(*) FILTER (WHERE unit_type = 'program')::int AS programs
      FROM organization_units WHERE institution_id = ${institutionId}
    `,
    sql`
      SELECT m.id, m.role, m.email, m.status, i.name
      FROM institution_members m
      LEFT JOIN instructors i ON m.user_type = 'instructor' AND i.id = m.user_id
      WHERE m.institution_id = ${institutionId}
        AND m.role IN ('owner', 'institution_admin', 'academic_admin', 'billing_admin', 'department_admin')
        AND m.removed_at IS NULL
      ORDER BY m.role, m.email
    `,
  ])

  const coveredCourseIds = new Set(scopedCourses.map((c) => Number(c.id)))
  const coursesByUnit = new Map<number, typeof scopedCourses>()
  for (const c of scopedCourses) {
    const uid = c.organization_unit_id != null ? Number(c.organization_unit_id) : 0
    if (!coursesByUnit.has(uid)) coursesByUnit.set(uid, [])
    coursesByUnit.get(uid)!.push(c)
  }

  const unitNodes = units.map((u) => {
    const uid = Number(u.id)
    const unitCourses = coursesByUnit.get(uid) ?? []
    const courseChildren: OrgTreeNode[] = unitCourses.map((c) => ({
      id: `course-${c.id}`,
      unitId: null,
      courseId: Number(c.id),
      type: "course",
      name: String(c.course_title ?? c.course_code),
      code: c.course_code ? String(c.course_code) : null,
      activeStudents: 0,
      activeCourses: 1,
      coverage: "covered" as const,
      children: [],
    }))
    return {
      id: `unit-${uid}`,
      unitId: uid,
      courseId: null,
      type: String(u.unit_type),
      name: String(u.name),
      code: u.code ? String(u.code) : null,
      activeStudents: 0,
      activeCourses: unitCourses.length,
      coverage: (unitCourses.length > 0 ? "covered" : "none") as "covered" | "partial" | "none",
      children: courseChildren,
      parentUnitId: u.parent_unit_id != null ? Number(u.parent_unit_id) : null,
    }
  })

  const roots: OrgTreeNode[] = []
  const byId = new Map(unitNodes.map((n) => [n.unitId!, n]))
  for (const node of unitNodes) {
    const parentId = (node as { parentUnitId?: number | null }).parentUnitId
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const orphanCourses = (coursesByUnit.get(0) ?? []).map((c) => ({
    id: `course-${c.id}`,
    unitId: null,
    courseId: Number(c.id),
    type: "course",
    name: String(c.course_title ?? c.course_code),
    code: c.course_code ? String(c.course_code) : null,
    activeStudents: 0,
    activeCourses: 1,
    coverage: "covered" as const,
    children: [],
  }))

  if (orphanCourses.length) {
    roots.push({
      id: "unassigned",
      unitId: null,
      courseId: null,
      type: "group",
      name: "Licensed courses (unassigned to unit)",
      code: null,
      activeStudents: 0,
      activeCourses: orphanCourses.length,
      coverage: "covered",
      children: orphanCourses,
    })
  }

  if (roots.length === 0 && coveredCourseIds.size > 0) {
    roots.push({
      id: "institution-root",
      unitId: null,
      courseId: null,
      type: "institution",
      name: "Licensed coverage",
      code: null,
      activeStudents: 0,
      activeCourses: coveredCourseIds.size,
      coverage: "covered",
      children: orphanCourses,
    })
  }

  return {
    tree: roots,
    flatUnits: units.map((u) => ({
      id: Number(u.id),
      parentUnitId: u.parent_unit_id != null ? Number(u.parent_unit_id) : null,
      type: String(u.unit_type),
      name: String(u.name),
      code: u.code ? String(u.code) : null,
    })),
    summary: {
      colleges: Number(summary[0]?.colleges ?? 0),
      departments: Number(summary[0]?.departments ?? 0),
      programs: Number(summary[0]?.programs ?? 0),
      activeCourses: coveredCourseIds.size,
      administrators: admins.length,
    },
    administrators: admins.map((a) => ({
      id: Number(a.id),
      role: String(a.role),
      email: a.email ? String(a.email) : null,
      name: a.name ? String(a.name) : null,
      status: String(a.status),
    })),
  }
}

export async function getOrganizationUnitDetail(institutionId: number, unitId: number) {
  await ensureInstitutionSchema()
  const rows = await sql`
    SELECT ou.*, parent.name AS parent_name
    FROM organization_units ou
    LEFT JOIN organization_units parent ON parent.id = ou.parent_unit_id
    WHERE ou.institution_id = ${institutionId} AND ou.id = ${unitId}
    LIMIT 1
  `
  if (rows.length === 0) return null
  const u = rows[0]
  const courses = await sql`
    SELECT c.id, c.course_code, c.course_title
    FROM courses c
    JOIN institution_license_scopes s ON s.course_id = c.id
    JOIN institution_licenses l ON l.id = s.license_id
    WHERE l.institution_id = ${institutionId} AND l.status = 'active'
      AND s.organization_unit_id = ${unitId}
  `
  const members = await sql`
    SELECT COUNT(*)::int AS n FROM institution_members
    WHERE institution_id = ${institutionId} AND organization_unit_id = ${unitId} AND removed_at IS NULL
  `
  return {
    id: Number(u.id),
    name: String(u.name),
    code: u.code ? String(u.code) : null,
    type: String(u.unit_type),
    parentName: u.parent_name ? String(u.parent_name) : null,
    activeCourses: courses.length,
    linkedMembers: Number(members[0]?.n ?? 0),
    courses: courses.map((c) => ({
      id: Number(c.id),
      code: String(c.course_code ?? ""),
      title: String(c.course_title ?? ""),
    })),
  }
}
