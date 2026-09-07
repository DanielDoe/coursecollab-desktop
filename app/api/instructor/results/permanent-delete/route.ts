import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  checkStudentRecordDeleteAllowed,
  logStudentDataDeleteAudit,
  studentDataDeleteGuardResponse,
} from "@/lib/student-data-protection"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function DELETE(request: NextRequest) {
  try {
    const { attemptId, confirmPhrase } = await request.json()

    if (!attemptId) {
      return NextResponse.json({ error: "Attempt ID required" }, { status: 400 })
    }

    const guard = checkStudentRecordDeleteAllowed({
      bulk: false,
      confirmPhrase,
      affectedRowEstimate: 1,
      operation: "Permanently delete quiz attempt",
    })
    if (guard.blocked) return studentDataDeleteGuardResponse(guard)

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

    await logStudentDataDeleteAudit({
      source: "api:instructor/results/permanent-delete",
      actorType: "instructor",
      entityType: "quiz_attempts",
      entityId: Number(attemptId),
    })

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

