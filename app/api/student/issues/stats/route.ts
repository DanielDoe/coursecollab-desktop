import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id"
import {
  resolveStudentCourseContextByDbId,
  sqlQuizInStudentCourse,
} from "@/lib/student-course-scope"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"

export const dynamic = "force-dynamic"
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    if (!studentId) {
      return NextResponse.json({ error: "Student ID required" }, { status: 400 })
    }

    const auth = await requireBoundStudentCaller(request, studentId)
    if (!auth.ok) return auth.response

    const studentDbId = await resolveStudentDatabaseIdFromParam(studentId)
    if (studentDbId == null) {
      return NextResponse.json({
        stats: {
          total_issues: 0,
          open_issues: 0,
          resolved_issues: 0,
          closed_issues: 0,
          my_issues: 0,
          my_open_issues: 0,
          my_resolved_issues: 0,
          total_comments: 0,
          my_comments: 0,
        },
      })
    }
    const ctx = await resolveStudentCourseContextByDbId(studentDbId)
    const courseClause =
      ctx?.courseId != null ? sqlQuizInStudentCourse("q", ctx.courseId) : sql.unsafe("(FALSE)")

    const stats = await sql`
      SELECT 
        COUNT(*)::INTEGER as total_issues,
        COUNT(CASE WHEN qi.status = 'open' THEN 1 END)::INTEGER as open_issues,
        COUNT(CASE WHEN qi.status = 'resolved' THEN 1 END)::INTEGER as resolved_issues,
        COUNT(CASE WHEN qi.status = 'closed' THEN 1 END)::INTEGER as closed_issues,
        COUNT(CASE WHEN qi.reporter_id = ${studentId} THEN 1 END)::INTEGER as my_issues,
        COUNT(CASE WHEN qi.reporter_id = ${studentId} AND qi.status = 'open' THEN 1 END)::INTEGER as my_open_issues,
        COUNT(CASE WHEN qi.reporter_id = ${studentId} AND qi.status = 'resolved' THEN 1 END)::INTEGER as my_resolved_issues
      FROM quiz_issues qi
      JOIN quizzes q ON q.id = COALESCE(qi.assessment_id, qi.quiz_id)
      WHERE q.assessment_type = 'quiz'
        AND (q.deleted_at IS NULL OR q.deleted_at IS NULL)
        AND (${courseClause})
    `

    const commentStats = await sql`
      SELECT 
        COUNT(*)::INTEGER as total_comments,
        COUNT(CASE WHEN qic.commenter_id = ${studentId} THEN 1 END)::INTEGER as my_comments
      FROM quiz_issue_comments qic
      JOIN quiz_issues qi ON qic.issue_id = qi.id
      JOIN quizzes q ON q.id = COALESCE(qi.assessment_id, qi.quiz_id)
      WHERE q.assessment_type = 'quiz'
        AND (q.deleted_at IS NULL OR q.deleted_at IS NULL)
        AND (${courseClause})
    `

    const result = {
      ...stats[0],
      ...commentStats[0],
    }

    return NextResponse.json({ stats: result })
  } catch (error) {
    console.error("[v0] Failed to fetch issue stats:", error)
    return NextResponse.json({ error: "Failed to fetch issue stats" }, { status: 500 })
  }
}
