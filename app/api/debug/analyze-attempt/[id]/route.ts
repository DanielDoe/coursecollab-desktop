import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const attemptId = parseInt(id)
    
    console.log(`[Analyze Attempt] Analyzing attempt ${attemptId}`)
    
    // Get attempt details
    const attemptResult = await sql`
      SELECT 
        qa.id,
        qa.quiz_id,
        qa.student_id,
        qa.score,
        qa.started_at,
        qa.completed_at,
        qa.is_final_grade,
        s.full_name as student_name,
        s.student_id as student_number,
        q.title as exam_title,
        q.assessment_type,
        EXTRACT(EPOCH FROM (qa.completed_at - qa.started_at)) / 60 as duration_minutes
      FROM quiz_attempts qa
      JOIN students s ON qa.student_id = s.id
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.id = ${attemptId}
    `
    
    if (attemptResult.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Attempt not found"
      }, { status: 404 })
    }
    
    const attempt = attemptResult[0]
    
    // Get all questions for this quiz
    const totalQuestions = await sql`
      SELECT COUNT(*) as count
      FROM quiz_questions
      WHERE quiz_id = ${attempt.quiz_id}
    `
    
    // Get all answers (including NULL ones)
    const answers = await sql`
      SELECT 
        qa.id as answer_id,
        qa.question_id,
        qa.selected_answer,
        qa.is_correct,
        qa.points_earned,
        qa.answered_at,
        qa.ai_feedback,
        qq.question_order,
        qq.question_type,
        qq.question_text,
        qq.points,
        qq.correct_answer
      FROM quiz_answers qa
      JOIN quiz_questions qq ON qa.question_id = qq.id
      WHERE qa.attempt_id = ${attemptId}
      ORDER BY qq.question_order ASC
    `
    
    // Separate NULL and non-NULL answers
    const nullAnswers = answers.filter(a => a.selected_answer === null)
    const savedAnswers = answers.filter(a => a.selected_answer !== null)
    
    // Pattern analysis
    const questionTypes = {}
    const positions = []
    
    nullAnswers.forEach(a => {
      const type = a.question_type
      questionTypes[type] = (questionTypes[type] || 0) + 1
      positions.push(Number(a.question_order))
    })
    
    // Time pattern analysis
    let timePattern = "unknown"
    if (nullAnswers.length > 0 && nullAnswers[0].answered_at) {
      const nullTimes = nullAnswers
        .filter(a => a.answered_at)
        .map(a => new Date(a.answered_at).getTime())
      
      const startTime = new Date(attempt.started_at).getTime()
      const endTime = new Date(attempt.completed_at).getTime()
      const duration = endTime - startTime
      
      // Check if NULL answers are at the beginning, middle, or end
      const avgNullTime = nullTimes.reduce((a, b) => a + b, 0) / nullTimes.length
      const relativePosition = (avgNullTime - startTime) / duration
      
      if (relativePosition < 0.33) {
        timePattern = "early (first 33%)"
      } else if (relativePosition > 0.67) {
        timePattern = "late (last 33%)"
      } else {
        timePattern = "middle (33-67%)"
      }
    }
    
    return NextResponse.json({
      success: true,
      attempt: {
        id: attempt.id,
        student_name: attempt.student_name,
        student_number: attempt.student_number,
        exam_title: attempt.exam_title,
        assessment_type: attempt.assessment_type,
        started_at: attempt.started_at,
        completed_at: attempt.completed_at,
        duration_minutes: Math.round(Number(attempt.duration_minutes))
      },
      stats: {
        total_questions: Number(totalQuestions[0].count),
        answers_saved: savedAnswers.length,
        null_answers: nullAnswers.length,
        success_rate: ((savedAnswers.length / Number(totalQuestions[0].count)) * 100).toFixed(1)
      },
      null_questions: nullAnswers.map(a => ({
        question_id: a.question_id,
        question_order: a.question_order,
        question_type: a.question_type,
        question_text: a.question_text,
        points: a.points,
        selected_answer: a.selected_answer,
        is_correct: a.is_correct,
        points_earned: a.points_earned,
        answered_at: a.answered_at
      })),
      pattern_analysis: {
        question_types: questionTypes,
        positions: positions,
        time_pattern: timePattern
      }
    })
    
  } catch (error) {
    console.error("[Analyze Attempt] Error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

