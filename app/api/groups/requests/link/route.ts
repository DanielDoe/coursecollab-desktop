import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fromStudentId, toStudentId, session } = body

    if (!fromStudentId || !toStudentId || !session) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 })
    }

    const sessionVariants = normalizedSectionVariantsForSql(session)
    const fromEnrolled = await sql`
      SELECT sess.code FROM students st
      JOIN sessions sess ON sess.id = st.session_id
      WHERE st.id = ${fromStudentId}
    `
    const sessionForRow = String(fromEnrolled[0]?.code ?? "").trim() || session

    // Check if either student is already in a group
    const existingMemberships = await sql`
      SELECT gm.student_id, g.session
      FROM group_members gm
      JOIN groups g ON gm.group_id = g.id
      WHERE gm.student_id IN (${fromStudentId}, ${toStudentId})
        AND TRIM(g.session) = ANY(${sessionVariants}::text[])
    `

    if (existingMemberships.length > 0) {
      return NextResponse.json({ ok: false, error: "One or both students are already in a group" }, { status: 400 })
    }

    // Check if request already exists
    const existingRequest = await sql`
      SELECT id FROM student_link_requests
      WHERE from_student_id = ${fromStudentId}
        AND to_student_id = ${toStudentId}
        AND TRIM(session) = ANY(${sessionVariants}::text[])
        AND status = 'pending'
    `

    if (existingRequest.length > 0) {
      return NextResponse.json(
        { ok: false, error: "You already have a pending request to this student" },
        { status: 400 },
      )
    }

    // Create the link request
    await sql`
      INSERT INTO student_link_requests (from_student_id, to_student_id, session, status)
      VALUES (${fromStudentId}, ${toStudentId}, ${sessionForRow}, 'pending')
    `

    return NextResponse.json({ ok: true, data: { message: "Link request sent successfully" } })
  } catch (error) {
    console.error("[v0] Failed to create link request:", error)
    return NextResponse.json({ ok: false, error: "Failed to create link request" }, { status: 500 })
  }
}
