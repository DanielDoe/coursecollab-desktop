import { NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET() {
  try {
    console.log("[Check Unfinalized] Checking for unfinalized attempts...")
    
    // Get all unfinalized attempts grouped by quiz
    const unfinalizedByQuiz = await sql`
      SELECT 
        q.id as quiz_id,
        q.title as quiz_title,
        q.assessment_type,
        COUNT(DISTINCT qa.student_id) as student_count,
        COUNT(qa.id) as attempt_count
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.is_final_grade = false
        AND q.deleted_at IS NULL
      GROUP BY q.id, q.title, q.assessment_type
      ORDER BY attempt_count DESC
    `
    
    // Get total counts
    const totalCounts = await sql`
      SELECT 
        COUNT(DISTINCT student_id) as total_students,
        COUNT(id) as total_attempts
      FROM quiz_attempts
      WHERE is_final_grade = false
    `
    
    // Get detailed list of students with multiple attempts
    const studentsWithMultipleAttempts = await sql`
      SELECT 
        s.full_name,
        s.student_id as student_number,
        q.title as quiz_title,
        q.id as quiz_id,
        COUNT(qa.id) as attempt_count,
        MAX(qa.score) as highest_score,
        MIN(qa.score) as lowest_score,
        MAX(qa.completed_at) as latest_attempt
      FROM quiz_attempts qa
      JOIN students s ON qa.student_id = s.id
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.is_final_grade = false
        AND qa.completed_at IS NOT NULL
      GROUP BY s.full_name, s.student_id, q.title, q.id
      HAVING COUNT(qa.id) > 1
      ORDER BY attempt_count DESC
      LIMIT 20
    `
    
    console.log("[Check Unfinalized] Results:")
    console.log("  Total students:", totalCounts[0].total_students)
    console.log("  Total attempts:", totalCounts[0].total_attempts)
    console.log("  Quizzes affected:", unfinalizedByQuiz.length)
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      totalStudents: Number(totalCounts[0].total_students),
      totalAttempts: Number(totalCounts[0].total_attempts),
      byQuiz: unfinalizedByQuiz.map(q => ({
        quiz_id: q.quiz_id,
        quiz_title: q.quiz_title,
        assessment_type: q.assessment_type,
        student_count: Number(q.student_count),
        attempt_count: Number(q.attempt_count)
      })),
      studentsWithMultipleAttempts: studentsWithMultipleAttempts.map(s => ({
        student_name: s.full_name,
        student_number: s.student_number,
        quiz_title: s.quiz_title,
        quiz_id: s.quiz_id,
        attempt_count: Number(s.attempt_count),
        highest_score: Number(s.highest_score),
        lowest_score: Number(s.lowest_score),
        latest_attempt: s.latest_attempt
      }))
    })
  } catch (error) {
    console.error("[Check Unfinalized] Error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}


