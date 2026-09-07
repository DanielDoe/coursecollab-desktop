import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { assessmentType, attemptIds } = body

    console.log(`[Recalculate Grades] Starting grade recalculation for ${assessmentType || 'all assessments'}`)

    let attemptsToRecalculate
    
    if (attemptIds && attemptIds.length > 0) {
      // Recalculate specific attempts
      attemptsToRecalculate = await sql`
        SELECT DISTINCT qa.id as attempt_id, qa.quiz_id, qa.student_id, q.title as quiz_title
        FROM quiz_attempts qa
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE qa.id = ANY(${attemptIds})
      `
    } else if (assessmentType) {
      // Recalculate all attempts for a specific assessment type
      attemptsToRecalculate = await sql`
        SELECT DISTINCT qa.id as attempt_id, qa.quiz_id, qa.student_id, q.title as quiz_title
        FROM quiz_attempts qa
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE q.assessment_type = ${assessmentType}
          AND qa.id IN (
            SELECT DISTINCT qans.attempt_id
            FROM quiz_answers qans
            JOIN quiz_questions qq ON qans.question_id = qq.id
            WHERE qq.question_type IN ('code_write', 'code_write_plot')
              AND (qans.requires_review = true OR qans.points_earned > 0)
          )
      `
    } else {
      // Recalculate all attempts with code questions
      attemptsToRecalculate = await sql`
        SELECT DISTINCT qa.id as attempt_id, qa.quiz_id, qa.student_id, q.title as quiz_title
        FROM quiz_attempts qa
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE qa.id IN (
          SELECT DISTINCT qans.attempt_id
          FROM quiz_answers qans
          JOIN quiz_questions qq ON qans.question_id = qq.id
          WHERE qq.question_type IN ('code_write', 'code_write_plot')
            AND (qans.requires_review = true OR qans.points_earned > 0)
        )
      `
    }

    console.log(`[Recalculate Grades] Found ${attemptsToRecalculate.length} attempts to recalculate`)

    let recalculated = 0
    let errors = 0
    const results = []

    for (const attempt of attemptsToRecalculate) {
      try {
        // Calculate the new total score for this attempt
        const scoreCalculation = await sql`
          SELECT 
            COUNT(*) as total_questions,
            SUM(COALESCE(qans.points_earned, 0)) as total_points_earned,
            SUM(COALESCE(qq.points, 1)) as max_possible_points,
            COUNT(CASE WHEN qans.is_correct = true THEN 1 END) as correct_answers
          FROM quiz_questions qq
          LEFT JOIN quiz_answers qans ON qq.id = qans.question_id AND qans.attempt_id = ${attempt.attempt_id}
          WHERE qq.quiz_id = ${attempt.quiz_id}
        `

        const calc = scoreCalculation[0]
        const newScore = parseFloat(calc.total_points_earned || 0)
        const totalQuestions = parseInt(calc.total_questions || 0)
        const correctAnswers = parseInt(calc.correct_answers || 0)

        // Update the quiz attempt with the recalculated score
        await sql`
          UPDATE quiz_attempts
          SET
            score = ${newScore},
            total_questions = ${totalQuestions},
            completed_at = COALESCE(
              completed_at,
              CASE
                WHEN is_final_grade = true OR total_score_override IS NOT NULL
                THEN NOW()
                ELSE NULL
              END
            )
          WHERE id = ${attempt.attempt_id}
        `

        console.log(`[Recalculate Grades] Updated attempt ${attempt.attempt_id}: ${newScore} points (${correctAnswers}/${totalQuestions} correct)`)

        results.push({
          attempt_id: attempt.attempt_id,
          quiz_title: attempt.quiz_title,
          student_id: attempt.student_id,
          old_score: null, // We don't track the old score in this implementation
          new_score: newScore,
          total_questions: totalQuestions,
          correct_answers: correctAnswers
        })

        recalculated++
      } catch (error) {
        console.error(`[Recalculate Grades] Error recalculating attempt ${attempt.attempt_id}:`, error)
        errors++
      }
    }

    console.log(`[Recalculate Grades] Completed: ${recalculated} recalculated, ${errors} errors`)

    return NextResponse.json({
      success: true,
      message: `Grade recalculation completed: ${recalculated} attempts updated, ${errors} errors`,
      recalculated,
      errors,
      results
    })

  } catch (error) {
    console.error("[Recalculate Grades] Error:", error)
    return NextResponse.json(
      { 
        error: "Failed to recalculate grades",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
