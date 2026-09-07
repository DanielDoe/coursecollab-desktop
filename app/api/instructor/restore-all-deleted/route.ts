import { type NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const sql = getSQL()

    // First, check if deleted_at column exists
    try {
      await sql`
        ALTER TABLE quizzes 
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255)
      `
    } catch (error) {
      console.log("Columns may already exist or query not supported:", error)
    }

    // Get count of deleted items before restoration
    const beforeCount = await sql`
      SELECT COUNT(*) as count 
      FROM quizzes 
      WHERE deleted_at IS NOT NULL
    `

    // Restore all deleted quizzes
    const result = await sql`
      UPDATE quizzes 
      SET deleted_at = NULL, deleted_by = NULL 
      WHERE deleted_at IS NOT NULL
      RETURNING id, title, assessment_type
    `

    return NextResponse.json({
      success: true,
      message: `Successfully restored ${result.length} quizzes`,
      restored_count: result.length,
      before_count: beforeCount[0]?.count || 0,
      restored_items: result
    })
  } catch (error) {
    console.error("[Restore All] Failed:", error)
    
    // If deleted_at column doesn't exist, quizzes were permanently deleted
    // Return a message explaining this
    return NextResponse.json({
      success: false,
      error: "Unable to restore quizzes. They may have been permanently deleted before the soft-delete system was implemented.",
      message: "The deleted_at column may not exist in your database, which means quizzes were permanently deleted. Unfortunately, they cannot be recovered without a database backup."
    }, { status: 500 })
  }
}
