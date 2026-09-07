import { NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET() {
  try {
    console.log("[Verify Score Mismatch] Starting verification...")
    
    // Query to find attempts where stored score doesn't match recalculated score
    const mismatches = await sql`
      SELECT 
        qa_attempts.id as attempt_id,
        qa_attempts.score as stored_score,
        qa_attempts.started_at,
        qa_attempts.completed_at,
        COALESCE(answer_stats.answer_count, 0) as answer_count,
        COALESCE(answer_stats.recalculated_score, 0) as recalculated_score,
        COALESCE(answer_stats.null_count, 0) as null_answers,
        (qa_attempts.score - COALESCE(answer_stats.recalculated_score, 0)) as score_difference,
        s.full_name as student_name,
        s.student_id as student_number,
        q.title as exam_title,
        q.id as quiz_id
      FROM quiz_attempts qa_attempts
      JOIN students s ON qa_attempts.student_id = s.id
      JOIN quizzes q ON qa_attempts.quiz_id = q.id
      LEFT JOIN (
        SELECT 
          attempt_id,
          COUNT(*) as answer_count,
          SUM(COALESCE(points_earned, 0)) as recalculated_score,
          COUNT(CASE WHEN selected_answer IS NULL THEN 1 END) as null_count
        FROM quiz_answers
        GROUP BY attempt_id
      ) answer_stats ON answer_stats.attempt_id = qa_attempts.id
      WHERE q.assessment_type = 'mid_semester'
        AND qa_attempts.completed_at IS NOT NULL
        AND (
          COALESCE(answer_stats.answer_count, 0) = 0 
          OR ABS(qa_attempts.score - COALESCE(answer_stats.recalculated_score, 0)) > 1
        )
      ORDER BY qa_attempts.completed_at DESC
      LIMIT 50
    `
    
    // Categorize the mismatches
    const completeDataLoss = mismatches.filter(m => Number(m.answer_count) === 0)
    const partialDataLoss = mismatches.filter(m => Number(m.answer_count) > 0 && Number(m.null_answers) > 0)
    const scoreMismatch = mismatches.filter(m => 
      Number(m.answer_count) > 0 && 
      Number(m.null_answers) === 0 && 
      Math.abs(Number(m.score_difference)) > 1
    )
    
    console.log("[Verify Score Mismatch] Found", mismatches.length, "mismatches")
    console.log("  - Complete data loss:", completeDataLoss.length)
    console.log("  - Partial data loss:", partialDataLoss.length)
    console.log("  - Score mismatch:", scoreMismatch.length)
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        total_mismatches: mismatches.length,
        complete_data_loss: completeDataLoss.length,
        partial_data_loss: partialDataLoss.length,
        score_mismatch_only: scoreMismatch.length
      },
      mismatches: {
        complete_data_loss: completeDataLoss,
        partial_data_loss: partialDataLoss,
        score_mismatch_only: scoreMismatch
      },
      all_mismatches: mismatches
    })
  } catch (error) {
    console.error("[Verify Score Mismatch] Error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

