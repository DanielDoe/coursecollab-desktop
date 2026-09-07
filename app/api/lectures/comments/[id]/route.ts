import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const commentId = params.id

    const result = await sql`
      DELETE FROM lecture_comments
      WHERE id = ${commentId}
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete comment:", error)
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const commentId = params.id
    const body = await request.json()
    const { comment } = body

    if (!comment) {
      return NextResponse.json({ error: "Comment text is required" }, { status: 400 })
    }

    const result = await sql`
      UPDATE lecture_comments
      SET comment = ${comment}
      WHERE id = ${commentId}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }

    return NextResponse.json({ comment: result[0] })
  } catch (error) {
    console.error("Failed to update comment:", error)
    return NextResponse.json({ error: "Failed to update comment" }, { status: 500 })
  }
}
