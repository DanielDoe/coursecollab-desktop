import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorGroupAccess } from "@/lib/group-request-auth"
import { applyGroupApproval } from "@/lib/groups/apply-group-approval"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const groupId = Number.parseInt(id)

    if (Number.isNaN(groupId)) {
      return NextResponse.json({ error: "Invalid group ID" }, { status: 400 })
    }

    const groupCheck = await sql`
      SELECT id, name, status, pending_changes, course_id, session FROM groups WHERE id = ${groupId}
    `

    if (groupCheck.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 })
    }

    const group = groupCheck[0]
    const access = await requireInstructorGroupAccess(request, group)
    if (!access.ok) return access.response

    await applyGroupApproval(
      groupId,
      group.pending_changes as { name?: string; addMembers?: number[]; removeMembers?: number[] } | null,
    )

    return NextResponse.json({
      success: true,
      message: "Group approved successfully",
    })
  } catch (error) {
    console.error("[SERVER] [v0] Failed to approve group:", error)
    return NextResponse.json({
      error: "Failed to approve group",
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
