import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { resolveInstructorResultsCourseScope } from "@/lib/instructor-results-course-scope"

export const dynamic = "force-dynamic"

/**
 * GET /api/instructor/incomplete-attempts?quizId=123&sessionId=5
 * Returns students with incomplete attempts that have saved answers (candidates for "Submit on behalf").
 */
export async function GET(request: NextRequest) {
  try {
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    if (!instructorSession) {
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const quizId = searchParams.get("quizId")
    const sessionId = searchParams.get("sessionId")

    if (!quizId) {
      return NextResponse.json({ error: "quizId required" }, { status: 400 })
    }

    const scopeResult = await resolveInstructorResultsCourseScope(request)
    if (!scopeResult.ok) return scopeResult.response
    const { studentFilter, quizFilter } = scopeResult.scope

    const quizIdNum = parseInt(quizId, 10)
    if (Number.isNaN(quizIdNum)) {
      return NextResponse.json({ error: "Invalid quizId" }, { status: 400 })
    }

    let incomplete
    if (sessionId && sessionId !== "all") {
      incomplete = await sql`
        SELECT 
          qa.id as attempt_id,
          qa.student_id,
          s.full_name,
          s.student_id as student_number,
          s.email,
          s.section,
          (SELECT COUNT(*)::int FROM quiz_answers qans 
           WHERE qans.attempt_id = qa.id 
           AND ((qans.selected_answer IS NOT NULL AND qans.selected_answer != '')
                OR (qans.answer_data IS NOT NULL AND qans.answer_data::text != '{}'))) as answers_with_content
        FROM quiz_attempts qa
        JOIN students s ON s.id = qa.student_id
        JOIN quizzes q ON q.id = qa.quiz_id
        WHERE qa.quiz_id = ${quizIdNum}
          AND qa.completed_at IS NULL
          AND qa.deleted_at IS NULL
          AND q.deleted_at IS NULL
          AND s.session_id = ${parseInt(sessionId, 10)}
          ${studentFilter}
          ${quizFilter}
        ORDER BY s.full_name
      `
    } else {
      incomplete = await sql`
        SELECT 
          qa.id as attempt_id,
          qa.student_id,
          s.full_name,
          s.student_id as student_number,
          s.email,
          s.section,
          (SELECT COUNT(*)::int FROM quiz_answers qans 
           WHERE qans.attempt_id = qa.id 
           AND ((qans.selected_answer IS NOT NULL AND qans.selected_answer != '')
                OR (qans.answer_data IS NOT NULL AND qans.answer_data::text != '{}'))) as answers_with_content
        FROM quiz_attempts qa
        JOIN students s ON s.id = qa.student_id
        JOIN quizzes q ON q.id = qa.quiz_id
        WHERE qa.quiz_id = ${quizIdNum}
          AND qa.completed_at IS NULL
          AND qa.deleted_at IS NULL
          AND q.deleted_at IS NULL
          ${studentFilter}
          ${quizFilter}
        ORDER BY s.full_name
      `
    }

    const withContent = incomplete.filter((r: any) => (r.answers_with_content || 0) > 0)

    return NextResponse.json({
      incomplete: withContent,
      total: withContent.length,
    })
  } catch (error) {
    console.error("[Incomplete attempts] Error:", error)
    return NextResponse.json({ error: "Failed to fetch incomplete attempts" }, { status: 500 })
  }
}
