import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/debug/attempt-answers/[id]
 * Returns raw quiz_answers for an attempt (selected_answer, answer_data) to verify what's in the DB.
 * Use ?attemptId=2667 or path id for Lana's attempt.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const attemptId = parseInt(id, 10)
    if (!attemptId) {
      return NextResponse.json({ error: "Invalid attempt id" }, { status: 400 })
    }

    const attempt = await sql`
      SELECT qa.id, qa.quiz_id, qa.student_id, qa.score, qa.completed_at,
             s.full_name as student_name, q.title as quiz_title
      FROM quiz_attempts qa
      JOIN students s ON s.id = qa.student_id
      JOIN quizzes q ON q.id = qa.quiz_id
      WHERE qa.id = ${attemptId}
    `
    if (attempt.length === 0) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }

    // Raw count: quiz_answers for this attempt (no JOIN) — shows if answers exist at all
    const rawCount = await sql`
      SELECT COUNT(*)::int as count FROM quiz_answers WHERE attempt_id = ${attemptId}
    `
    const rawAnswerRows = await sql`
      SELECT id as answer_id, question_id, selected_answer, answer_data, points_earned, is_correct
      FROM quiz_answers
      WHERE attempt_id = ${attemptId}
      ORDER BY question_id, id
    `

    const answers = await sql`
      SELECT qa.id as answer_id, qa.question_id, qa.selected_answer, qa.answer_data,
             qa.points_earned, qa.is_correct, qa.answered_at,
             qq.question_order, qq.question_type
      FROM quiz_answers qa
      JOIN quiz_questions qq ON qq.id = qa.question_id
      WHERE qa.attempt_id = ${attemptId}
      ORDER BY qq.question_order, qa.id
    `

    const rows = (answers as any[]).map((a) => {
      const ad = a.answer_data
      const parsed = ad && (typeof ad === "string" ? (() => { try { return JSON.parse(ad) } catch { return null } })() : ad)
      const typingReplay = parsed?.typing_replay
      return {
        answer_id: a.answer_id,
        question_id: a.question_id,
        question_order: a.question_order,
        question_type: a.question_type,
        selected_answer: a.selected_answer,
        selected_answer_type: typeof a.selected_answer,
        answer_data: a.answer_data,
        answer_data_type: typeof a.answer_data,
        answer_data_has_answer:
          a.answer_data &&
          typeof a.answer_data === "object" &&
          "answer" in a.answer_data,
        typing_replay_in_db: !!typingReplay,
        typing_replay_event_count: typingReplay?.events?.length ?? 0,
        points_earned: a.points_earned,
        is_correct: a.is_correct,
      }
    })

    const withAnswer = rows.filter(
      (r) =>
        (r.selected_answer != null && String(r.selected_answer).trim() !== "") ||
        (r.answer_data && typeof r.answer_data === "object" && r.answer_data.answer != null)
    )

    // DIAGNOSTIC: Check if answer question_ids exist in current quiz (quiz may have been edited)
    const quizId = attempt[0]?.quiz_id
    const currentQuestions =
      quizId != null
        ? await sql`
            SELECT id as question_id, question_order
            FROM quiz_questions
            WHERE quiz_id = ${quizId}
            ORDER BY question_order ASC NULLS LAST, id ASC
          `
        : []
    const currentQids = new Set((currentQuestions as any[]).map((q: any) => String(q.question_id)))
    const answerQids = (rawAnswerRows as any[]).map((a: any) => String(a.question_id))
    const matchedCount = answerQids.filter((qid) => currentQids.has(qid)).length
    const orphanedCount = answerQids.length - matchedCount

    return NextResponse.json({
      attempt: attempt[0],
      raw_answer_count: rawCount[0]?.count ?? 0,
      raw_answers: (rawAnswerRows as any[]).map((a) => ({
        answer_id: a.answer_id,
        question_id: a.question_id,
        selected_answer: a.selected_answer,
        has_answer_data: !!a.answer_data,
        points_earned: a.points_earned,
        is_correct: a.is_correct,
      })),
      joined_answer_count: rows.length,
      rows_with_answer: withAnswer.length,
      answers: rows,
      diagnostic: {
        quiz_id: quizId,
        current_question_ids: Array.from(currentQids),
        answer_question_ids: answerQids,
        matched_count: matchedCount,
        orphaned_count: orphanedCount,
        explanation:
          orphanedCount > 0
            ? "Some/all answers reference question_ids no longer in this quiz (quiz was likely edited). Results API uses position-based fallback for these."
            : "All answer question_ids exist in current quiz. Matching should work.",
      },
    })
  } catch (e) {
    console.error("[debug/attempt-answers]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    )
  }
}
