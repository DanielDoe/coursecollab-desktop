import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import {
  checkStudentRecordDeleteAllowed,
  logStudentDataDeleteAudit,
  studentDataDeleteGuardResponse,
} from "@/lib/student-data-protection"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { student_id, full_name, section } = await request.json()

    if (!student_id || !full_name || !section) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    // Check if student_id already exists for a different student
    const existing = await sql`
      SELECT id FROM students WHERE student_id = ${student_id} AND id != ${id}
    `

    if (existing.length > 0) {
      return NextResponse.json({ error: "Student ID already exists" }, { status: 400 })
    }

    const variants = normalizedSectionVariantsForSql(section)
    const sessionResult =
      variants.length > 0
        ? await sql`
            SELECT id, code FROM sessions
            WHERE TRIM(code) = ANY(${variants}::text[])
            ORDER BY CASE WHEN code LIKE 'ELEG%' THEN 0 ELSE 1 END, code
            LIMIT 1
          `
        : []

    const sessionId = sessionResult.length > 0 ? sessionResult[0].id : null
    const sectionStored = sessionResult.length > 0 ? String(sessionResult[0].code) : section

    const result = await sql`
      UPDATE students
      SET student_id = ${student_id}, 
          full_name = ${full_name}, 
          section = ${sectionStored},
          session_id = ${sessionId}
      WHERE id = ${id}
      RETURNING id, student_id, full_name, section, session_id, created_at
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    return NextResponse.json({ student: result[0] })
  } catch (error) {
    console.error("[v0] Failed to update student:", error)
    return NextResponse.json({ error: "Failed to update student" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const confirmPhrase =
      typeof body?.confirmPhrase === "string" ? body.confirmPhrase : null

    const guard = checkStudentRecordDeleteAllowed({
      bulk: false,
      confirmPhrase,
      affectedRowEstimate: 1,
      operation: "Delete student account",
    })
    if (guard.blocked) return studentDataDeleteGuardResponse(guard)

    const result = await sql`
      DELETE FROM students WHERE id = ${id}
      RETURNING id, student_id, full_name
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    await logStudentDataDeleteAudit({
      source: "api:instructor/students/[id]:delete",
      actorType: "instructor",
      entityType: "students",
      entityId: Number(id),
      metadata: { student: result[0] },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to delete student:", error)
    return NextResponse.json({ error: "Failed to delete student" }, { status: 500 })
  }
}

