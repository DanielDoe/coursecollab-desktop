import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { ensureInstructorRoleColumns } from "@/lib/ensure-instructor-role-columns"
import { replaceTaCourseStaffAssignments } from "@/lib/course-staff-sync"
import {
  loadSupervisedTa,
  requireInstructorTaManagement,
} from "@/lib/instructor-ta-api-auth"

export const dynamic = "force-dynamic"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireInstructorTaManagement(request)
    if (!auth.ok) return auth.response

    await ensureInstructorRoleColumns()

    const { id } = await params
    const taId = Number(id)
    if (!Number.isFinite(taId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const existing = await loadSupervisedTa(taId, auth.instructorId)
    if (!existing) {
      return NextResponse.json({ error: "Teaching assistant not found" }, { status: 404 })
    }

    const body = await request.json()
    const { username, email, name, password, is_active, course_ids } = body

    if (username?.trim()) {
      const clash = await sql`
        SELECT id FROM instructors
        WHERE LOWER(username) = LOWER(${username.trim()}) AND id != ${taId}
        LIMIT 1
      `
      if (clash.length > 0) {
        return NextResponse.json({ error: "Username already in use" }, { status: 409 })
      }
    }
    if (email?.trim()) {
      const clash = await sql`
        SELECT id FROM instructors
        WHERE LOWER(email) = LOWER(${email.trim()}) AND id != ${taId}
        LIMIT 1
      `
      if (clash.length > 0) {
        return NextResponse.json({ error: "Email already in use" }, { status: 409 })
      }
    }

    await sql`
      UPDATE instructors SET
        username = COALESCE(${username?.trim() ?? null}, username),
        email = COALESCE(${email?.trim() ?? null}, email),
        name = COALESCE(${name?.trim() ?? null}, name),
        password = COALESCE(${password?.trim() ? password : null}, password),
        is_active = COALESCE(${is_active !== undefined ? is_active : null}, is_active)
      WHERE id = ${taId}
    `

    if (course_ids !== undefined) {
      try {
        await replaceTaCourseStaffAssignments(taId, auth.instructorId, course_ids)
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Invalid course assignment" },
          { status: 400 },
        )
      }
    }

    const ta = await loadSupervisedTa(taId, auth.instructorId)
    return NextResponse.json({ success: true, ta })
  } catch (error) {
    console.error("[instructor/teaching-assistants PATCH]", error)
    return NextResponse.json({ error: "Failed to update teaching assistant" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireInstructorTaManagement(request)
    if (!auth.ok) return auth.response

    const { id } = await params
    const taId = Number(id)
    if (!Number.isFinite(taId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 })
    }

    const existing = await loadSupervisedTa(taId, auth.instructorId)
    if (!existing) {
      return NextResponse.json({ error: "Teaching assistant not found" }, { status: 404 })
    }

    await sql`
      UPDATE instructors SET is_active = false WHERE id = ${taId}
    `
    await sql`
      UPDATE course_staff SET is_active = false, updated_at = NOW()
      WHERE instructor_id = ${taId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[instructor/teaching-assistants DELETE]", error)
    return NextResponse.json({ error: "Failed to deactivate teaching assistant" }, { status: 500 })
  }
}
