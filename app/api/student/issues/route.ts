import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id"
import {
  resolveStudentCourseContextByDbId,
  sqlQuizInStudentCourse,
} from "@/lib/student-course-scope"
import { logAssessmentIssueToSystemLog } from "@/lib/system-log-assessment-issue"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"

export const dynamic = "force-dynamic"
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || "open"
    const studentId = searchParams.get("studentId")
    const assessmentType = searchParams.get("assessmentType") || "quiz"

    if (!studentId) {
      return NextResponse.json({ error: "Student ID required" }, { status: 400 })
    }

    const auth = await requireBoundStudentCaller(request, studentId)
    if (!auth.ok) return auth.response

    const studentDbId = await resolveStudentDatabaseIdFromParam(studentId)
    if (studentDbId == null) {
      return NextResponse.json({ issues: [] })
    }
    const ctx = await resolveStudentCourseContextByDbId(studentDbId)
    const courseClause =
      ctx?.courseId != null ? sqlQuizInStudentCourse("q", ctx.courseId) : sql.unsafe("(FALSE)")

    const issues = await sql`
      SELECT 
        qi.*,
        (SELECT COUNT(*)::INTEGER FROM quiz_issue_comments WHERE issue_id = qi.id) as comment_count,
        CASE WHEN qi.reporter_id = ${studentId} THEN true ELSE false END as can_edit,
        CASE WHEN qi.reporter_id = ${studentId} THEN true ELSE false END as can_delete
      FROM quiz_issues qi
      INNER JOIN quizzes q ON q.id = COALESCE(qi.assessment_id, qi.quiz_id)
      WHERE qi.status = ${status}
        AND (qi.assessment_type = ${assessmentType} OR (qi.assessment_type IS NULL AND ${assessmentType} = 'quiz'))
        AND (${courseClause})
      ORDER BY qi.created_at DESC
    `

    return NextResponse.json({ issues })
  } catch (error) {
    console.error("[v0] Failed to fetch issues:", error)
    return NextResponse.json({ error: "Failed to fetch issues" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { quizId, quizTitle, questionNumber, description, reporterName, reporterId, assessmentType } = body

    if (!quizId || !description || !reporterName || !reporterId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const auth = await requireBoundStudentCaller(request, String(reporterId))
    if (!auth.ok) return auth.response

    const actualAssessmentType = assessmentType || "quiz"

    const [issue] = await sql`
      INSERT INTO quiz_issues (
        quiz_id,
        assessment_id,
        assessment_type,
        quiz_title, 
        question_number, 
        description, 
        reporter_name, 
        reporter_id,
        issue_type,
        status
      )
      VALUES (
        ${quizId},
        ${quizId},
        ${actualAssessmentType},
        ${quizTitle}, 
        ${questionNumber || null}, 
        ${description}, 
        ${reporterName}, 
        ${reporterId},
        'issue',
        'open'
      )
      RETURNING *
    `

    const created = issue as {
      id: number
      quiz_title?: string
      assessment_type?: string
      quiz_id?: number
      description?: string
      reporter_name?: string
      reporter_id?: string
      question_number?: number | null
    }

    void logAssessmentIssueToSystemLog({
      issueId: created.id,
      eventType: "new_issue",
      assessmentType: actualAssessmentType,
      assessmentId: quizId,
      assessmentTitle: quizTitle ?? created.quiz_title,
      description,
      reporterName: reporterName,
      reporterId: reporterId,
      questionNumber: questionNumber ?? created.question_number,
    })

    return NextResponse.json({ issue })
  } catch (error) {
    console.error("[v0] Failed to create issue:", error)
    return NextResponse.json({ error: "Failed to create issue" }, { status: 500 })
  }
}
