import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { openCallId, studentId } = body

    if (!openCallId || !studentId) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 })
    }

    // Verify ownership
    const openCalls = await sql`
      SELECT oc.*, g.created_by as group_leader_id
      FROM group_open_calls oc
      LEFT JOIN groups g ON oc.group_id = g.id
      WHERE oc.id = ${openCallId}
    `

    if (openCalls.length === 0) {
      return NextResponse.json({ ok: false, error: "Open call not found" }, { status: 404 })
    }

    const openCall = openCalls[0]

    // Check if the student owns this open call
    const isOwner = openCall.owner_student_id === studentId || openCall.group_leader_id === studentId

    if (!isOwner) {
      return NextResponse.json(
        { ok: false, error: "You don't have permission to close this open call" },
        { status: 403 },
      )
    }

    await sql`
      UPDATE group_open_calls
      SET status = 'closed'
      WHERE id = ${openCallId}
    `

    return NextResponse.json({ ok: true, data: { message: "Open call closed successfully" } })
  } catch (error) {
    console.error("[v0] Failed to close open call:", error)
    return NextResponse.json({ ok: false, error: "Failed to close open call" }, { status: 500 })
  }
}
