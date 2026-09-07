import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { recordAttemptScoreChange } from "@/lib/attempt-score-history"

export const dynamic = "force-dynamic"

/**
 * Student explicitly chooses which completed attempt counts as the final grade (is_final_grade).
 * Must own the attempt; quiz must match. See also quizzes.retake_policy + submit-time updateFinalGradeFlags.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const attemptId = Number(body.attemptId)
    const quizId = Number(body.quizId)
    const studentIdRaw = body.studentId

    if (!attemptId || !quizId || Number.isNaN(attemptId) || Number.isNaN(quizId)) {
      return NextResponse.json({ error: "Missing or invalid attemptId / quizId" }, { status: 400 })
    }

    let studentDatabaseId: number | null = null
    if (studentIdRaw != null && studentIdRaw !== "") {
      const n = parseInt(String(studentIdRaw), 10)
      if (!Number.isNaN(n) && n > 0) {
        const byId = await sql`SELECT id FROM students WHERE id = ${n} LIMIT 1`
        if (byId.length > 0) studentDatabaseId = n
      }
      if (studentDatabaseId == null) {
        const byCode = await sql`SELECT id FROM students WHERE student_id = ${String(studentIdRaw)} LIMIT 1`
        if (byCode.length > 0) studentDatabaseId = Number(byCode[0].id)
      }
    }

    if (studentDatabaseId == null) {
      return NextResponse.json({ error: "Student not found" }, { status: 400 })
    }

    const attemptOk = await sql`
      SELECT id FROM quiz_attempts
      WHERE id = ${attemptId}
        AND quiz_id = ${quizId}
        AND student_id = ${studentDatabaseId}
        AND deleted_at IS NULL
        AND completed_at IS NOT NULL
      LIMIT 1
    `

    if (attemptOk.length === 0) {
      return NextResponse.json(
        { error: "Attempt not found, not completed, or does not belong to this student" },
        { status: 403 }
      )
    }

    const previousFinal = await sql`
      SELECT id, score, attempt_number
      FROM quiz_attempts
      WHERE student_id = ${studentDatabaseId}
        AND quiz_id = ${quizId}
        AND is_final_grade = true
        AND deleted_at IS NULL
      LIMIT 1
    `
    const selectedAttempt = await sql`
      SELECT id, score, attempt_number
      FROM quiz_attempts
      WHERE id = ${attemptId}
      LIMIT 1
    `

    await sql`
      UPDATE quiz_attempts
      SET is_final_grade = false
      WHERE student_id = ${studentDatabaseId} AND quiz_id = ${quizId}
    `

    await sql`
      UPDATE quiz_attempts
      SET is_final_grade = true
      WHERE id = ${attemptId}
    `

    const prev = previousFinal[0] as { id: number; score: unknown; attempt_number: number | null } | undefined
    const sel = selectedAttempt[0] as { id: number; score: unknown; attempt_number: number | null }
    const newScore = Number(sel.score) || 0
    const prevScore = prev ? Number(prev.score) || 0 : null

    await recordAttemptScoreChange({
      attemptId,
      previousScore: prevScore,
      newScore,
      source: "final_attempt_selected",
      actorType: "student",
      actorId: studentDatabaseId,
      actorLabel: "Student selected final attempt",
      reason:
        prev && prev.id !== attemptId
          ? `Switched final grade from attempt #${prev.attempt_number ?? prev.id} to #${sel.attempt_number ?? attemptId}`
          : `Marked attempt #${sel.attempt_number ?? attemptId} as final grade`,
      force: true,
      metadata: {
        previousFinalAttemptId: prev?.id ?? null,
        selectedAttemptId: attemptId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[select-final-attempt] Error:", error)
    return NextResponse.json({ error: "Failed to select final attempt" }, { status: 500 })
  }
}
