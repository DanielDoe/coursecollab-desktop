import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizePracticeStudentAnswer } from "@/lib/save-practice-answer"
import { requirePracticeAttemptOwnership } from "@/lib/require-student-practice-auth"
import { getPracticeAttemptAnswerProgress } from "@/lib/practice-topic-progress"

export const dynamic = "force-dynamic"

/** Restore in-quiz progress after refresh (saved practice_answers for an attempt). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  try {
    const { attemptId: attemptIdStr } = await params
    const attemptId = Number.parseInt(attemptIdStr, 10)
    const auth = await requirePracticeAttemptOwnership(request, attemptId)
    if (!auth.ok) return auth.response

    const [attempt] = await sql`
      SELECT id, total_questions, completed_at, topics, difficulty
      FROM practice_attempts
      WHERE id = ${attemptId} AND student_id = ${auth.studentDbId}
      LIMIT 1
    `
    if (!attempt) {
      return NextResponse.json({ error: "Practice attempt not found" }, { status: 404 })
    }

    const rows = await sql`
      SELECT
        pa.bank_question_id,
        pa.student_answer,
        pa.is_correct,
        qb.question_type,
        qb.topic
      FROM practice_answers pa
      JOIN question_bank qb ON pa.bank_question_id = qb.id
      WHERE pa.attempt_id = ${attemptId}
      ORDER BY pa.answered_at ASC NULLS LAST, pa.id ASC
    `

    const progress = await getPracticeAttemptAnswerProgress(attemptId)

    return NextResponse.json({
      attemptId,
      totalQuestions: Number(attempt.total_questions) || progress.total,
      completedAt: attempt.completed_at,
      topics: attempt.topics,
      difficulty: attempt.difficulty,
      progress,
      answers: rows.map((row) => ({
        questionId: Number(row.bank_question_id),
        studentAnswer: normalizePracticeStudentAnswer(row.student_answer),
        isCorrect: Boolean(row.is_correct),
        questionType: row.question_type,
        topic: row.topic,
      })),
    })
  } catch (error) {
    console.error("[practice/attempt/state]", error)
    return NextResponse.json({ error: "Failed to load practice attempt state" }, { status: 500 })
  }
}
