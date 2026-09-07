import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorGroupAccess } from "@/lib/group-request-auth"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const groupId = Number.parseInt(id)

    if (Number.isNaN(groupId)) {
      return NextResponse.json({ error: "Invalid group ID" }, { status: 400 })
    }

    // Check if group exists
    const groupCheck = await sql`
      SELECT id, name, status, pending_changes, course_id, session FROM groups WHERE id = ${groupId}
    `

    if (groupCheck.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 })
    }

    const group = groupCheck[0]
    const access = await requireInstructorGroupAccess(request, group)
    if (!access.ok) return access.response

    // If this is a new group (status = pending), set to rejected
    // If this is an update (status = pending_update), revert to approved and clear pending changes
    if (group.status === "pending") {
      // Remove group_members so students can join other groups (uq_group_members_student constraint)
      await sql`DELETE FROM group_members WHERE group_id = ${groupId}`

      await sql`
        UPDATE groups 
        SET status = 'rejected'
        WHERE id = ${groupId}
      `
    } else if (group.status === "pending_update") {
      await sql`
        UPDATE groups 
        SET status = 'approved', pending_changes = NULL
        WHERE id = ${groupId}
      `
    } else {
      // Clear any pending changes
      await sql`
        UPDATE groups 
        SET pending_changes = NULL
        WHERE id = ${groupId}
      `
    }

    return NextResponse.json({
      success: true,
      message: "Group rejected successfully",
    })
  } catch (error) {
    console.error("[SERVER] [v0] Failed to reject group:", error)
    return NextResponse.json({ error: "Failed to reject group" }, { status: 500 })
  }
}
