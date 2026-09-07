import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const threadId = params.id

    const threads = await sql`
      SELECT 
        t.*,
        s.full_name as author_name,
        COALESCE(sr.points, 0) as author_reputation,
        COALESCE(sr.badges, ARRAY[]::text[]) as author_badges
      FROM forum_threads t
      LEFT JOIN students s ON t.student_id = s.id
      LEFT JOIN student_reputation sr ON t.student_id = sr.student_id
      WHERE t.id = ${threadId}
    `

    if (threads.length === 0) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    return NextResponse.json({ thread: threads[0] })
  } catch (error) {
    console.error("Failed to fetch thread:", error)
    return NextResponse.json({ error: "Failed to fetch thread" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const threadId = params.id

    await sql`
      DELETE FROM forum_threads WHERE id = ${threadId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete thread:", error)
    return NextResponse.json({ error: "Failed to delete thread" }, { status: 500 })
  }
}
