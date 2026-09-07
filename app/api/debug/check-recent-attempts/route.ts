import { NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET() {
  try {
    console.log("[Check Recent Attempts] Fetching recent attempts...")
    
    // Get the 20 most recent completed attempts with answer statistics
    const recentAttempts = await sql`
      SELECT 
        qa.id as attempt_id,
        qa.quiz_id,
        qa.student_id,
        qa.score as stored_score,
        qa.started_at,
        qa.completed_at,
        qa.is_final_grade,
        s.full_name as student_name,
        s.student_id as student_number,
        q.title as exam_title,
        q.assessment_type,
        (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = qa.quiz_id) as total_questions,
        COALESCE(answer_stats.answer_count, 0) as answer_count,
        COALESCE(answer_stats.recalculated_score, 0) as recalculated_score,
        COALESCE(answer_stats.null_count, 0) as null_answers,
        COALESCE(answer_stats.non_null_count, 0) as non_null_answers
      FROM quiz_attempts qa
      JOIN students s ON qa.student_id = s.id
      JOIN quizzes q ON qa.quiz_id = q.id
      LEFT JOIN (
        SELECT 
          attempt_id,
          COUNT(*) as answer_count,
          SUM(COALESCE(points_earned, 0)) as recalculated_score,
          COUNT(CASE WHEN selected_answer IS NULL THEN 1 END) as null_count,
          COUNT(CASE WHEN selected_answer IS NOT NULL THEN 1 END) as non_null_count
        FROM quiz_answers
        GROUP BY attempt_id
      ) answer_stats ON answer_stats.attempt_id = qa.id
      WHERE qa.completed_at IS NOT NULL
      ORDER BY qa.completed_at DESC
      LIMIT 20
    `
    
    // Categorize attempts
    const categories = {
      ok: [],
      complete_data_loss: [],
      partial_data_loss: [],
      score_mismatch: []
    }
    
    for (const attempt of recentAttempts) {
      const answerCount = Number(attempt.answer_count)
      const totalQuestions = Number(attempt.total_questions)
      const nullCount = Number(attempt.null_answers)
      const score = Number(attempt.stored_score)
      const recalcScore = Number(attempt.recalculated_score)
      const scoreDiff = Math.abs(score - recalcScore)
      
      if (answerCount === 0 && score > 0) {
        categories.complete_data_loss.push(attempt)
      } else if (nullCount > 0) {
        categories.partial_data_loss.push(attempt)
      } else if (scoreDiff > 1) {
        categories.score_mismatch.push(attempt)
      } else {
        categories.ok.push(attempt)
      }
    }
    
    const totalAttempts = recentAttempts.length
    const healthPercentage = totalAttempts > 0 
      ? ((categories.ok.length / totalAttempts) * 100).toFixed(1)
      : "N/A"
    
    console.log("[Check Recent Attempts] Analysis complete")
    console.log("  Total:", totalAttempts)
    console.log("  OK:", categories.ok.length)
    console.log("  Data Loss:", categories.complete_data_loss.length)
    console.log("  Partial Loss:", categories.partial_data_loss.length)
    console.log("  Score Mismatch:", categories.score_mismatch.length)
    console.log("  Health:", healthPercentage + "%")
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        total_attempts: totalAttempts,
        ok: categories.ok.length,
        complete_data_loss: categories.complete_data_loss.length,
        partial_data_loss: categories.partial_data_loss.length,
        score_mismatch: categories.score_mismatch.length,
        health_percentage: healthPercentage
      },
      categories,
      recent_attempts: recentAttempts
    })
  } catch (error) {
    console.error("[Check Recent Attempts] Error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

