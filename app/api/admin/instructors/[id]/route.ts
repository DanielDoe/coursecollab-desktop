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
    SELECT id, COALESCE(role, 'instructor') AS role, COALESCE(is_active, true) AS is_active
    FROM instructors WHERE id = ${supervisorId} LIMIT 1
  `
  if (rows.length === 0) return { ok: false as const, error: "Supervising instructor not found" }
  const row = rows[0] as { role: string; is_active: boolean }
  if (row.role === "ta") return { ok: false as const, error: "Supervisor must be an instructor account, not a TA" }
  if (!row.is_active) return { ok: false as const, error: "Supervising instructor is inactive" }
  return { ok: true as const }
}

async function courseSummaryFor(instructorId: number, role: string) {
  if (role === "ta") {
    const rows = await sql`
      SELECT
        COUNT(*)::int AS course_count,
        COALESCE(array_agg(c.course_code ORDER BY c.course_code), ARRAY[]::text[]) AS course_codes,
        COALESCE(array_agg(c.id ORDER BY c.course_code), ARRAY[]::int[]) AS assigned_course_ids
      FROM course_staff cs
      INNER JOIN courses c ON c.id = cs.course_id AND c.is_active = true
      WHERE cs.instructor_id = ${instructorId} AND cs.is_active = true
    `
    const row = rows[0] as {
      course_count: number
      course_codes: string[]
      assigned_course_ids: number[]
    }
    return {
      course_count: row?.course_count ?? 0,
      course_codes: row?.course_codes ?? [],
      assigned_course_ids: row?.assigned_course_ids ?? [],
    }
  }
  const rows = await sql`
    SELECT
      COUNT(*)::int AS course_count,
      COALESCE(array_agg(course_code ORDER BY course_code), ARRAY[]::text[]) AS course_codes
    FROM courses
    WHERE instructor_id = ${instructorId} AND is_active = true
  `
  const row = rows[0] as { course_count: number; course_codes: string[] }
  return {
    course_count: row?.course_count ?? 0,
    course_codes: row?.course_codes ?? [],
    assigned_course_ids: [] as number[],
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    await ensureInstructorRoleColumns()

    const { id } = await params
    const instructorId = Number(id)
    if (!Number.isFinite(instructorId)) {
      return NextResponse.json({ error: "Invalid instructor id" }, { status: 400 })
    }

    const body = await request.json()
    const { username, email, name, password, role, is_active, assigned_instructor_id, course_ids } =
      body

    const currentRows = await sql`
      SELECT id, username, email, COALESCE(role, 'instructor') AS role, assigned_instructor_id
      FROM instructors WHERE id = ${instructorId} LIMIT 1
    `
    if (currentRows.length === 0) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }
    const current = currentRows[0] as {
      role: string
      assigned_instructor_id: number | null
    }

    const nextRole = role !== undefined ? normalizeRole(role) : current.role

    let nextSupervisor: number | null =
      assigned_instructor_id !== undefined
        ? assigned_instructor_id == null
          ? null
          : Number(assigned_instructor_id)
        : current.assigned_instructor_id

    if (nextRole === "instructor") {
      nextSupervisor = null
    } else if (nextRole === "ta") {
      if (!Number.isFinite(nextSupervisor)) {
        return NextResponse.json(
          { error: "Teaching assistants must be assigned to a supervising instructor" },
          { status: 400 },
        )
      }
      const check = await validateTaSupervisor(nextSupervisor!)
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })
      if (nextSupervisor === instructorId) {
        return NextResponse.json({ error: "A TA cannot supervise themselves" }, { status: 400 })
      }
    }

    if (username || email) {
      const conflict = await sql`
        SELECT id FROM instructors
        WHERE id != ${instructorId}
          AND (
            (${username ?? null}::text IS NOT NULL AND LOWER(username) = LOWER(${username?.trim() ?? ""}))
            OR (${email ?? null}::text IS NOT NULL AND LOWER(email) = LOWER(${email?.trim() ?? ""}))
          )
        LIMIT 1
      `
      if (conflict.length > 0) {
        return NextResponse.json({ error: "Username or email already in use" }, { status: 409 })
      }
    }

    const passwordProvided = Boolean(password?.trim())
    const passwordHash = passwordProvided ? await hashFacultyPassword(String(password).trim()) : null
    await ensureFacultyPasswordColumn()
    const updated = await sql`
      UPDATE instructors SET
        username = COALESCE(${username?.trim() || null}, username),
        email = COALESCE(${email?.trim() || null}, email),
        name = COALESCE(${name?.trim() || null}, name),
        role = ${nextRole},
        is_active = COALESCE(${is_active !== undefined ? Boolean(is_active) : null}, is_active),
        password = COALESCE(${passwordHash}, password),
        has_changed_password = CASE
          WHEN ${passwordProvided} THEN false
          ELSE has_changed_password
        END,
        assigned_instructor_id = ${nextSupervisor}
      WHERE id = ${instructorId}
      RETURNING id, username, email, name, role, is_active, assigned_instructor_id, created_at, last_login
    `

    if (nextRole === "ta" && nextSupervisor != null) {
      const { replaceTaCourseStaffAssignments } = await import("@/lib/course-staff-sync")
      try {
        if (course_ids !== undefined) {
          await replaceTaCourseStaffAssignments(instructorId, nextSupervisor, course_ids)
        } else if (
          current.role !== "ta" ||
          current.assigned_instructor_id !== nextSupervisor
        ) {
          return NextResponse.json(
            { error: "Select at least one course for this teaching assistant" },
            { status: 400 },
          )
        }
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Invalid course assignment" },
          { status: 400 },
        )
      }
    }

    const summary = await courseSummaryFor(instructorId, nextRole)

    return NextResponse.json({
      instructor: {
        ...updated[0],
        ...summary,
      },
    })
  } catch (error) {
    console.error("[admin/instructors PATCH]", error)
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    await ensureInstructorRoleColumns()

    const { id } = await params
    const instructorId = Number(id)
    if (!Number.isFinite(instructorId)) {
      return NextResponse.json({ error: "Invalid instructor id" }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const hard = searchParams.get("hard") === "true"

    const account = await sql`
      SELECT COALESCE(role, 'instructor') AS role, assigned_instructor_id
      FROM instructors WHERE id = ${instructorId} LIMIT 1
    `
    if (account.length === 0) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }
    const acc = account[0] as { role: string; assigned_instructor_id: number | null }

    const courses =
      acc.role === "ta"
        ? [{ n: 0 }]
        : await sql`
            SELECT COUNT(*)::int AS n FROM courses WHERE instructor_id = ${instructorId}
          `
    const courseCount = (courses[0] as { n: number }).n

    const tas = await sql`
      SELECT COUNT(*)::int AS n FROM instructors
      WHERE assigned_instructor_id = ${instructorId} AND COALESCE(role, 'instructor') = 'ta'
    `
    const taCount = (tas[0] as { n: number }).n

    if (hard && (courseCount > 0 || taCount > 0)) {
      return NextResponse.json(
        {
          error:
            courseCount > 0
              ? `Cannot delete: owns ${courseCount} course(s). Deactivate or reassign first.`
              : `Cannot delete: ${taCount} TA(s) are assigned to this instructor. Reassign them first.`,
        },
        { status: 400 },
      )
    }

    if (hard) {
      await sql`UPDATE instructors SET assigned_instructor_id = NULL WHERE assigned_instructor_id = ${instructorId}`
      await sql`DELETE FROM instructors WHERE id = ${instructorId}`
      return NextResponse.json({ success: true, deleted: true })
    }

    await sql`UPDATE instructors SET is_active = false WHERE id = ${instructorId}`
    return NextResponse.json({ success: true, deactivated: true })
  } catch (error) {
    console.error("[admin/instructors DELETE]", error)
    return NextResponse.json({ error: "Failed to remove account" }, { status: 500 })
  }
}
