import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAdminId } from "@/lib/admin-api-auth"
import { ensurePortalRbacSchema } from "@/lib/ensure-portal-rbac-schema"
import { ensureInstructorRoleColumns } from "@/lib/ensure-instructor-role-columns"
import { normalizeCourseStaffRole } from "@/lib/roles"
import {
  facultyAccountToPrimaryRole,
  primaryRoleFromPlatform,
  resolveDisplayPrimaryRole,
  type CourseAssignment,
  type DirectoryPrimaryRole,
  type UserKind,
} from "@/lib/user-directory"

export const dynamic = "force-dynamic"

export type DirectoryUserRow = {
  key: string
  userKind: UserKind
  id: number
  displayName: string
  username: string
  email: string | null
  accountRole: string
  primaryRole: DirectoryPrimaryRole
  isActive: boolean
  lastLogin: string | null
  supervisorName: string | null
  courseAssignments: CourseAssignment[]
  hasPermissionOverrides: boolean
  section?: string | null
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    await ensurePortalRbacSchema()
    await ensureInstructorRoleColumns()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")?.trim().toLowerCase() ?? ""
    const roleFilter = searchParams.get("role")?.trim().toUpperCase() ?? "ALL"
    const kindFilter = searchParams.get("kind")?.trim().toLowerCase() ?? "all"
    const page = Math.max(1, Number(searchParams.get("page") ?? 1))
    const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("pageSize") ?? 50)))
    const includeStudents = searchParams.get("includeStudents") !== "0"
    const shouldLoadStudentRows =
      includeStudents &&
      (kindFilter === "student" ||
        (kindFilter === "all" && (roleFilter === "ALL" || roleFilter === "STUDENT")))

    const users: DirectoryUserRow[] = []

    if (kindFilter === "all" || kindFilter === "platform") {
      const admins = await sql`
        SELECT id, username, email, COALESCE(role, 'PLATFORM_ADMIN') AS role
        FROM admin_users
        ORDER BY username ASC
      `
      for (const a of admins as {
        id: number
        username: string
        email: string | null
        role: string
      }[]) {
        const primaryRole = primaryRoleFromPlatform(a.role)
        users.push({
          key: `platform:${a.id}`,
          userKind: "platform",
          id: a.id,
          displayName: a.username,
          username: a.username,
          email: a.email,
          accountRole: a.role,
          primaryRole,
          isActive: true,
          lastLogin: null,
          supervisorName: null,
          courseAssignments: [],
          hasPermissionOverrides: false,
        })
      }
    }

    if (kindFilter === "all" || kindFilter === "faculty") {
      const faculty = await sql`
        SELECT
          i.id,
          i.username,
          i.email,
          i.name,
          COALESCE(i.role, 'instructor') AS role,
          COALESCE(i.is_active, true) AS is_active,
          i.last_login,
          sup.name AS supervisor_name
        FROM instructors i
        LEFT JOIN instructors sup ON sup.id = i.assigned_instructor_id
        ORDER BY i.name ASC NULLS LAST, i.username ASC
      `

      const staffRows = await sql`
        SELECT
          cs.instructor_id,
          cs.course_id,
          cs.role,
          c.course_code,
          c.course_title,
          EXISTS (
            SELECT 1 FROM course_staff_permissions csp
            WHERE csp.course_staff_id = cs.id
          ) AS has_overrides
        FROM course_staff cs
        INNER JOIN courses c ON c.id = cs.course_id
        WHERE cs.is_active = true AND c.is_active = true
      `

      const assignmentsByInstructor = new Map<number, CourseAssignment[]>()
      const overridesByInstructor = new Map<number, boolean>()
      for (const row of staffRows as {
        instructor_id: number
        course_id: number
        role: string
        course_code: string
        course_title: string
        has_overrides: boolean
      }[]) {
        const norm = normalizeCourseStaffRole(row.role)
        if (!norm) continue
        const list = assignmentsByInstructor.get(row.instructor_id) ?? []
        list.push({
          courseId: row.course_id,
          courseCode: row.course_code,
          courseTitle: row.course_title,
          staffRole: norm,
        })
        assignmentsByInstructor.set(row.instructor_id, list)
        if (row.has_overrides) overridesByInstructor.set(row.instructor_id, true)
      }

      for (const f of faculty as {
        id: number
        username: string
        email: string
        name: string
        role: string
        is_active: boolean
        last_login: string | null
        supervisor_name: string | null
      }[]) {
        const courseAssignments = assignmentsByInstructor.get(f.id) ?? []
        const primaryRole = resolveDisplayPrimaryRole("faculty", f.role, courseAssignments)
        users.push({
          key: `faculty:${f.id}`,
          userKind: "faculty",
          id: f.id,
          displayName: f.name || f.username,
          username: f.username,
          email: f.email,
          accountRole: f.role,
          primaryRole,
          isActive: f.is_active,
          lastLogin: f.last_login,
          supervisorName: f.supervisor_name,
          courseAssignments,
          hasPermissionOverrides: overridesByInstructor.get(f.id) ?? false,
        })
      }
    }

    let studentTotal = 0
    if (includeStudents && (kindFilter === "all" || kindFilter === "student")) {
      const countRows = await sql`SELECT COUNT(*)::int AS n FROM students`
      studentTotal = (countRows[0] as { n: number }).n
    }

    if (shouldLoadStudentRows) {
      const offset = (page - 1) * pageSize
      const students = await sql`
        SELECT id, student_id, full_name, email, section, true AS is_active
        FROM students
        ORDER BY full_name ASC NULLS LAST, student_id ASC
        LIMIT ${pageSize} OFFSET ${offset}
      `
      for (const s of students as {
        id: number
        student_id: string
        full_name: string
        email: string | null
        section: string | null
        is_active: boolean
      }[]) {
        users.push({
          key: `student:${s.id}`,
          userKind: "student",
          id: s.id,
          displayName: s.full_name || s.student_id,
          username: s.student_id,
          email: s.email,
          accountRole: "student",
          primaryRole: "STUDENT",
          isActive: s.is_active,
          lastLogin: null,
          supervisorName: null,
          courseAssignments: [],
          section: s.section,
          hasPermissionOverrides: false,
        })
      }
    }

    let filtered = users
    if (roleFilter && roleFilter !== "ALL") {
      filtered = filtered.filter((u) => u.primaryRole === roleFilter)
    }
    if (search) {
      filtered = filtered.filter(
        (u) =>
          u.displayName.toLowerCase().includes(search) ||
          u.username.toLowerCase().includes(search) ||
          (u.email?.toLowerCase().includes(search) ?? false),
      )
    }

    const roleCounts: Record<string, number> = {}
    for (const u of users) {
      roleCounts[u.primaryRole] = (roleCounts[u.primaryRole] ?? 0) + 1
    }

    const paginated =
      kindFilter === "student" || (includeStudents && kindFilter === "all")
        ? filtered
        : filtered.slice(0, 500)

    return NextResponse.json({
      users: paginated,
      stats: {
        total: users.length,
        filtered: filtered.length,
        studentTotal,
        byRole: roleCounts,
      },
      page,
      pageSize,
    })
  } catch (error) {
    console.error("[admin/users/directory]", error)
    return NextResponse.json({ error: "Failed to load user directory" }, { status: 500 })
  }
}
