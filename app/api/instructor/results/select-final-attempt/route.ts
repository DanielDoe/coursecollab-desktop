import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { recordAttemptScoreChange } from "@/lib/attempt-score-history"
import { resolveInstructorDisplayName } from "@/lib/results-finalized"

export const dynamic = "force-dynamic"

/**
 * Instructor chooses which completed attempt counts as the student's grade (is_final_grade).
 */
export async function POST(request: NextRequest) {
  try {
    const instructorSession =
      request.headers.get("authorization") || request.headers.get("x-instructor-id")
    const adminId = request.headers.get("x-admin-id")
    if (!instructorSession && !adminId) {
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

    const body = await request.json()
    const attemptId = Number(body.attemptId)
    if (!attemptId || Number.isNaN(attemptId)) {
      return NextResponse.json({ error: "Valid attemptId is required" }, { status: 400 })
    }

    const row = await sql`
      SELECT qa.id, qa.quiz_id, qa.student_id, qa.score, qa.attempt_number, qa.completed_at
      FROM quiz_attempts qa
      WHERE qa.id = ${attemptId} AND qa.deleted_at IS NULL
      LIMIT 1
    `
    if (row.length === 0) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }

    const attempt = row[0] as {
      id: number
      quiz_id: number
      student_id: number
      score: unknown
      attempt_number: number | null
      completed_at: string | null
    }

    if (!attempt.completed_at) {
      return NextResponse.json({ error: "Attempt is not completed yet" }, { status: 400 })
    }

    const previousFinal = await sql`
      SELECT id, score, attempt_number
      FROM quiz_attempts
      WHERE student_id = ${attempt.student_id}
        AND quiz_id = ${attempt.quiz_id}
        AND is_final_grade = true
        AND deleted_at IS NULL
      LIMIT 1
    `

    await sql`
      UPDATE quiz_attempts
      SET is_final_grade = false
      WHERE student_id = ${attempt.student_id} AND quiz_id = ${attempt.quiz_id}
    `

    await sql`
      UPDATE quiz_attempts
      SET is_final_grade = true
      WHERE id = ${attemptId}
    `

    const prev = previousFinal[0] as { id: number; score: unknown; attempt_number: number | null } | undefined
    const newScore = Number(attempt.score) || 0
    const prevScore = prev ? Number(prev.score) || 0 : null

    let actorLabel = "Instructor"
    if (adminId) {
      actorLabel = "Admin"
    } else if (instructorSession) {
      const instructorId = parseInt(String(instructorSession), 10)
      if (!Number.isNaN(instructorId) && instructorId > 0) {
        const name = await resolveInstructorDisplayName(instructorId)
        if (name) actorLabel = name
      }
    }

    await recordAttemptScoreChange({
      attemptId,
      previousScore: prevScore,
      newScore,
      source: "final_attempt_selected",
      actorType: adminId ? "admin" : "instructor",
      actorId: adminId ? Number(adminId) || null : null,
      actorLabel: `${actorLabel} set grade attempt`,
      reason:
        prev && prev.id !== attemptId
          ? `Instructor switched grade from attempt #${prev.attempt_number ?? prev.id} to #${attempt.attempt_number ?? attemptId}`
          : `Instructor marked attempt #${attempt.attempt_number ?? attemptId} as grade attempt`,
      force: true,
      metadata: {
        previousFinalAttemptId: prev?.id ?? null,
        selectedAttemptId: attemptId,
      },
    })

    return NextResponse.json({ success: true, attemptId })
  } catch (error) {
    console.error("[instructor/select-final-attempt] Error:", error)
    return NextResponse.json({ error: "Failed to set grade attempt" }, { status: 500 })
  }
}
