import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireGroupReadAccess, requireInstructorGroupAccess, studentDbIdFromGroupsRequest } from "@/lib/group-request-auth"

// GET single group with details
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: groupId } = await params

    const groupResult = await sql`
      SELECT 
        g.id,
        g.name,
        g.session,
        g.created_by,
        g.created_at,
        g.status,
        g.pending_changes,
        g.course_id,
        s.full_name as leader_name,
        s.student_id as leader_student_id
      FROM groups g
      JOIN students s ON g.created_by = s.id
      WHERE g.id = ${groupId}
    `

    if (groupResult.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 })
    }

    const group = groupResult[0]
    const access = await requireGroupReadAccess(request, group)
    if (!access.ok) return access.response

    // Get members
    const members = await sql`
      SELECT 
        gm.id as membership_id,
        s.id,
        s.student_id,
        s.full_name,
        gm.joined_at
      FROM group_members gm
      JOIN students s ON gm.student_id = s.id
      WHERE gm.group_id = ${groupId}
      ORDER BY gm.joined_at ASC
    `

    return NextResponse.json({
      group: {
        ...group,
        members,
      },
    })
  } catch (error) {
    console.error("[v0] Failed to fetch group:", error)
    return NextResponse.json({ error: "Failed to fetch group" }, { status: 500 })
  }
}

// DELETE group (soft delete)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: groupId } = await params
    const { searchParams } = new URL(request.url)
    const permanent = searchParams.get("permanent") === "true"

    // Get the group first
    const groupCheck = await sql`
      SELECT id, name, deleted_at, course_id, session, created_by FROM groups WHERE id = ${groupId}
    `

    if (groupCheck.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 })
    }

    const group = groupCheck[0]
    const instructorAccess = await requireInstructorGroupAccess(request, group)
    if (!instructorAccess.ok) {
      const studentDbId = await studentDbIdFromGroupsRequest(request)
      if (studentDbId == null || Number(group.created_by) !== studentDbId) {
        return instructorAccess.response.status === 401
          ? NextResponse.json({ error: "Authentication required" }, { status: 401 })
          : instructorAccess.response
      }
    }

    if (permanent) {
      // Hard delete (permanent removal)
      const result = await sql`
        DELETE FROM groups WHERE id = ${groupId}
        RETURNING id
      `
      return NextResponse.json({ success: true, permanent: true })
    } else {
      // Soft delete (preferred method)
      // Remove group_members so students can join other groups (uq_group_members_student constraint)
      await sql`DELETE FROM group_members WHERE group_id = ${groupId}`

      const result = await sql`
        UPDATE groups
        SET deleted_at = NOW()
        WHERE id = ${groupId}
          AND deleted_at IS NULL
        RETURNING id, name, deleted_at
      `

      if (result.length === 0) {
        // Group might already be deleted
        if (group.deleted_at) {
          return NextResponse.json({ error: "Group is already deleted" }, { status: 400 })
        }
        return NextResponse.json({ error: "Failed to delete group" }, { status: 500 })
      }

      return NextResponse.json({ 
        success: true, 
        permanent: false,
        deleted_at: result[0].deleted_at
      })
    }
  } catch (error) {
    console.error("[v0] Failed to delete group:", error)
    return NextResponse.json({ error: "Failed to delete group" }, { status: 500 })
  }
}

// PATCH update group
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: groupId } = await params
    const { name } = await request.json()

    if (!name) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 })
    }

    const groupCheck = await sql`
      SELECT id, name, status, course_id, session, created_by FROM groups WHERE id = ${groupId}
    `

    if (groupCheck.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 })
    }

    const currentGroup = groupCheck[0]
    const instructorAccess = await requireInstructorGroupAccess(request, currentGroup)
    if (!instructorAccess.ok) {
      const studentDbId = await studentDbIdFromGroupsRequest(request)
      if (studentDbId == null || Number(currentGroup.created_by) !== studentDbId) {
        return instructorAccess.response.status === 401
          ? NextResponse.json({ error: "Authentication required" }, { status: 401 })
          : instructorAccess.response
      }
    }

    // If group is approved, store changes as pending and set status to pending_update
    if (currentGroup.status === "approved") {
      const pendingChanges = JSON.stringify({ name })
      const result = await sql`
        UPDATE groups
        SET status = 'pending_update', 
            pending_changes = ${pendingChanges}::jsonb
        WHERE id = ${groupId}
        RETURNING id, name, session, created_by, created_at, status, pending_changes
      `
      return NextResponse.json({
        group: result[0],
        message: "Update submitted for admin approval",
      })
    }

    // If group is pending or rejected, update directly
    const result = await sql`
      UPDATE groups
      SET name = ${name}
      WHERE id = ${groupId}
      RETURNING id, name, session, created_by, created_at, status
    `

    return NextResponse.json({ group: result[0] })
  } catch (error) {
    console.error("[v0] Failed to update group:", error)
    return NextResponse.json({ error: "Failed to update group" }, { status: 500 })
  }
}
