import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { assertQuizAccessibleInCourse } from "@/lib/quiz-course-access"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { is_saved } = await request.json()
    const { id: quizId } = await params

    const access = await assertQuizAccessibleInCourse(request, Number(quizId))
    if (!access.ok) return access.response

    if (is_saved) {
      // When saving as template, create a COPY instead of modifying the original
      // This prevents deletion of the template from affecting the original quiz
      
      // Fetch the original quiz
      const [quiz] = await sql`
        SELECT * FROM quizzes WHERE id = ${quizId}
      `

      if (!quiz) {
        return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
      }

      // Create a new quiz marked as saved template
      const [newQuiz] = await sql`
        INSERT INTO quizzes (
          title, 
          description, 
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
          available_from,
          available_until,
          created_at,
          updated_at
        )
        VALUES (
          ${quiz.title + " (Template)"},
          ${quiz.description},
          ${quiz.time_per_question},
          ${quiz.is_public},
          ${quiz.created_by},
          true,
          ${quizId},
          ${quiz.assessment_type || "quiz"},
          ${quiz.retake_enabled},
          ${quiz.retake_limit},
          ${quiz.retake_policy},
          ${quiz.review_before_retake},
          ${quiz.available_from},
          ${quiz.available_until},
          NOW(),
          NOW()
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
            option_a,
            option_b,
            option_c,
            option_d,
            option_e,
            correct_answer,
            question_order,
            time_limit,
            question_type,
            bank_question_id,
            created_at
          )
          VALUES (
            ${newQuiz.id},
            ${question.question_text},
            ${question.option_a},
            ${question.option_b},
            ${question.option_c},
            ${question.option_d},
            ${question.option_e},
            ${question.correct_answer},
            ${question.question_order},
            ${question.time_limit},
            ${question.question_type},
            ${question.bank_question_id},
            NOW()
          )
        `
      }

      return NextResponse.json({ 
        success: true, 
        message: "Template created successfully. Original quiz remains intact.",
        templateId: newQuiz.id 
      })
    } else {
      // If unsaving, check if this is a template with parent_quiz_id
      // Templates should not be "unsaved" as they are separate copies
      const quizInfo = await sql`
        SELECT parent_quiz_id, is_saved FROM quizzes WHERE id = ${quizId}
      `
      
      if (quizInfo.length === 0) {
        return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
      }
      
      const { parent_quiz_id } = quizInfo[0]
      
      // If this is a template (has parent_quiz_id), don't allow unsaving
      // Templates should be deleted instead of unsaved
      if (parent_quiz_id) {
        return NextResponse.json({ 
          error: "Cannot unsave a template. Templates are separate copies and should be deleted if no longer needed." 
        }, { status: 400 })
      }
      
      // Only allow unsaving for original quizzes (no parent_quiz_id)
      await sql`
        UPDATE quizzes
        SET is_saved = false
        WHERE id = ${quizId} AND parent_quiz_id IS NULL
      `

      return NextResponse.json({ 
        success: true, 
        message: "Quiz unsaved successfully. Original quiz remains intact." 
      })
    }
  } catch (error) {
    console.error("[v0] Failed to save quiz as template:", error)
    return NextResponse.json({ error: "Failed to save quiz as template" }, { status: 500 })
  }
}
