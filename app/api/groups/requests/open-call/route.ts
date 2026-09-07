import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, message, session, groupId, ownerStudentId } = body

    if (!title || !session) {
      return NextResponse.json({ ok: false, error: "Title and session are required" }, { status: 400 })
    }

    if (!groupId && !ownerStudentId) {
      return NextResponse.json({ ok: false, error: "Either groupId or ownerStudentId is required" }, { status: 400 })
    }

    await sql`
      INSERT INTO group_open_calls (
        group_id, 
        owner_student_id, 
        session, 
        title, 
        message, 
        status
      )
      VALUES (
        ${groupId || null}, 
        ${ownerStudentId || null}, 
        ${session}, 
        ${title}, 
        ${message || null}, 
        'open'
      )
    `

    return NextResponse.json({ ok: true, data: { message: "Open call created successfully" } })
  } catch (error) {
    console.error("[v0] Failed to create open call:", error)
    return NextResponse.json({ ok: false, error: "Failed to create open call" }, { status: 500 })
  }
}
