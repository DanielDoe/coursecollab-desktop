import { NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET() {
  try {
    console.log("[Check Empty Strings] Analyzing answer storage...")
    
    // Count answers with empty strings (after fix)
    const emptyStringCount = await sql`
      SELECT COUNT(*) as count
      FROM quiz_answers
      WHERE selected_answer = ''
    `
    
    // Count answers with NULL (skipped)
    const nullCount = await sql`
      SELECT COUNT(*) as count
      FROM quiz_answers
      WHERE selected_answer IS NULL
    `
    
    // Get recent examples of empty strings
    const emptyExamples = await sql`
      SELECT 
        qa.id,
        qa.attempt_id,
        qa.question_id,
        qa.selected_answer,
        qa.is_correct,
        qa.points_earned,
        qa.answered_at,
        qq.question_type,
        qq.question_text,
        s.full_name as student_name
      FROM quiz_answers qa
      JOIN quiz_questions qq ON qa.question_id = qq.id
      JOIN quiz_attempts qatt ON qa.attempt_id = qatt.id
      JOIN students s ON qatt.student_id = s.id
      WHERE qa.selected_answer = ''
      ORDER BY qa.answered_at DESC
      LIMIT 10
    `
    
    // Get recent examples of NULL
    const nullExamples = await sql`
      SELECT 
        qa.id,
        qa.attempt_id,
        qa.question_id,
        qa.selected_answer,
        qa.is_correct,
        qa.points_earned,
        qa.answered_at,
        qq.question_type,
        qq.question_text,
        s.full_name as student_name
      FROM quiz_answers qa
      JOIN quiz_questions qq ON qa.question_id = qq.id
      JOIN quiz_attempts qatt ON qa.attempt_id = qatt.id
      JOIN students s ON qatt.student_id = s.id
      WHERE qa.selected_answer IS NULL
      ORDER BY qa.answered_at DESC
      LIMIT 10
    `
    
    const emptyCount = Number(emptyStringCount[0].count)
    const nullCountNum = Number(nullCount[0].count)
    const totalCount = emptyCount + nullCountNum
    
    console.log("[Check Empty Strings] Results:")
    console.log("  Empty strings:", emptyCount)
    console.log("  NULL values:", nullCountNum)
    console.log("  Total:", totalCount)
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: emptyCount,
      null_count: nullCountNum,
      total_count: totalCount,
      percentage_empty: totalCount > 0 ? ((emptyCount / totalCount) * 100).toFixed(1) : "0",
      percentage_null: totalCount > 0 ? ((nullCountNum / totalCount) * 100).toFixed(1) : "0",
      empty_examples: emptyExamples.map(e => ({
        id: e.id,
        attempt_id: e.attempt_id,
        student_name: e.student_name,
        question_type: e.question_type,
        question_text: e.question_text.substring(0, 100),
        selected_answer: e.selected_answer,
        is_correct: e.is_correct,
        points_earned: e.points_earned,
        answered_at: e.answered_at
      })),
      null_examples: nullExamples.map(e => ({
        id: e.id,
        attempt_id: e.attempt_id,
        student_name: e.student_name,
        question_type: e.question_type,
        question_text: e.question_text.substring(0, 100),
        selected_answer: e.selected_answer,
        is_correct: e.is_correct,
        points_earned: e.points_earned,
        answered_at: e.answered_at
      }))
    })
  } catch (error) {
    console.error("[Check Empty Strings] Error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

