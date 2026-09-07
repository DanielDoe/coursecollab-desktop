import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorGroupAccess } from "@/lib/group-request-auth"

export const dynamic = 'force-dynamic'

// POST restore soft-deleted group
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: groupId } = await params

    // Check if group exists and is deleted
    const groupCheck = await sql`
      SELECT id, name, deleted_at, course_id, session FROM groups WHERE id = ${groupId}
    `

    if (groupCheck.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 })
    }

    const group = groupCheck[0]
    const access = await requireInstructorGroupAccess(request, group)
    if (!access.ok) return access.response

    if (!group.deleted_at) {
      return NextResponse.json({ error: "Group is not deleted" }, { status: 400 })
    }

    // Restore the group by clearing deleted_at
    const result = await sql`
      UPDATE groups
      SET deleted_at = NULL,
          deleted_by = NULL
      WHERE id = ${groupId}
        AND deleted_at IS NOT NULL
      RETURNING id, name, deleted_at
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Failed to restore group" }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      group: result[0]
    })
  } catch (error) {
    console.error("[v0] Failed to restore group:", error)
    return NextResponse.json({ error: "Failed to restore group" }, { status: 500 })
  }
}



