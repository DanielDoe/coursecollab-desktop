import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { logAssessmentIssueToSystemLog } from "@/lib/system-log-assessment-issue"

export const dynamic = 'force-dynamic'
export const runtime = "nodejs"

/**
 * POST /api/student/record-finalization-issue
 * Records a finalization problem for the instructor when the student's submit fails
 * (e.g. network timeout, server error). Called from the quiz-taker when finalize
 * fails so the instructor can follow up and prevent data loss.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { attemptId, quizId, errorType, errorMessage, studentId } = body

    if (!attemptId || !quizId) {
      return NextResponse.json({ error: "attemptId and quizId required" }, { status: 400 })
    }

    const [info] = await sql`
      SELECT qa.student_id, s.full_name, s.email, q.title as quiz_title, q.assessment_type
      FROM quiz_attempts qa
      JOIN students s ON qa.student_id = s.id
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.id = ${Number(attemptId)} AND qa.quiz_id = ${Number(quizId)}
    `

    if (!info) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }

    const desc = `[System] Finalization failed: ${errorType || 'unknown'}. ${errorMessage || ''} Student "${info.full_name}" may have completed the quiz. Attempt ID: ${attemptId}. Please check if attempt has saved answers and use "Submit on behalf" if needed.`

    const [inserted] = await sql`
      INSERT INTO quiz_issues (
        quiz_id, assessment_id, assessment_type, quiz_title, question_number,
        description, reporter_name, reporter_id, issue_type, status
      )
      VALUES (
        ${Number(quizId)}, ${Number(quizId)}, ${info.assessment_type || 'quiz'}, ${info.quiz_title}, NULL,
        ${desc},
        ${info.full_name}, ${String(info.email || info.full_name)}, 'issue', 'open'
      )
      RETURNING id
    `

    const issueId = Number((inserted as { id: number }).id)
    void logAssessmentIssueToSystemLog({
      issueId,
      eventType: "finalization_failure",
      assessmentType: String(info.assessment_type || "quiz"),
      assessmentId: Number(quizId),
      assessmentTitle: String(info.quiz_title),
      description: desc,
      reporterName: String(info.full_name),
      reporterId: studentId ? String(studentId) : String(info.email || info.full_name),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Record Finalization Issue] Error:", error)
    return NextResponse.json({ error: "Failed to record issue" }, { status: 500 })
  }
}
