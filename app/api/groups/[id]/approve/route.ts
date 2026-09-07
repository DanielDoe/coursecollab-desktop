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

    // Check if group exists and get its current state
    const groupCheck = await sql`
      SELECT id, name, status, pending_changes, course_id, session FROM groups WHERE id = ${groupId}
    `

    if (groupCheck.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 })
    }

    const group = groupCheck[0]
    const access = await requireInstructorGroupAccess(request, group)
    if (!access.ok) return access.response

    // If there are pending changes, apply them
    if (group.pending_changes) {
      const changes = group.pending_changes as any

      // Update group name if changed
      if (changes.name) {
        await sql`
          UPDATE groups 
          SET name = ${changes.name}
          WHERE id = ${groupId}
        `
      }

      // Handle member changes if present
      if (changes.addMembers && Array.isArray(changes.addMembers)) {
        for (const studentId of changes.addMembers) {
          // First, remove student from any existing group (one group per student rule)
          const existingMembership = await sql`
            SELECT gm.id, gm.group_id, g.name as group_name
            FROM group_members gm
            JOIN groups g ON gm.group_id = g.id
            WHERE gm.student_id = ${studentId}
          `

          if (existingMembership.length > 0) {
            await sql`
              DELETE FROM group_members
              WHERE student_id = ${studentId}
            `
          }

          // Now add to new group
          await sql`
            INSERT INTO group_members (group_id, student_id)
            VALUES (${groupId}, ${studentId})
            ON CONFLICT (group_id, student_id) DO NOTHING
          `
        }
      }

      if (changes.removeMembers && Array.isArray(changes.removeMembers)) {
        for (const studentId of changes.removeMembers) {
          await sql`
            DELETE FROM group_members
            WHERE group_id = ${groupId} AND student_id = ${studentId}
          `
        }
      }
    }

    // Update status to approved and clear pending changes
    await sql`
      UPDATE groups 
      SET status = 'approved', pending_changes = NULL
      WHERE id = ${groupId}
    `

    return NextResponse.json({
      success: true,
      message: "Group approved successfully",
    })
  } catch (error) {
    console.error("[SERVER] [v0] Failed to approve group:", error)
    console.error("[SERVER] [v0] Error details:", error instanceof Error ? error.message : String(error))
    return NextResponse.json({ 
      error: "Failed to approve group",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
