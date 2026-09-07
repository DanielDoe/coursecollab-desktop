import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { ensureResultsFinalizedColumns } from "@/lib/ensure-results-finalized-columns"
import {
  resolveInstructorDisplayName,
  setResultsFinalized,
} from "@/lib/results-finalized"

export const dynamic = "force-dynamic"

/**
 * POST /api/instructor/results/bulk-finalize
 * Finalize multiple student attempts for gradebook release.
 */
export async function POST(request: NextRequest) {
  try {
    const instructorSession =
      request.headers.get("authorization") || request.headers.get("x-instructor-id")
    const adminId = request.headers.get("x-admin-id")
    if (!instructorSession && !adminId) {
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

    await ensureResultsFinalizedColumns()

    const body = await request.json().catch(() => ({}))
    const attemptIdsRaw = body.attemptIds
    const assessmentType = typeof body.assessmentType === "string" ? body.assessmentType.trim() : ""
    const quizId = body.quizId != null ? Number(body.quizId) : NaN

    let attemptIds: number[] = []
    if (Array.isArray(attemptIdsRaw)) {
      attemptIds = attemptIdsRaw
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0)
    } else if (Number.isFinite(quizId) && quizId > 0) {
      const typeFilter =
        assessmentType && assessmentType !== "all"
          ? sql`AND q.assessment_type = ${assessmentType}`
          : sql``
      const rows = await sql`
        SELECT qa.id
        FROM quiz_attempts qa
        JOIN quizzes q ON q.id = qa.quiz_id
        WHERE qa.quiz_id = ${quizId}
          AND qa.deleted_at IS NULL
          AND qa.completed_at IS NOT NULL
          AND qa.results_finalized_at IS NULL
          ${typeFilter}
      `
      attemptIds = (rows as Array<{ id: number }>).map((r) => Number(r.id))
    }

    if (attemptIds.length === 0) {
      return NextResponse.json({
        success: true,
        finalized: 0,
        message: "No pending attempts to finalize.",
      })
    }

    let finalizedBy: string | null = null
    if (adminId) {
      finalizedBy = "Administrator"
    } else {
      const instructorIdRaw = request.headers.get("x-instructor-id")
      const instructorId = instructorIdRaw ? Number(instructorIdRaw) : NaN
      if (Number.isFinite(instructorId)) {
        finalizedBy = (await resolveInstructorDisplayName(instructorId)) || "Instructor"
      } else {
        finalizedBy = "Instructor"
      }
    }

    let finalized = 0
    const errors: string[] = []
    for (const attemptId of attemptIds) {
      try {
        await setResultsFinalized(attemptId, true, finalizedBy)
        finalized++
      } catch (e) {
        errors.push(`Attempt ${attemptId}: ${e instanceof Error ? e.message : "failed"}`)
      }
    }

    return NextResponse.json({
      success: true,
      finalized,
      total: attemptIds.length,
      errors: errors.length > 0 ? errors : undefined,
      message:
        finalized === attemptIds.length
          ? `Finalized ${finalized} result${finalized === 1 ? "" : "s"} for student release.`
          : `Finalized ${finalized} of ${attemptIds.length} results.`,
    })
  } catch (error) {
    console.error("[Bulk Finalize] Error:", error)
    return NextResponse.json({ error: "Failed to bulk finalize results." }, { status: 500 })
  }
}
