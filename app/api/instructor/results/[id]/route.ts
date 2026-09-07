import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getQuizAttemptResult } from "@/lib/quiz-attempt-query-fallback"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { requireInstructorAttemptAccess } = await import("@/lib/instructor-results-auth")
    const { id } = await params
    const access = await requireInstructorAttemptAccess(request, id)
    if (!access.ok) return access.response
    const attemptId = String(access.attemptId)

    console.log("[Delete Result] Soft deleting quiz attempt:", attemptId)

    // First, check if deleted_at column exists
    let hasDeletedAtColumn = false
    try {
      const columnCheck = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'quiz_attempts' 
        AND column_name = 'deleted_at'
      `
      hasDeletedAtColumn = columnCheck.length > 0
    } catch (error) {
      console.log("[Delete Result] Could not check for deleted_at column, assuming it doesn't exist")
    }

    if (hasDeletedAtColumn) {
      // Soft delete: set deleted_at timestamp
      const result = await sql`
        UPDATE quiz_attempts
        SET deleted_at = NOW(), deleted_by = NULL
        WHERE id = ${attemptId}
          AND deleted_at IS NULL
        RETURNING id, deleted_at
      `

      if (result.length === 0) {
        // Check if already deleted
        const checkDeleted = await sql`
          SELECT id, deleted_at 
          FROM quiz_attempts 
          WHERE id = ${attemptId}
        `
        if (checkDeleted.length === 0) {
          return NextResponse.json({ error: "Quiz attempt not found" }, { status: 404 })
        }
        if (checkDeleted[0].deleted_at) {
          return NextResponse.json({ 
            error: "Quiz attempt already deleted",
            message: "This result has already been moved to the trash"
          }, { status: 400 })
        }
        return NextResponse.json({ error: "Quiz attempt not found or already deleted" }, { status: 404 })
      }

      console.log("[Delete Result] Successfully soft deleted quiz attempt:", attemptId, "deleted_at:", result[0]?.deleted_at)
      
      // Verify the deletion was successful
      const verifyDelete = await sql`
        SELECT id, deleted_at 
        FROM quiz_attempts 
        WHERE id = ${attemptId}
      `
      console.log("[Delete Result] Verification - deleted_at set to:", verifyDelete[0]?.deleted_at)
      
      return NextResponse.json({
        success: true,
        message: "Quiz attempt moved to trash successfully",
        softDeleted: true,
        deletedAt: result[0]?.deleted_at
      })
    } else {
      // Fallback: hard delete if column doesn't exist
      console.log("[Delete Result] deleted_at column not found, performing hard delete")
      
      // Delete quiz answers first (foreign key constraint)
      await sql`
        DELETE FROM quiz_answers
        WHERE attempt_id = ${attemptId}
      `

      // Delete the quiz attempt
      const result = await sql`
        DELETE FROM quiz_attempts
        WHERE id = ${attemptId}
        RETURNING id
      `

      if (result.length === 0) {
        return NextResponse.json({ error: "Quiz attempt not found" }, { status: 404 })
      }

      console.log("[Delete Result] Successfully hard deleted quiz attempt:", attemptId)
      return NextResponse.json({
        success: true,
        message: "Quiz attempt deleted permanently",
        softDeleted: false
      })
    }
  } catch (error) {
    console.error("[Delete Result] Failed to delete quiz attempt:", error)
    return NextResponse.json({ 
      error: "Failed to delete quiz attempt",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { requireInstructorAttemptAccess } = await import("@/lib/instructor-results-auth")
    const { id } = await params
    const access = await requireInstructorAttemptAccess(request, id)
    if (!access.ok) return access.response
    const attemptId = String(access.attemptId)

    const result = await getQuizAttemptResult(attemptId)

    if (result.length === 0) {
      return NextResponse.json({ error: "Quiz attempt not found" }, { status: 404 })
    }

    return NextResponse.json({ result: result[0] })
  } catch (error) {
    console.error("[v0] Failed to fetch quiz attempt:", error)
    return NextResponse.json({ error: "Failed to fetch quiz attempt" }, { status: 500 })
  }
}

