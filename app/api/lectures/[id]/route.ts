import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { week, title, session, description, materials_url, session_access } = body
    const lectureId = params.id

    const result = await sql`
      UPDATE lectures
      SET
        week = COALESCE(${week}, week),
        title = COALESCE(${title}, title),
        session = COALESCE(${session}, session),
        description = COALESCE(${description}, description),
        materials_url = COALESCE(${materials_url}, materials_url),
        session_access = ${session_access !== undefined ? session_access : sql`session_access`},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${lectureId}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 })
    }

    return NextResponse.json({ lecture: result[0] })
  } catch (error) {
    console.error("Failed to update lecture:", error)
    return NextResponse.json({ error: "Failed to update lecture" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const lectureId = params.id

    await sql`DELETE FROM lectures WHERE id = ${lectureId}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete lecture:", error)
    return NextResponse.json({ error: "Failed to delete lecture" }, { status: 500 })
  }
}

