import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { finalizeAttempt } from "@/lib/finalize-utils"

export const dynamic = "force-dynamic"

/**
 * POST /api/instructor/submit-on-behalf
 * Finalize a student's incomplete attempt on their behalf (no re-evaluation).
 * Preserves all saved answers. Instructor can manually review and override grades per question.
 *
 * Body: { attemptId: number } | { studentId: number, quizId: number }
 */
export async function POST(request: NextRequest) {
  try {
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    const adminId = request.headers.get("x-admin-id")
    if (!instructorSession && !adminId) {
      return NextResponse.json({ error: "Instructor or admin authentication required" }, { status: 401 })
    }

    const body = await request.json()
    let attemptId: number | null = null
    let quizId: number | null = null

    if (body.attemptId) {
      attemptId = Number(body.attemptId)
      if (!attemptId || Number.isNaN(attemptId)) {
        return NextResponse.json({ error: "Invalid attemptId" }, { status: 400 })
      }
    } else if (body.studentId && body.quizId) {
      const sid = Number(body.studentId)
      const qid = Number(body.quizId)
      if (!sid || !qid || Number.isNaN(sid) || Number.isNaN(qid)) {
        return NextResponse.json({ error: "studentId and quizId required" }, { status: 400 })
      }
      const incomplete = await sql`
        SELECT id, quiz_id FROM quiz_attempts
        WHERE student_id = ${sid} AND quiz_id = ${qid}
          AND completed_at IS NULL AND deleted_at IS NULL
        ORDER BY attempt_number DESC
        LIMIT 1
      `
      if (incomplete.length === 0) {
        return NextResponse.json(
          { error: "No incomplete attempt found for this student and assessment" },
          { status: 404 }
        )
      }
      attemptId = incomplete[0].id
      quizId = incomplete[0].quiz_id
    } else {
      return NextResponse.json(
        { error: "Provide attemptId or (studentId and quizId)" },
        { status: 400 }
      )
    }

    const attemptRow = await sql`
      SELECT qa.id, qa.quiz_id, qa.student_id, qa.completed_at, q.title
      FROM quiz_attempts qa
      JOIN quizzes q ON q.id = qa.quiz_id
      WHERE qa.id = ${attemptId}
    `
    if (attemptRow.length === 0) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }

    const attempt = attemptRow[0] as { id: number; quiz_id: number; student_id: number; completed_at: string | null; title: string }
    if (attempt.completed_at) {
      return NextResponse.json(
        { error: "Attempt is already completed", attemptId },
        { status: 400 }
      )
    }

    const answerCount = await sql`
      SELECT COUNT(*)::int as n FROM quiz_answers WHERE attempt_id = ${attemptId}
    `
    if ((answerCount[0]?.n || 0) === 0) {
      return NextResponse.json(
        { error: "No saved answers to submit" },
        { status: 400 }
      )
    }

    const qid = quizId ?? attempt.quiz_id

    // Finalize only - no re-evaluation. Answers stay intact; instructor can manually grade per question.
    const result = await finalizeAttempt(attemptId, qid, { forceOnBehalfSubmit: true })

    if (!result.finalized) {
      return NextResponse.json(
        { error: "Finalization failed (attempt may have been soft-deleted)" },
        { status: 500 }
      )
    }

    // Mark this attempt as final grade (latest completed)
    await sql`
      UPDATE quiz_attempts SET is_final_grade = false
      WHERE quiz_id = ${qid} AND student_id = ${attempt.student_id}
    `
    await sql`
      UPDATE quiz_attempts SET is_final_grade = true
      WHERE id = ${attemptId}
    `

    const updated = await sql`
      SELECT score, total_questions, completed_at
      FROM quiz_attempts WHERE id = ${attemptId}
    `

    return NextResponse.json({
      success: true,
      message: `Submitted on behalf. Score: ${updated[0]?.score ?? 0}/${updated[0]?.total_questions ?? 0}`,
      attemptId,
      score: updated[0]?.score,
      totalQuestions: updated[0]?.total_questions,
      completedAt: updated[0]?.completed_at,
    })
  } catch (error: unknown) {
    console.error("[Submit-on-behalf] Error:", error)
    return NextResponse.json(
      { error: "Failed to submit on behalf" },
      { status: 500 }
    )
  }
}
