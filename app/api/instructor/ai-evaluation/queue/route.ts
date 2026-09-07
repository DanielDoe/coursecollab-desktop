import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

import { ensureAiEvaluationSchema } from "@/lib/ensure-ai-evaluation-schema"
import { requireInstructorGradingAccess } from "@/lib/instructor-grading-auth"


export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    await ensureAiEvaluationSchema(sql)

    const gradingAuth = await requireInstructorGradingAccess(request)
    if (!gradingAuth.ok) return gradingAuth.response

    // Get instructor session (basic validation)
    const instructorSession = request.headers.get("authorization") || request.headers.get("cookie")
    
    const url = new URL(request.url)
    const assessmentTypeFilter = url.searchParams.get("assessment_type") || undefined

    let evaluations
    if (assessmentTypeFilter) {
      evaluations = await sql`
        SELECT 
          aeq.id,
          aeq.attempt_id,
          aeq.question_id,
          aeq.student_id,
          s.student_id AS student_number,
          s.full_name AS student_name,
          aeq.question_type,
          aeq.assessment_type,
          aeq.question_text,
          aeq.student_answer,
          aeq.correct_answer as rubric,
          aeq.max_points,
          aeq.error_type,
          aeq.error_message,
          aeq.status,
          aeq.created_at,
          aeq.retry_count,
          q.title as quiz_title
        FROM ai_evaluation_queue aeq
        JOIN students s ON aeq.student_id = s.id
        JOIN quiz_attempts qa ON aeq.attempt_id = qa.id
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE aeq.status IN ('pending', 'retried', 'failed')
          AND aeq.assessment_type = ${assessmentTypeFilter}
        ORDER BY aeq.created_at DESC
      `
    } else {
      evaluations = await sql`
        SELECT 
          aeq.id,
          aeq.attempt_id,
          aeq.question_id,
          aeq.student_id,
          s.student_id AS student_number,
          s.full_name AS student_name,
          aeq.question_type,
          aeq.assessment_type,
          aeq.question_text,
          aeq.student_answer,
          aeq.correct_answer as rubric,
          aeq.max_points,
          aeq.error_type,
          aeq.error_message,
          aeq.status,
          aeq.created_at,
          aeq.retry_count,
          q.title as quiz_title
        FROM ai_evaluation_queue aeq
        JOIN students s ON aeq.student_id = s.id
        JOIN quiz_attempts qa ON aeq.attempt_id = qa.id
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE aeq.status IN ('pending', 'retried', 'failed')
        ORDER BY aeq.created_at DESC
      `
    }

    // Calculate stats
    const stats = {
      total: evaluations.length,
      pending: evaluations.filter(e => e.status === 'pending').length,
      retried: evaluations.filter(e => e.status === 'retried').length,
      failed: evaluations.filter(e => e.status === 'failed').length,
      resolved: 0 // Will be fetched separately if needed
    }

    return NextResponse.json({
      evaluations,
      stats
    })
  } catch (error) {
    console.error("[Instructor AI Eval Queue] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch AI evaluation queue" },
      { status: 500 }
    )
  }
}

