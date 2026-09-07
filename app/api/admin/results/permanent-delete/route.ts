import { NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function DELETE(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { attemptId } = await request.json()

    if (!attemptId) {
      return NextResponse.json({ error: "Attempt ID required" }, { status: 400 })
    }

    // Permanently delete the quiz attempt
    const result = await sql`
      DELETE FROM quiz_attempts
      WHERE id = ${attemptId}
        AND deleted_at IS NOT NULL
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Attempt not found in trash" }, { status: 404 })
    }

    console.log(`[Permanent Delete] Deleted attempt #${attemptId}`)

    return NextResponse.json({
      success: true,
      message: "Quiz attempt permanently deleted"
    })
  } catch (error) {
    console.error("[Permanent Delete] Error:", error)
    return NextResponse.json(
      { error: "Failed to permanently delete quiz attempt" },
      { status: 500 }
    )
  }
}

