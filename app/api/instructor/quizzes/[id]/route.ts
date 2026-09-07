import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { buildQuizQuestionSelectExtras } from "@/lib/quiz-question-schema"
import {
  QUIZ_QUESTION_BANK_JOIN,
  QUIZ_QUESTION_BANK_SELECT,
  resolveQuizQuestionsFromBank,
} from "@/lib/resolve-quiz-question-from-bank"
import { assertQuizAccessibleInCourse } from "@/lib/quiz-course-access"
import { taCanViewQuizContent } from "@/lib/quiz-ta-visibility"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const { id: quizId } = resolvedParams

    console.log("[Instructor Quiz GET] ===== STARTING REQUEST =====")
    console.log("[Instructor Quiz GET] URL:", request.url)
    console.log("[Instructor Quiz GET] Quiz ID:", quizId)

    const access = await assertQuizAccessibleInCourse(request, Number(quizId))
    if (!access.ok) return access.response

    // Get quiz details
    const quizResult = await sql`
      SELECT 
        id,
        title,
        description,
        coverage,
        time_per_question,
        available_from,
        available_until,
        retake_enabled,
        retake_limit,
        retake_policy,
        review_before_retake,
        COALESCE(forfeit_retake_on_report_view, true) as forfeit_retake_on_report_view,
        COALESCE(lock_student_results_review, false) as lock_student_results_review,
        strict_mode_enabled,
        block_copy_paste,
        track_tab_switches,
        track_mouse_movement,
        warn_on_tab_switch,
        max_tab_switches,
        auto_submit_on_violations,
        track_gemini_window,
        max_gemini_strikes,
        COALESCE(keystroke_playback_enforced, true) as keystroke_playback_enforced,
        COALESCE(counts_toward_course_grade, true) as counts_toward_course_grade,
        require_fullscreen,
        beta_only,
        geo_required,
        geo_lat,
        geo_lng,
        geo_radius_meters,
        rollover_enabled,
        rollover_hours,
        assessment_type,
        section_config,
        COALESCE(enable_superpowers, false) as enable_superpowers,
        COALESCE(allowed_superpowers, '[]'::jsonb) as allowed_superpowers,
        COALESCE(restrict_access_to_students, false) as restrict_access_to_students,
        COALESCE(allowed_student_ids, '[]'::jsonb) as allowed_student_ids,
        access_restriction_session_id,
        COALESCE(ai_evaluation_mode,
          CASE
            WHEN assessment_type IN ('homework', 'quiz') THEN 'relaxed'
            WHEN assessment_type = 'mid_semester' THEN 'strict'
            WHEN assessment_type = 'final' THEN 'very_strict'
            ELSE 'standard'
          END
        ) as ai_evaluation_mode,
        COALESCE(ai_model, 'auto') as ai_model,
        ai_model_by_task,
        COALESCE(ai_enable_opus_fallback, false) as ai_enable_opus_fallback,
        COALESCE(ai_opus_confidence_threshold, 0.800) as ai_opus_confidence_threshold,
        code_language,
        allowed_ai_code_languages,
        created_at,
        updated_at
      FROM quizzes
      WHERE id = ${Number(quizId)}
    `

    if (quizResult.length === 0) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    const quiz = quizResult[0]

    const canViewContent =
      access.isInstructorOwner ||
      (await taCanViewQuizContent(access.instructorId, Number(quizId)))
    if (!canViewContent) {
      return NextResponse.json(
        {
          error: "Quiz content is restricted for teaching assistants on this assessment.",
          ta_content_restricted: true,
        },
        { status: 403 },
      )
    }

    const questionExtras = await buildQuizQuestionSelectExtras("qq")

    // Get quiz questions (optional JSONB columns when migrations not yet applied)
    const rawQuestions = await sql`
      SELECT 
        qq.id,
        qq.question_text,
        qq.question_type,
        qq.option_a,
        qq.option_b,
        qq.option_c,
        qq.option_d,
        qq.option_e,
        qq.correct_answer,
        qq.question_order,
        qq.time_limit,
        qq.bank_question_id,
        qq.hint,
        qq.hint_penalty,
        qq.sample_answers,
        qq.ai_expected_solution,
        COALESCE(qq.anti_cheat_exempt, FALSE) as anti_cheat_exempt,
        qq.ai_code_language,
        COALESCE(qq.max_points, qq.points, 1) as max_points,
        COALESCE(qq.points, qq.max_points, 1) as points,
        ${sql.unsafe(QUIZ_QUESTION_BANK_SELECT)},
        ${sql.unsafe(questionExtras)}
      FROM quiz_questions qq
      ${sql.unsafe(QUIZ_QUESTION_BANK_JOIN)}
      WHERE qq.quiz_id = ${Number(quizId)}
      ORDER BY qq.question_order ASC
    `
    const questions = resolveQuizQuestionsFromBank(rawQuestions as Record<string, unknown>[])

    const response = {
      quiz: {
        ...quiz,
        questions,
      },
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error("[Instructor Quiz GET] ===== ERROR =====")
    console.error("[Instructor Quiz GET] Error message:", error?.message)
    console.error("[Instructor Quiz GET] Error stack:", error?.stack)
    console.error("[Instructor Quiz GET] Full error:", error)
    return NextResponse.json({ 
      error: "Failed to fetch quiz",
      details: error?.message || "Unknown error"
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const { id: quizId } = resolvedParams

    console.log("[Instructor Quiz DELETE] Soft deleting quiz ID:", quizId)

    const access = await assertQuizAccessibleInCourse(request, Number(quizId))
    if (!access.ok) return access.response

    // Check if quiz exists and is not already deleted
    const quizExists = await sql`
      SELECT id, title, parent_quiz_id, is_saved, deleted_at
      FROM quizzes 
      WHERE id = ${Number(quizId)}
    `

    if (quizExists.length === 0) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    const quiz = quizExists[0]

    // Check if already soft deleted
    if (quiz.deleted_at) {
      return NextResponse.json({ error: "Quiz is already deleted" }, { status: 400 })
    }

    // Check if there are any active quizzes using this as a parent
    if (quiz.is_saved && !quiz.parent_quiz_id) {
      const childQuizzes = await sql`
        SELECT COUNT(*) as count FROM quizzes WHERE parent_quiz_id = ${Number(quizId)} AND deleted_at IS NULL
      `

      if (childQuizzes[0].count > 0) {
        return NextResponse.json(
          { error: "Cannot delete saved template that has active quizzes using it" },
          { status: 400 }
        )
      }
    }

    // Get instructor info for deleted_by
    const instructorSession = request.headers.get('instructor-session')
    let deletedBy = 'instructor'
    if (instructorSession) {
      try {
        const instructorInfo = await sql`
          SELECT username FROM instructor_users WHERE session = ${instructorSession}
        `
        if (instructorInfo.length > 0) {
          deletedBy = instructorInfo[0].username
        }
      } catch (error) {
        console.log("Could not get instructor username:", error)
      }
    }

    // Soft delete quiz by setting deleted_at timestamp
    await sql`
      UPDATE quizzes 
      SET deleted_at = NOW(), deleted_by = ${deletedBy}
      WHERE id = ${Number(quizId)}
    `

    console.log("[Instructor Quiz DELETE] Successfully soft deleted quiz:", quizId)

    return NextResponse.json({ 
      success: true,
      message: "Quiz moved to trash successfully"
    })
  } catch (error) {
    console.error("[Instructor Quiz DELETE] Failed to delete quiz:", error)
    return NextResponse.json({ error: "Failed to delete quiz" }, { status: 500 })
  }
}
