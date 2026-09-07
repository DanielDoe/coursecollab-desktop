import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    // Check if tables exist
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('practice_attempts', 'practice_answers', 'students', 'topic_availability')
      ORDER BY table_name
    `

    // Get practice attempts
    const practiceAttempts = await sql`
      SELECT 
        id,
        student_id,
        topics,
        difficulty,
        total_questions,
        correct_answers,
        score_percentage,
        started_at,
        completed_at
      FROM practice_attempts
      ORDER BY started_at DESC
      LIMIT 10
    `

    // Get students
    const students = await sql`
      SELECT 
        id,
        full_name,
        email,
        section
      FROM students
      ORDER BY full_name
      LIMIT 10
    `

    // Get practice attempts count by student
    const studentAttempts = await sql`
      SELECT 
        student_id,
        COUNT(*) as attempt_count
      FROM practice_attempts
      GROUP BY student_id
      ORDER BY attempt_count DESC
    `

    return NextResponse.json({
      tables: tables.map(t => t.table_name),
      totalPracticeAttempts: practiceAttempts.length,
      totalStudents: students.length,
      practiceAttempts,
      students,
      studentAttempts,
      debug: {
        tablesExist: tables.length,
        hasAttempts: practiceAttempts.length > 0,
        hasStudents: students.length > 0
      }
    })
  } catch (error) {
    console.error("Error debugging practice tables:", error)
    return NextResponse.json({ 
      error: "Failed to debug practice tables", 
      details: error.message 
    }, { status: 500 })
  }
}
