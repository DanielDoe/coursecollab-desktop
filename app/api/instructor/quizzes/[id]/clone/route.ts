import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { assertQuizAccessibleInCourse } from "@/lib/quiz-course-access"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

function toJsonb(value: unknown): string | null {
  if (value == null) return null
  return typeof value === "string" ? value : JSON.stringify(value)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: quizId } = await params

    const access = await assertQuizAccessibleInCourse(request, Number(quizId))
    if (!access.ok) return access.response

    // Fetch the original quiz
    const [quiz] = await sql`
      SELECT * FROM quizzes WHERE id = ${quizId}
    `

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    // Get instructor_id from request headers
    const instructorId = request.headers.get("x-instructor-id")
    
    const [newQuiz] = await sql`
      INSERT INTO quizzes (
        title, 
        description,
        coverage,
        time_per_question, 
        is_public, 
        instructor_id,
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
        track_gemini_window,
        max_gemini_strikes,
        require_fullscreen,
        beta_only,
        max_concurrent_students,
        section_config,
        counts_toward_course_grade
      )
      VALUES (
        ${quiz.title + " (Copy)"},
        ${quiz.description},
        ${quiz.coverage || null},
        ${quiz.time_per_question},
        ${quiz.is_public},
        ${instructorId ? Number(instructorId) : quiz.instructor_id || quiz.created_by},
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
        ${quiz.track_gemini_window ?? false},
        ${quiz.max_gemini_strikes ?? 5},
        ${quiz.require_fullscreen ?? false},
        ${quiz.beta_only ?? false},
        ${quiz.max_concurrent_students ?? null},
        ${quiz.section_config == null ? null : toJsonb(quiz.section_config)}::jsonb,
        ${quiz.counts_toward_course_grade ?? true}
      )
      RETURNING id
    `

    // Copy all questions from the original quiz
    const questions = await sql`
      SELECT * FROM quiz_questions WHERE quiz_id = ${quizId} ORDER BY question_order
    `

    for (const question of questions) {
      const circJson =
        question.circuit_spec == null
          ? null
          : typeof question.circuit_spec === "string"
            ? question.circuit_spec
            : JSON.stringify(question.circuit_spec)
      const mediaJson =
        question.question_media == null
          ? null
          : typeof question.question_media === "string"
            ? question.question_media
            : JSON.stringify(question.question_media)
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
          sample_answers,
          circuit_spec,
          question_media,
          subquestions,
          solution_upload_config
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
          ${toJsonb(question.answer_guidelines)}::jsonb,
          ${question.evaluation_mode},
          ${question.points},
          ${question.max_points},
          ${question.time_limit},
          ${question.anti_cheat_exempt ?? false},
          ${toJsonb(question.sample_answers)}::jsonb,
          ${circJson === null ? null : circJson}::jsonb,
          ${mediaJson === null ? null : mediaJson}::jsonb,
          ${toJsonb(question.subquestions)}::jsonb,
          ${toJsonb(question.solution_upload_config)}::jsonb
        )
      `
    }

    // Copy session access if it exists
    const sessionAccess = await sql`
      SELECT session_id, is_active FROM quiz_session_access WHERE quiz_id = ${quizId}
    `
    
    for (const access of sessionAccess) {
      await sql`
        INSERT INTO quiz_session_access (quiz_id, session_id, is_active, updated_at)
        VALUES (${newQuiz.id}, ${access.session_id}, ${access.is_active}, CURRENT_TIMESTAMP)
        ON CONFLICT (quiz_id, session_id) DO NOTHING
      `
    }

    return NextResponse.json({ success: true, quizId: newQuiz.id })
  } catch (error) {
    console.error("[v0] Failed to clone quiz:", error)
    return NextResponse.json({ error: "Failed to clone quiz" }, { status: 500 })
  }
}
