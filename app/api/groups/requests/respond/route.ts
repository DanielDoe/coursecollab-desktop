import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { createNotification } from "@/lib/create-notification"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { requestId, action, leaderId } = body

    if (!requestId || !action || !leaderId) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 })
    }

    if (!["accept", "reject"].includes(action)) {
      return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 })
    }

    // Get the request details
    const requests = await sql`
      SELECT gjr.*, g.created_by
      FROM group_join_requests gjr
      JOIN groups g ON gjr.group_id = g.id
      WHERE gjr.id = ${requestId}
    `

    if (requests.length === 0) {
      return NextResponse.json({ ok: false, error: "Request not found" }, { status: 404 })
    }

    const joinRequest = requests[0]

    const groupMeta = (await sql`
      SELECT name FROM groups WHERE id = ${joinRequest.group_id} LIMIT 1
    `) as Array<{ name: string }>
    const groupName = groupMeta[0]?.name ?? "your group"
    const groupLink = `/student/dashboard-v2/groups/${joinRequest.group_id}`

    // Verify the requester is the group leader
    if (joinRequest.created_by !== leaderId) {
      return NextResponse.json({ ok: false, error: "Only the group leader can respond to requests" }, { status: 403 })
    }

    if (action === "accept") {
      // Check if student is already in a group
      const existingMembership = await sql`
        SELECT gm.id
        FROM group_members gm
        WHERE gm.student_id = ${joinRequest.requester_student_id}
        LIMIT 1
      `

      if (existingMembership.length > 0) {
        return NextResponse.json({ ok: false, error: "This student is already in a group" }, { status: 400 })
      }

      // Add member to group
      await sql`
        INSERT INTO group_members (group_id, student_id)
        VALUES (${joinRequest.group_id}, ${joinRequest.requester_student_id})
      `

      // Update request status
      await sql`
        UPDATE group_join_requests
        SET status = 'accepted', decided_at = CURRENT_TIMESTAMP
        WHERE id = ${requestId}
      `

      await createNotification({
        studentId: joinRequest.requester_student_id,
        type: "group",
        title: "Group join request accepted",
        message: `You were added to "${groupName}".`,
        link: groupLink,
      }).catch((err) => console.warn("[Groups] accept notification failed:", err))

      return NextResponse.json({ ok: true, data: { message: "Member added successfully" } })
    } else {
      // Reject the request
      await sql`
        UPDATE group_join_requests
        SET status = 'rejected', decided_at = CURRENT_TIMESTAMP
        WHERE id = ${requestId}
      `

      await createNotification({
        studentId: joinRequest.requester_student_id,
        type: "group",
        title: "Group join request declined",
        message: `Your request to join "${groupName}" was declined.`,
        link: "/student/dashboard-v2/groups/discover",
      }).catch((err) => console.warn("[Groups] reject notification failed:", err))

      return NextResponse.json({ ok: true, data: { message: "Request rejected" } })
    }
  } catch (error: any) {
    console.error("[v0] Failed to respond to join request:", error)
    if (error.message?.includes("uq_group_members_student")) {
      return NextResponse.json({ ok: false, error: "This student is already in a group" }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: "Failed to respond to request" }, { status: 500 })
  }
}
