import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { requestId, action, responderId } = body

    if (!requestId || !action || !responderId) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 })
    }

    if (!["accept", "reject"].includes(action)) {
      return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 })
    }

    // Get the request details
    const requests = await sql`
      SELECT * FROM student_link_requests
      WHERE id = ${requestId}
        AND to_student_id = ${responderId}
        AND status = 'pending'
    `

    if (requests.length === 0) {
      return NextResponse.json({ ok: false, error: "Request not found or already processed" }, { status: 404 })
    }

    const linkRequest = requests[0]
    const sessionVariants = normalizedSectionVariantsForSql(String(linkRequest.session ?? ""))

    if (action === "accept") {
      // Check if either student is now in a group
      const existingMemberships = await sql`
        SELECT gm.student_id, gm.group_id, g.session
        FROM group_members gm
        JOIN groups g ON gm.group_id = g.id
        WHERE gm.student_id IN (${linkRequest.from_student_id}, ${linkRequest.to_student_id})
          AND TRIM(g.session) = ANY(${sessionVariants}::text[])
      `

      if (existingMemberships.length === 0) {
        const enrolled = await sql`
          SELECT sess.code, sess.course_id FROM students st
          JOIN sessions sess ON sess.id = st.session_id
          WHERE st.id = ${linkRequest.from_student_id}
        `
        const sessionForGroup = String(enrolled[0]?.code ?? "").trim() || String(linkRequest.session ?? "")
        const courseIdForGroup = (enrolled[0] as { course_id?: number | null })?.course_id ?? null
        // Neither student is in a group - create a new group
        const newGroup = await sql`
          INSERT INTO groups (name, session, created_by, status, course_id)
          VALUES (
            'Group - ' || (SELECT full_name FROM students WHERE id = ${linkRequest.from_student_id}),
            ${sessionForGroup},
            ${linkRequest.from_student_id},
            'pending',
            ${courseIdForGroup}
          )
          RETURNING id
        `

        const groupId = newGroup[0].id

        // Add both students as members
        await sql`
          INSERT INTO group_members (group_id, student_id)
          VALUES 
            (${groupId}, ${linkRequest.from_student_id}),
            (${groupId}, ${linkRequest.to_student_id})
        `
      } else if (existingMemberships.length === 1) {
        // One student is in a group - add the other
        const existingGroupId = existingMemberships[0].group_id
        const studentInGroup = existingMemberships[0].student_id
        const studentToAdd =
          studentInGroup === linkRequest.from_student_id ? linkRequest.to_student_id : linkRequest.from_student_id

        await sql`
          INSERT INTO group_members (group_id, student_id)
          VALUES (${existingGroupId}, ${studentToAdd})
        `
      } else {
        // Both students are now in groups - conflict
        await sql`
          UPDATE student_link_requests
          SET status = 'rejected', decided_at = CURRENT_TIMESTAMP
          WHERE id = ${requestId}
        `

        return NextResponse.json(
          { ok: false, error: "Both students are now in groups. Request cannot be accepted." },
          { status: 400 },
        )
      }

      // Update request status
      await sql`
        UPDATE student_link_requests
        SET status = 'accepted', decided_at = CURRENT_TIMESTAMP
        WHERE id = ${requestId}
      `

      return NextResponse.json({ ok: true, data: { message: "Link request accepted and group formed" } })
    } else {
      // Reject the request
      await sql`
        UPDATE student_link_requests
        SET status = 'rejected', decided_at = CURRENT_TIMESTAMP
        WHERE id = ${requestId}
      `

      return NextResponse.json({ ok: true, data: { message: "Link request rejected" } })
    }
  } catch (error: any) {
    console.error("[v0] Failed to respond to link request:", error)
    if (error.message?.includes("uq_group_members_student")) {
      return NextResponse.json({ ok: false, error: "One or both students are already in a group" }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: "Failed to respond to link request" }, { status: 500 })
  }
}
