import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const [comment] = await sql`
      UPDATE lecture_comments
      SET likes = likes + 1
      WHERE id = ${params.id}
      RETURNING *
    `

    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }

    return NextResponse.json(comment)
  } catch (error) {
    console.error("Error liking comment:", error)
    return NextResponse.json({ error: "Failed to like comment" }, { status: 500 })
  }
}
