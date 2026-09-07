import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAdminId } from "@/lib/admin-api-auth"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest,
  { params }: { params: Promise<{ id: string }> },) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { id } = await params
    const body = await request.json()
    const { student_id, full_name, section, course_id, session_id } = body

    if (!student_id || !full_name) {
      return NextResponse.json({ error: "Student ID and full name are required" }, { status: 400 })
    }

    const existing = await sql`
      SELECT id FROM students WHERE student_id = ${student_id} AND id != ${id}
    `
    if (existing.length > 0) {
      return NextResponse.json({ error: "Student ID already exists" }, { status: 409 })
    }

    let sessionId: number | null = null
    let sectionStored = section?.trim() || ""
    let courseId: number | null = course_id != null ? Number(course_id) : null

    if (session_id && session_id !== "none") {
      const sid = Number(session_id)
      const sessRows = await sql`
        SELECT id, code, course_id FROM sessions WHERE id = ${sid} LIMIT 1
      `
      if (sessRows.length === 0) {
        return NextResponse.json({ error: "Section not found" }, { status: 404 })
      }
      const sess = sessRows[0] as { id: number; code: string; course_id: number | null }
      sessionId = sess.id
      sectionStored = sess.code
      if (courseId == null && sess.course_id != null) courseId = sess.course_id
      if (courseId != null && sess.course_id != null && sess.course_id !== courseId) {
        return NextResponse.json({ error: "Section does not belong to the selected course" }, { status: 400 })
      }
    } else if (section) {
      const variants = normalizedSectionVariantsForSql(section)
      const sessionResult =
        variants.length > 0
          ? await sql`
              SELECT id, code, course_id FROM sessions
              WHERE TRIM(code) = ANY(${variants}::text[])
              ORDER BY code
              LIMIT 1
            `
          : []
      if (sessionResult.length > 0) {
        sessionId = (sessionResult[0] as { id: number }).id
        sectionStored = String((sessionResult[0] as { code: string }).code)
        const sessCourse = (sessionResult[0] as { course_id: number | null }).course_id
        if (courseId == null && sessCourse != null) courseId = sessCourse
      } else {
        sectionStored = section
      }
    }

    const result = await sql`
      UPDATE students
      SET
        student_id = ${student_id},
        full_name = ${full_name},
        section = ${sectionStored},
        session_id = ${sessionId},
        course_id = COALESCE(${courseId}, course_id)
      WHERE id = ${id}
      RETURNING id, student_id, full_name, section, session_id, course_id, created_at
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    return NextResponse.json({ student: result[0] })
  } catch (error) {
    console.error("[admin/students PATCH]", error)
    return NextResponse.json({ error: "Failed to update student" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest,
  { params }: { params: Promise<{ id: string }> },) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { id } = await params

    const result = await sql`
      DELETE FROM students WHERE id = ${id}
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/students DELETE]", error)
    return NextResponse.json({ error: "Failed to delete student" }, { status: 500 })
  }
}
