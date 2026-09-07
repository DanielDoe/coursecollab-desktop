import { NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET() {
  try {
    console.log("[Check Null Answers] Starting analysis...")
    
    const results: any = {
      quiz_answers: null,
      student_answers: null,
      quiz_answers_by_date: null,
      student_answers_by_date: null
    }
    
    // 1. Check quiz_answers table (current)
    console.log("[Check Null Answers] Checking quiz_answers table...")
    try {
      const quizAnswersStats = await sql`
        SELECT 
          COUNT(*) as null_count,
          COUNT(DISTINCT qa.attempt_id) as affected_attempts,
          COUNT(DISTINCT qat.student_id) as affected_students,
          MIN(qa.answered_at) as earliest_null_date,
          MAX(qa.answered_at) as latest_null_date
        FROM quiz_answers qa
        JOIN quiz_attempts qat ON qa.attempt_id = qat.id
        JOIN quizzes q ON qat.quiz_id = q.id
        WHERE q.assessment_type = 'mid_semester'
          AND qa.selected_answer IS NULL
      `
      
      const quizAnswersByDate = await sql`
        SELECT 
          DATE(qa.answered_at) as date,
          COUNT(*) as null_count,
          COUNT(DISTINCT qa.attempt_id) as attempts,
          COUNT(DISTINCT qat.student_id) as students,
          array_agg(DISTINCT q.title) as exam_titles
        FROM quiz_answers qa
        JOIN quiz_attempts qat ON qa.attempt_id = qat.id
        JOIN quizzes q ON qat.quiz_id = q.id
        WHERE q.assessment_type = 'mid_semester'
          AND qa.selected_answer IS NULL
        GROUP BY DATE(qa.answered_at)
        ORDER BY date DESC
      `
      
      results.quiz_answers = quizAnswersStats[0] || { null_count: 0 }
      results.quiz_answers_by_date = quizAnswersByDate
      
      console.log("[Check Null Answers] quiz_answers results:", quizAnswersStats[0])
    } catch (error) {
      console.error("[Check Null Answers] Error checking quiz_answers:", error)
      results.quiz_answers = { error: error instanceof Error ? error.message : "Unknown error" }
    }
    
    // 2. Check if student_answers table exists
    console.log("[Check Null Answers] Checking if student_answers table exists...")
    try {
      const tableExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'student_answers'
        ) as exists
      `
      
      if (tableExists[0].exists) {
        console.log("[Check Null Answers] student_answers table exists, checking...")
        
        const studentAnswersStats = await sql`
          SELECT 
            COUNT(*) as null_count,
            COUNT(DISTINCT sa.attempt_id) as affected_attempts,
            COUNT(DISTINCT qat.student_id) as affected_students,
            MIN(sa.answered_at) as earliest_null_date,
            MAX(sa.answered_at) as latest_null_date
          FROM student_answers sa
          JOIN quiz_attempts qat ON sa.attempt_id = qat.id
          JOIN quizzes q ON qat.quiz_id = q.id
          WHERE q.assessment_type = 'mid_semester'
            AND sa.selected_answer IS NULL
        `
        
        const studentAnswersByDate = await sql`
          SELECT 
            DATE(sa.answered_at) as date,
            COUNT(*) as null_count,
            COUNT(DISTINCT sa.attempt_id) as attempts,
            COUNT(DISTINCT qat.student_id) as students,
            array_agg(DISTINCT q.title) as exam_titles
          FROM student_answers sa
          JOIN quiz_attempts qat ON sa.attempt_id = qat.id
          JOIN quizzes q ON qat.quiz_id = q.id
          WHERE q.assessment_type = 'mid_semester'
            AND sa.selected_answer IS NULL
          GROUP BY DATE(sa.answered_at)
          ORDER BY date DESC
        `
        
        results.student_answers = studentAnswersStats[0] || { null_count: 0 }
        results.student_answers_by_date = studentAnswersByDate
        
        console.log("[Check Null Answers] student_answers results:", studentAnswersStats[0])
      } else {
        console.log("[Check Null Answers] student_answers table does not exist")
        results.student_answers = { 
          exists: false,
          message: "Table does not exist (legacy table was dropped)" 
        }
      }
    } catch (error) {
      console.error("[Check Null Answers] Error checking student_answers:", error)
      results.student_answers = { error: error instanceof Error ? error.message : "Unknown error" }
    }
    
    // 3. Get additional details about affected attempts
    console.log("[Check Null Answers] Getting affected attempt details...")
    try {
      const affectedAttempts = await sql`
        SELECT 
          qat.id as attempt_id,
          qat.student_id,
          s.full_name as student_name,
          s.student_id as student_number,
          q.id as quiz_id,
          q.title as exam_title,
          qat.score,
          qat.started_at,
          qat.completed_at,
          COUNT(qa.id) as total_answers,
          COUNT(CASE WHEN qa.selected_answer IS NULL THEN 1 END) as null_answers,
          COUNT(CASE WHEN qa.selected_answer IS NOT NULL THEN 1 END) as non_null_answers
        FROM quiz_attempts qat
        JOIN quizzes q ON qat.quiz_id = q.id
        JOIN students s ON qat.student_id = s.id
        LEFT JOIN quiz_answers qa ON qa.attempt_id = qat.id
        WHERE q.assessment_type = 'mid_semester'
        GROUP BY qat.id, qat.student_id, s.full_name, s.student_id, q.id, q.title, qat.score, qat.started_at, qat.completed_at
        HAVING COUNT(CASE WHEN qa.selected_answer IS NULL THEN 1 END) > 0
        ORDER BY qat.completed_at DESC
      `
      
      results.affected_attempts_detail = affectedAttempts
      console.log("[Check Null Answers] Found", affectedAttempts.length, "affected attempts")
    } catch (error) {
      console.error("[Check Null Answers] Error getting attempt details:", error)
      results.affected_attempts_detail = { error: error instanceof Error ? error.message : "Unknown error" }
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        quiz_answers_null_count: results.quiz_answers?.null_count || 0,
        student_answers_null_count: results.student_answers?.null_count || 0,
        student_answers_table_exists: results.student_answers?.exists !== false
      },
      details: results
    })
  } catch (error) {
    console.error("[Check Null Answers] Fatal error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

