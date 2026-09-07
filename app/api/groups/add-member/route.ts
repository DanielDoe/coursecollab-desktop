import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { assertGroupSizeWithinPolicy } from "@/lib/project-policy-enforcement"

export async function POST(request: NextRequest) {
  try {
    const { groupId, studentId } = await request.json()

    if (!groupId || !studentId) {
      return NextResponse.json({ error: "Group ID and Student ID are required" }, { status: 400 })
    }

    // Verify the group exists
    const groupCheck = await sql`
      SELECT id, session, status, course_id, pending_changes FROM groups WHERE id = ${groupId}
    `

    if (groupCheck.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 })
    }

    const group = groupCheck[0]

    // Verify the student exists and belongs to the same session
    const studentCheck = await sql`
      SELECT id, section, student_id, full_name FROM students WHERE id = ${studentId}
    `

    if (studentCheck.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const student = studentCheck[0]

    if (student.section !== group.session) {
      return NextResponse.json({ error: "Student does not belong to this session" }, { status: 403 })
    }

    // Check if already a member
    const existingMember = await sql`
      SELECT id FROM group_members 
      WHERE group_id = ${groupId} AND student_id = ${studentId}
    `

    if (existingMember.length > 0) {
      return NextResponse.json({ error: "Student is already a member of this group" }, { status: 400 })
    }

    const memberCountRows = await sql`
      SELECT COUNT(*)::int AS count FROM group_members WHERE group_id = ${groupId}
    `
    const pendingAdds = Array.isArray((group as { pending_changes?: { addMembers?: unknown[] } }).pending_changes?.addMembers)
      ? (group as { pending_changes: { addMembers: unknown[] } }).pending_changes.addMembers.length
      : 0
    const nextCount = Number((memberCountRows[0] as { count?: number })?.count ?? 0) + pendingAdds + 1
    const size = await assertGroupSizeWithinPolicy(
      (group as { course_id?: number | null }).course_id ?? null,
      nextCount,
    )
    if (!size.ok) return size.response

    if (group.status === "approved") {
      // Get current pending changes
      const currentGroup = await sql`
        SELECT pending_changes FROM groups WHERE id = ${groupId}
      `

      const pendingChanges = currentGroup[0].pending_changes || {}
      const addMembers = pendingChanges.addMembers || []

      // Add to pending members list
      addMembers.push(studentId)

      const newPendingChanges = JSON.stringify({ ...pendingChanges, addMembers })

      await sql`
        UPDATE groups
        SET status = 'pending_update',
            pending_changes = ${newPendingChanges}::jsonb
        WHERE id = ${groupId}
      `

      return NextResponse.json({
        message: "Member addition submitted for admin approval",
        pending: true,
      })
    }

    // Add the member directly if group is not approved yet
    const memberResult = await sql`
      INSERT INTO group_members (group_id, student_id)
      VALUES (${groupId}, ${studentId})
      RETURNING id, group_id, student_id, joined_at
    `

    return NextResponse.json({ member: memberResult[0] })
  } catch (error) {
    console.error("[v0] Failed to add member:", error)
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 })
  }
}
