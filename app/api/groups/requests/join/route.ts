import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { createNotification } from "@/lib/create-notification"
import { assertGroupSizeWithinPolicy, assertStudentSelfFormAllowed } from "@/lib/project-policy-enforcement"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { groupId, requesterStudentId } = body

    if (!groupId || !requesterStudentId) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 })
    }

    const targetGroup = await sql`
      SELECT id, course_id FROM groups WHERE id = ${groupId} LIMIT 1
    `
    if (targetGroup.length === 0) {
      return NextResponse.json({ ok: false, error: "Group not found" }, { status: 404 })
    }
    const joinCourseId = (targetGroup[0] as { course_id?: number | null }).course_id ?? null
    const selfForm = await assertStudentSelfFormAllowed(joinCourseId, false)
    if (!selfForm.ok) return selfForm.response
    const memberCountRows = await sql`
      SELECT COUNT(*)::int AS count FROM group_members WHERE group_id = ${groupId}
    `
    const size = await assertGroupSizeWithinPolicy(
      joinCourseId,
      Number((memberCountRows[0] as { count?: number })?.count ?? 0) + 1,
    )
    if (!size.ok) return size.response

    // One membership row per student globally — only count active groups (not soft-deleted / rejected)
    const existingMembership = await sql`
      SELECT gm.id, g.session
      FROM group_members gm
      JOIN groups g ON gm.group_id = g.id
      WHERE gm.student_id = ${requesterStudentId}
        AND g.deleted_at IS NULL
        AND g.status IN ('pending', 'approved', 'pending_update')
      LIMIT 1
    `

    if (existingMembership.length > 0) {
      return NextResponse.json(
        { ok: false, error: "You're already in a group. Leave your current group to join another." },
        { status: 400 },
      )
    }

    // Check if request already exists
    const existingRequest = await sql`
      SELECT id FROM group_join_requests
      WHERE group_id = ${groupId}
        AND requester_student_id = ${requesterStudentId}
        AND status = 'pending'
    `

    if (existingRequest.length > 0) {
      return NextResponse.json(
        { ok: false, error: "You already have a pending request for this group" },
        { status: 400 },
      )
    }

    // Create the join request
    await sql`
      INSERT INTO group_join_requests (group_id, requester_student_id, status)
      VALUES (${groupId}, ${requesterStudentId}, 'pending')
    `

    const groupInfo = (await sql`
      SELECT g.name, g.created_by, s.full_name AS requester_name
      FROM groups g
      JOIN students s ON s.id = ${requesterStudentId}
      WHERE g.id = ${groupId}
      LIMIT 1
    `) as Array<{ name: string; created_by: number; requester_name: string }>

    if (groupInfo[0]?.created_by) {
      await createNotification({
        studentId: groupInfo[0].created_by,
        type: "group",
        title: "New group join request",
        message: `${groupInfo[0].requester_name} requested to join "${groupInfo[0].name}".`,
        link: `/student/dashboard-v2/groups/${groupId}`,
      }).catch((err) => console.warn("[Groups] join request notification failed:", err))
    }

    return NextResponse.json({ ok: true, data: { message: "Join request sent successfully" } })
  } catch (error: any) {
    console.error("[v0] Failed to create join request:", error)
    // Check for unique constraint violation
    if (error.message?.includes("uq_group_members_student")) {
      return NextResponse.json(
        { ok: false, error: "You're already in a group. Leave your current group to join another." },
        { status: 400 },
      )
    }
    return NextResponse.json({ ok: false, error: "Failed to create join request" }, { status: 500 })
  }
}
