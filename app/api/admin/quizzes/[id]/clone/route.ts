import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const quizId = params.id

    // Fetch the original quiz
    const [quiz] = await sql`
      SELECT * FROM quizzes WHERE id = ${quizId}
    `

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    const [newQuiz] = await sql`
      INSERT INTO quizzes (
        title, 
        description,
        coverage,
        time_per_question, 
        is_public, 
        created_by,
        is_saved,
        parent_quiz_id,
        assessment_type,
        retake_enabled,
        retake_limit,
        retake_policy,
        review_before_retake,
        time_limit,
        available_from,
        available_until,
        strict_mode_enabled,
        block_copy_paste,
        track_tab_switches,
        track_mouse_movement,
        warn_on_tab_switch,
        max_tab_switches,
        auto_submit_on_violations,
        require_fullscreen,
        beta_only,
        max_concurrent_students
      )
      VALUES (
        ${quiz.title + " (Copy)"},
        ${quiz.description},
        ${quiz.coverage || null},
        ${quiz.time_per_question},
        ${quiz.is_public},
        ${quiz.created_by},
        false,
        ${quizId},
        ${quiz.assessment_type || "quiz"},
        ${quiz.retake_enabled},
        ${quiz.retake_limit},
        ${quiz.retake_policy},
        ${quiz.review_before_retake},
        ${quiz.time_limit},
        ${quiz.available_from},
        ${quiz.available_until},
        ${quiz.strict_mode_enabled ?? false},
        ${quiz.block_copy_paste ?? false},
        ${quiz.track_tab_switches ?? false},
        ${quiz.track_mouse_movement ?? false},
        ${quiz.warn_on_tab_switch ?? false},
        ${quiz.max_tab_switches ?? 5},
        ${quiz.auto_submit_on_violations ?? false},
        ${quiz.require_fullscreen ?? false},
        ${quiz.beta_only ?? false},
        ${quiz.max_concurrent_students ?? null}
      )
      RETURNING id
    `

    // Copy all questions from the original quiz
    const questions = await sql`
      SELECT * FROM quiz_questions WHERE quiz_id = ${quizId} ORDER BY question_order
    `

    for (const question of questions) {
      await sql`
        INSERT INTO quiz_questions (
          quiz_id,
          question_text,
          question_type,
          option_a,
          option_b,
          option_c,
          option_d,
          option_e,
          correct_answer,
          question_order,
          bank_question_id,
          topic,
          difficulty,
          hint,
          hint_penalty,
          explanation,
          sample_answer,
          answer_guidelines,
          evaluation_mode,
          points,
          max_points,
          time_limit,
          anti_cheat_exempt,
          sample_answers
        )
        VALUES (
          ${newQuiz.id},
          ${question.question_text},
          ${question.question_type},
          ${question.option_a},
          ${question.option_b},
          ${question.option_c},
          ${question.option_d},
          ${question.option_e},
          ${question.correct_answer},
          ${question.question_order},
          ${question.bank_question_id},
          ${question.topic},
          ${question.difficulty},
          ${question.hint},
          ${question.hint_penalty},
          ${question.explanation},
          ${question.sample_answer},
          ${question.answer_guidelines},
          ${question.evaluation_mode},
          ${question.points},
          ${question.max_points},
          ${question.time_limit},
          ${question.anti_cheat_exempt ?? false},
          ${question.sample_answers || null}
        )
      `
    }

    return NextResponse.json({ success: true, quizId: newQuiz.id })
  } catch (error) {
    console.error("[v0] Failed to clone quiz:", error)
    return NextResponse.json({ error: "Failed to clone quiz" }, { status: 500 })
  }
}
