import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

import { cookies } from "next/headers"


export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const cookieStore = await cookies()
    const adminId = cookieStore.get("adminId")?.value

    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { examId, commentId, text } = body

    if (!examId || !commentId || !text) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO exam_comments (exam_id, parent_comment_id, admin_id, text, is_admin_reply)
      VALUES (${examId}, ${commentId}, ${adminId}, ${text}, true)
      RETURNING id, created_at
    `

    return NextResponse.json({ success: true, reply: result[0] })
  } catch (error) {
    console.error("[v0] Error posting admin reply:", error)
    return NextResponse.json({ error: "Failed to post reply" }, { status: 500 })
  }
}
