import { type NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const sql = getSQL()

    // Add soft delete columns to quizzes table
    await sql`
      ALTER TABLE quizzes 
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255) DEFAULT NULL
    `

    // Create an index for better performance when querying deleted items
    await sql`
      CREATE INDEX IF NOT EXISTS idx_quizzes_deleted_at ON quizzes(deleted_at)
    `

    return NextResponse.json({
      success: true,
      message: "Soft delete system has been set up successfully. Future deletions can now be recovered.",
      details: {
        columns_added: ["deleted_at", "deleted_by"],
        index_created: "idx_quizzes_deleted_at"
      }
    })
  } catch (error) {
    console.error("[Setup Soft Delete] Failed:", error)
    return NextResponse.json({
      success: false,
      error: "Failed to set up soft delete system",
      details: error
    }, { status: 500 })
  }
}
