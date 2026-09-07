import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const { attemptId } = await request.json()

    if (!attemptId) {
      return NextResponse.json({ error: "Attempt ID required" }, { status: 400 })
    }

    // Restore the quiz attempt by clearing deleted_at
    const result = await sql`
      UPDATE quiz_attempts
      SET deleted_at = NULL, deleted_by = NULL
      WHERE id = ${attemptId}
        AND deleted_at IS NOT NULL
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Attempt not found or already restored" }, { status: 404 })
    }

    console.log(`[Restore] Restored attempt #${attemptId}`)

    return NextResponse.json({
      success: true,
      message: "Quiz attempt restored successfully"
    })
  } catch (error) {
    console.error("[Restore] Error:", error)
    return NextResponse.json(
      { error: "Failed to restore quiz attempt" },
      { status: 500 }
    )
  }
}

