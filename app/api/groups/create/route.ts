import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { assertGroupSizeWithinPolicy, assertStudentSelfFormAllowed } from "@/lib/project-policy-enforcement"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, session, createdBy } = body

    if (!name || !session || !createdBy) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    const studentCheck = await sql`
      SELECT id, section, student_id, full_name, session_id FROM students WHERE id = ${createdBy}
    `

    if (studentCheck.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    if (studentCheck[0].section !== session) {
      return NextResponse.json({ error: "Student does not belong to this session" }, { status: 403 })
    }

    const studentDbId = studentCheck[0].id
    const sessionRow = await sql`
      SELECT course_id FROM sessions WHERE id = ${(studentCheck[0] as { session_id: number }).session_id} LIMIT 1
    `
    const courseIdForGroup = (sessionRow[0] as { course_id?: number | null } | undefined)?.course_id ?? null

    const selfForm = await assertStudentSelfFormAllowed(courseIdForGroup, false)
    if (!selfForm.ok) return selfForm.response
    const size = await assertGroupSizeWithinPolicy(courseIdForGroup, 1)
    if (!size.ok) return size.response

    // Auto-approve individual groups (this endpoint creates groups with just the creator)
    // so students can immediately create projects
    const groupResult = await sql`
      INSERT INTO groups (name, session, created_by, status, course_id)
      VALUES (${name}, ${session}, ${studentDbId}, 'approved', ${courseIdForGroup})
      RETURNING id, name, session, created_by, created_at, status
    `

    const group = groupResult[0]

    // Add creator as the first member
    await sql`
      INSERT INTO group_members (group_id, student_id)
      VALUES (${group.id}, ${studentDbId})
      RETURNING id, group_id, student_id, joined_at
    `

    return NextResponse.json({ group })
  } catch (error) {
    console.error("[SERVER] [v0] Failed to create group - ERROR:", error)
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 })
  }
}
