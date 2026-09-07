import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorGroupAccess } from "@/lib/group-request-auth"

function isGroupsStaff(request: NextRequest): boolean {
  const instructor =
    request.headers.get("authorization") || request.headers.get("x-instructor-id")
  const adminId = request.headers.get("x-admin-id")
  return Boolean(instructor?.trim() || adminId?.trim())
}

type PendingChanges = {
  name?: string
  addMembers?: number[]
  removeMembers?: number[]
}

function reconcilePendingChangesAfterRemoval(
  pending: PendingChanges | null | undefined,
  removedStudentId: number
): PendingChanges | null {
  if (!pending || typeof pending !== "object") return null
  const next: PendingChanges = { ...pending }
  if (Array.isArray(next.removeMembers)) {
    next.removeMembers = next.removeMembers.filter((id) => id !== removedStudentId)
  }
  const hasName = Boolean(next.name && String(next.name).trim())
  const hasAdds = Array.isArray(next.addMembers) && next.addMembers.length > 0
  const hasRemoves = Array.isArray(next.removeMembers) && next.removeMembers.length > 0
  if (!hasName && !hasAdds && !hasRemoves) return null
  return next
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const groupId = body.groupId
    const studentId = body.studentId ?? body.memberId

    if (!groupId || !studentId) {
      return NextResponse.json({ error: "Group ID and Student ID are required" }, { status: 400 })
    }

    const staff = isGroupsStaff(request)

    const groupCheck = await sql`
      SELECT id, created_by, status, pending_changes, course_id, session FROM groups WHERE id = ${groupId}
    `

    if (groupCheck.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 })
    }

    const group = groupCheck[0] as {
      id: number
      created_by: number
      status: string
      pending_changes: PendingChanges | null
      course_id?: number | null
      session?: string | null
    }

    if (staff) {
      const access = await requireInstructorGroupAccess(request, group)
      if (!access.ok && !request.headers.get("x-admin-id")?.trim()) {
        return access.response
      }
    }

    // Students cannot remove themselves as group leader; instructors/admins can reassign or retire the group
    if (!staff && group.created_by === studentId) {
      return NextResponse.json({ error: "Group leader cannot leave the group" }, { status: 403 })
    }

    // Instructor/admin: always remove the row now so the student can join or create another group.
    // (Without this, approved groups only queued pending_update and never deleted from group_members until approve.)
    if (staff && group.created_by === studentId) {
      const successor = await sql`
        SELECT student_id FROM group_members
        WHERE group_id = ${groupId} AND student_id != ${studentId}
        ORDER BY joined_at ASC
        LIMIT 1
      `
      if (successor.length > 0) {
        await sql`
          UPDATE groups SET created_by = ${successor[0].student_id} WHERE id = ${groupId}
        `
      }
    }

    // Students leaving an approved group must DELETE from group_members immediately.
    // The old "pending approval" path only updated pending_changes and left the row in place,
    // so uq_group_members_student still blocked creating or joining another group.

    const result = await sql`
      DELETE FROM group_members
      WHERE group_id = ${groupId} AND student_id = ${studentId}
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Member not found in group" }, { status: 404 })
    }

    const nextPending = reconcilePendingChangesAfterRemoval(group.pending_changes, studentId)
    if (nextPending === null && group.status === "pending_update") {
      await sql`
        UPDATE groups
        SET pending_changes = NULL,
            status = 'approved'
        WHERE id = ${groupId}
      `
    } else if (nextPending !== null) {
      await sql`
        UPDATE groups
        SET pending_changes = ${JSON.stringify(nextPending)}::jsonb
        WHERE id = ${groupId}
      `
    } else if (nextPending === null && group.pending_changes) {
      await sql`
        UPDATE groups
        SET pending_changes = NULL
        WHERE id = ${groupId}
      `
    }

    if (staff && group.created_by === studentId) {
      const remaining = await sql`
        SELECT COUNT(*)::int as c FROM group_members WHERE group_id = ${groupId}
      `
      const count = Number(remaining[0]?.c ?? 0)
      if (count === 0) {
        await sql`
          UPDATE groups
          SET deleted_at = COALESCE(deleted_at, NOW())
          WHERE id = ${groupId}
        `
      }
    }

    return NextResponse.json({ success: true, immediate: true })
  } catch (error) {
    console.error("[v0] Failed to remove member:", error)
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
  }
}

/** Faculty mobile sends POST `{ groupId, memberId }`; students use DELETE `{ groupId, studentId }`. */
export async function POST(request: NextRequest) {
  return DELETE(request)
}
