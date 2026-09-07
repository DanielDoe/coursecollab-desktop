import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { ensureInstructorRoleColumns } from "@/lib/ensure-instructor-role-columns"
import { ensurePortalRbacSchema } from "@/lib/ensure-portal-rbac-schema"
import { replaceTaCourseStaffAssignments } from "@/lib/course-staff-sync"
import { FACULTY_DEFAULT_PASSWORD } from "@/lib/faculty-default-password"
import { ensureFacultyPasswordColumn, hashFacultyPassword } from "@/lib/faculty-password"
import {
  loadSupervisedTa,
  requireInstructorTaManagement,
} from "@/lib/instructor-ta-api-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireInstructorTaManagement(request)
    if (!auth.ok) return auth.response

    await ensurePortalRbacSchema()

    const rows = await sql`
      SELECT
        i.id,
        i.username,
        i.email,
        i.name,
        COALESCE(i.is_active, true) AS is_active,
        i.created_at,
        i.last_login,
        COALESCE(
          array_agg(DISTINCT c.course_code)
            FILTER (WHERE c.id IS NOT NULL),
          ARRAY[]::text[]
        ) AS course_codes,
        COALESCE(
          array_agg(DISTINCT c.id)
            FILTER (WHERE c.id IS NOT NULL),
          ARRAY[]::int[]
        ) AS assigned_course_ids
      FROM instructors i
      LEFT JOIN course_staff cs
        ON cs.instructor_id = i.id AND cs.is_active = true
      LEFT JOIN courses c
        ON c.id = cs.course_id
        AND c.is_active = true
        AND c.instructor_id = ${auth.instructorId}
      WHERE COALESCE(i.role, 'instructor') = 'ta'
        AND i.assigned_instructor_id = ${auth.instructorId}
      GROUP BY i.id, i.username, i.email, i.name, i.is_active, i.created_at, i.last_login
      ORDER BY i.name ASC, i.username ASC
    `

    return NextResponse.json({ tas: rows })
  } catch (error) {
    console.error("[instructor/teaching-assistants GET]", error)
    return NextResponse.json({ error: "Failed to load teaching assistants" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireInstructorTaManagement(request)
    if (!auth.ok) return auth.response

    await ensureInstructorRoleColumns()

    const body = await request.json()
    const { username, email, name, password, course_ids, is_active } = body

    if (!username?.trim() || !email?.trim() || !name?.trim()) {
      return NextResponse.json({ error: "Username, email, and name are required" }, { status: 400 })
    }

    const initialPassword = await hashFacultyPassword(password?.trim() || FACULTY_DEFAULT_PASSWORD)
    await ensureFacultyPasswordColumn()

    const existing = await sql`
      SELECT id FROM instructors
      WHERE LOWER(username) = LOWER(${username.trim()})
         OR LOWER(email) = LOWER(${email.trim()})
      LIMIT 1
    `
    if (existing.length > 0) {
      return NextResponse.json({ error: "Username or email already exists" }, { status: 409 })
    }

    const inserted = await sql`
      INSERT INTO instructors (
        username, email, name, password, role, is_active,
        assigned_instructor_id, has_changed_password, created_at
      )
      VALUES (
        ${username.trim()},
        ${email.trim()},
        ${name.trim()},
        ${initialPassword},
        'ta',
        ${is_active !== false},
        ${auth.instructorId},
        false,
        NOW()
      )
      RETURNING id, username, email, name, is_active, created_at
    `

    const row = inserted[0] as { id: number }
    try {
      await replaceTaCourseStaffAssignments(row.id, auth.instructorId, course_ids ?? [])
    } catch (e) {
      await sql`DELETE FROM instructors WHERE id = ${row.id}`
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Select at least one of your courses" },
        { status: 400 },
      )
    }

    const ta = await loadSupervisedTa(row.id, auth.instructorId)
    return NextResponse.json({ success: true, ta }, { status: 201 })
  } catch (error) {
    console.error("[instructor/teaching-assistants POST]", error)
    return NextResponse.json({ error: "Failed to create teaching assistant" }, { status: 500 })
  }
}
