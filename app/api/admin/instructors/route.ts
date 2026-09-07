import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAdminId } from "@/lib/admin-api-auth"
import { ensureInstructorRoleColumns } from "@/lib/ensure-instructor-role-columns"
import { ensureFacultyPasswordColumn, hashFacultyPassword } from "@/lib/faculty-password"

export const dynamic = "force-dynamic"

const VALID_ROLES = new Set(["instructor", "ta", "department_admin"])

function normalizeRole(role: unknown): string {
  const r = String(role ?? "instructor").trim().toLowerCase()
  return VALID_ROLES.has(r) ? r : "instructor"
}

async function validateTaSupervisor(supervisorId: number) {
  const rows = await sql`
    SELECT id, name, COALESCE(role, 'instructor') AS role, COALESCE(is_active, true) AS is_active
    FROM instructors WHERE id = ${supervisorId} LIMIT 1
  `
  if (rows.length === 0) return { ok: false as const, error: "Supervising instructor not found" }
  const row = rows[0] as { id: number; name: string; role: string; is_active: boolean }
  if (row.role === "ta") return { ok: false as const, error: "Supervisor must be an instructor account, not a TA" }
  if (!row.is_active) return { ok: false as const, error: "Supervising instructor is inactive" }
  return { ok: true as const, supervisor: row }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    await ensureInstructorRoleColumns()
    const { ensurePortalRbacSchema } = await import("@/lib/ensure-portal-rbac-schema")
    await ensurePortalRbacSchema()

    const { searchParams } = new URL(request.url)
    const role = searchParams.get("role")
    const status = searchParams.get("status")
    const search = searchParams.get("search")?.trim().toLowerCase()

    const rows = await sql`
      SELECT
        i.id,
        i.username,
        i.email,
        i.name,
        COALESCE(i.role, 'instructor') AS role,
        COALESCE(i.is_active, true) AS is_active,
        i.assigned_instructor_id,
        sup.name AS assigned_instructor_name,
        i.created_at,
        i.last_login,
        COUNT(DISTINCT COALESCE(c_staff.id, c_owned.id))::int AS course_count,
        COALESCE(
          array_agg(DISTINCT COALESCE(c_staff.course_code, c_owned.course_code) ORDER BY COALESCE(c_staff.course_code, c_owned.course_code))
            FILTER (WHERE COALESCE(c_staff.id, c_owned.id) IS NOT NULL),
          ARRAY[]::text[]
        ) AS course_codes,
        COALESCE(
          array_agg(DISTINCT c_staff.id ORDER BY c_staff.id)
            FILTER (WHERE c_staff.id IS NOT NULL),
          ARRAY[]::int[]
        ) AS assigned_course_ids
      FROM instructors i
      LEFT JOIN instructors sup ON sup.id = i.assigned_instructor_id
      LEFT JOIN course_staff cs
        ON cs.instructor_id = i.id
        AND cs.is_active = true
        AND COALESCE(i.role, 'instructor') = 'ta'
      LEFT JOIN courses c_staff ON c_staff.id = cs.course_id AND c_staff.is_active = true
      LEFT JOIN courses c_owned
        ON c_owned.instructor_id = i.id
        AND c_owned.is_active = true
        AND COALESCE(i.role, 'instructor') != 'ta'
      GROUP BY
        i.id, i.username, i.email, i.name, i.role, i.is_active,
        i.assigned_instructor_id, sup.name, i.created_at, i.last_login
      ORDER BY i.name ASC NULLS LAST, i.username ASC
    `

    let list = rows as {
      id: number
      username: string
      email: string
      name: string
      role: string
      is_active: boolean
      assigned_instructor_id: number | null
      assigned_instructor_name: string | null
      created_at: string
      last_login: string | null
      course_count: number
      course_codes: string[]
      assigned_course_ids: number[]
    }[]

    if (role && role !== "all") {
      list = list.filter((r) => r.role === role)
    }
    if (status === "active") {
      list = list.filter((r) => r.is_active)
    } else if (status === "inactive") {
      list = list.filter((r) => !r.is_active)
    }
    if (search) {
      list = list.filter(
        (r) =>
          r.name?.toLowerCase().includes(search) ||
          r.username?.toLowerCase().includes(search) ||
          r.email?.toLowerCase().includes(search) ||
          r.assigned_instructor_name?.toLowerCase().includes(search),
      )
    }

    return NextResponse.json({ instructors: list })
  } catch (error) {
    console.error("[admin/instructors GET]", error)
    return NextResponse.json({ error: "Failed to fetch instructors" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    await ensureInstructorRoleColumns()
    await ensureFacultyPasswordColumn()

    const body = await request.json()
    const { username, email, name, password, role, is_active, assigned_instructor_id, course_ids } =
      body

    if (!username?.trim() || !email?.trim() || !name?.trim() || !password?.trim()) {
      return NextResponse.json(
        { error: "Username, email, name, and password are required" },
        { status: 400 },
      )
    }

    const roleNorm = normalizeRole(role)
    const active = is_active !== false

    let supervisorId: number | null = null
    if (roleNorm === "ta") {
      const parsed = Number(assigned_instructor_id)
      if (!Number.isFinite(parsed)) {
        return NextResponse.json(
          { error: "Teaching assistants must be assigned to a supervising instructor" },
          { status: 400 },
        )
      }
      const check = await validateTaSupervisor(parsed)
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })
      supervisorId = parsed
    }

    const existing = await sql`
      SELECT id FROM instructors
      WHERE LOWER(username) = LOWER(${username.trim()})
         OR LOWER(email) = LOWER(${email.trim()})
      LIMIT 1
    `
    if (existing.length > 0) {
      return NextResponse.json({ error: "Username or email already exists" }, { status: 409 })
    }

    const passwordHash = await hashFacultyPassword(String(password))
    const inserted = await sql`
      INSERT INTO instructors (
        username, email, name, password, role, is_active, assigned_instructor_id, has_changed_password, created_at
      )
      VALUES (
        ${username.trim()},
        ${email.trim()},
        ${name.trim()},
        ${passwordHash},
        ${roleNorm},
        ${active},
        ${supervisorId},
        false,
        NOW()
      )
      RETURNING id, username, email, name, role, is_active, assigned_instructor_id, created_at, last_login
    `

    const row = inserted[0] as Record<string, unknown>
    let courseCount = 0
    let courseCodes: string[] = []
    let assignedCourseIds: number[] = []
    if (roleNorm === "ta" && supervisorId != null) {
      const { replaceTaCourseStaffAssignments } = await import("@/lib/course-staff-sync")
      try {
        await replaceTaCourseStaffAssignments(Number(row.id), supervisorId, course_ids)
      } catch (e) {
        await sql`DELETE FROM instructors WHERE id = ${Number(row.id)}`
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Invalid course assignment" },
          { status: 400 },
        )
      }
      const summary = await sql`
        SELECT
          COUNT(*)::int AS course_count,
          COALESCE(array_agg(c.course_code ORDER BY c.course_code), ARRAY[]::text[]) AS course_codes,
          COALESCE(array_agg(c.id ORDER BY c.course_code), ARRAY[]::int[]) AS assigned_course_ids
        FROM course_staff cs
        INNER JOIN courses c ON c.id = cs.course_id AND c.is_active = true
        WHERE cs.instructor_id = ${Number(row.id)} AND cs.is_active = true
      `
      const s = summary[0] as {
        course_count: number
        course_codes: string[]
        assigned_course_ids: number[]
      }
      courseCount = s.course_count
      courseCodes = s.course_codes ?? []
      assignedCourseIds = s.assigned_course_ids ?? []
    }
    return NextResponse.json({
      instructor: {
        ...row,
        course_count: courseCount,
        course_codes: courseCodes,
        assigned_course_ids: assignedCourseIds,
      },
    })
  } catch (error) {
    console.error("[admin/instructors POST]", error)
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 })
  }
}
