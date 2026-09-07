import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



// GET - List all topics with question counts
export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    console.log("[v0] Fetching topics from question_bank...")

    const topics = await sql`
      SELECT 
        ROW_NUMBER() OVER (ORDER BY topic) as id,
        topic as name,
        NULL as description,
        MIN(created_at) as created_at,
        COUNT(*) as question_count
      FROM question_bank
      WHERE topic IS NOT NULL AND topic != ''
      GROUP BY topic
      ORDER BY topic
    `

    console.log(`[v0] Successfully fetched ${topics.length} topics`)
    return NextResponse.json({ topics })
  } catch (error: any) {
    console.error("[v0] Failed to fetch topics - Database error:", error)
    console.error("[v0] Error details:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
    })
    return NextResponse.json(
      {
        error: "Failed to fetch topics",
        details: error.message,
      },
      { status: 500 },
    )
  }
}

// DELETE - Clear all topics and questions
export async function DELETE(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    // Delete all questions (cascade will handle bank_options)
    await sql`DELETE FROM question_bank`

    return NextResponse.json({ success: true, message: "All topics and questions cleared" })
  } catch (error: any) {
    console.error("[v0] Failed to clear all topics:", error)
    return NextResponse.json({ error: "Failed to clear all topics" }, { status: 500 })
  }
}
