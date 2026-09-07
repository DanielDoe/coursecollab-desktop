import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { logAssessmentIssueToSystemLog } from "@/lib/system-log-assessment-issue"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] Issues API: GET request received")
    const { searchParams } = new URL(request.url)
    const examId = searchParams.get("examId")
    const status = searchParams.get("status") || "open"

    console.log("[v0] Issues API: examId:", examId, "status:", status)

    if (!examId) {
      return NextResponse.json({ error: "Exam ID required" }, { status: 400 })
    }

    const issues = await sql`
      SELECT 
        qi.id,
        COALESCE(qi.assessment_id, qi.quiz_id) as exam_id,
        qi.quiz_title as exam_title,
        qi.question_number,
        qi.description,
        qi.status,
        qi.created_at,
        qi.updated_at as closed_at,
        qi.reporter_name,
        qi.reporter_id,
        COALESCE(comment_counts.comment_count, 0) as comment_count
      FROM quiz_issues qi
      LEFT JOIN (
        SELECT 
          issue_id,
          COUNT(*) as comment_count
        FROM quiz_issue_comments
        GROUP BY issue_id
      ) comment_counts ON qi.id = comment_counts.issue_id
      WHERE (qi.assessment_id = ${examId} OR qi.quiz_id = ${examId})
        AND qi.issue_type = 'issue'
        AND qi.status = ${status}
        AND (qi.assessment_type = 'mid_semester' OR qi.assessment_type IS NULL)
      ORDER BY qi.created_at DESC
    `

    console.log("[v0] Issues API: Found", issues.length, "issues")
    return NextResponse.json({ issues })
  } catch (error) {
    console.error("[v0] Error fetching issues:", error)
    return NextResponse.json({ error: "Failed to fetch issues" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Issues API: POST request received")
    const body = await request.json()
    const { examId, examTitle, questionNumber, description, reporterName, reporterId } = body

    console.log("[v0] Issues API: POST data:", { examId, examTitle, questionNumber, descriptionLength: description?.length })

    if (!examId || !examTitle || !description || !reporterName || !reporterId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO quiz_issues (
        quiz_id,
        assessment_id,
        assessment_type,
        quiz_title,
        question_number,
        reporter_id, 
        reporter_name,
        description, 
        issue_type, 
        status
      )
      VALUES (
        ${examId},
        ${examId},
        'mid_semester',
        ${examTitle},
        ${questionNumber},
        ${reporterId}, 
        ${reporterName},
        ${description}, 
        'issue', 
        'open'
      )
      RETURNING id, created_at
    `

    const created = result[0] as { id: number }
    void logAssessmentIssueToSystemLog({
      issueId: created.id,
      eventType: "new_issue",
      assessmentType: "mid_semester",
      assessmentId: examId,
      assessmentTitle: examTitle,
      description,
      reporterName: reporterName,
      reporterId: reporterId,
      questionNumber: questionNumber ?? null,
    })

    console.log("[v0] Issues API: Issue created:", result[0])
    return NextResponse.json({ success: true, issue: result[0] })
  } catch (error) {
    console.error("[v0] Error creating issue:", error)
    return NextResponse.json({ error: "Failed to create issue" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    console.log("[v0] Issues API: PATCH request received")
    const body = await request.json()
    const { issueId, status } = body

    console.log("[v0] Issues API: PATCH data:", { issueId, status })

    if (!issueId || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const closedAt = status === "closed" ? new Date().toISOString() : null

    await sql`
      UPDATE quiz_issues
      SET status = ${status}, updated_at = ${closedAt}
      WHERE id = ${issueId}
    `

    console.log("[v0] Issues API: Issue updated")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error updating issue:", error)
    return NextResponse.json({ error: "Failed to update issue" }, { status: 500 })
  }
}
