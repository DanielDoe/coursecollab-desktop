import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { logAssessmentIssueToSystemLog } from "@/lib/system-log-assessment-issue"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] Comments API: GET request received")
    const { searchParams } = new URL(request.url)
    const examId = searchParams.get("examId")

    console.log("[v0] Comments API: examId:", examId)

    if (!examId) {
      return NextResponse.json({ error: "Exam ID required" }, { status: 400 })
    }

    const comments = await sql`
      SELECT 
        qi.id,
        qi.description as text,
        qi.created_at,
        qi.reporter_name as author,
        qi.reporter_id as student_id,
        qi.status
      FROM quiz_issues qi
      JOIN quizzes q ON qi.quiz_id = q.id
      WHERE qi.quiz_id = ${examId}
        AND qi.issue_type = 'comment'
        AND q.assessment_type = 'mid_semester'
      ORDER BY qi.created_at DESC
    `

    console.log("[v0] Comments API: Found", comments.length, "comments")
    return NextResponse.json({ comments })
  } catch (error) {
    console.error("[v0] Error fetching comments:", error)
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Comments API: POST request received")
    const body = await request.json()
    const { examId, studentId, text } = body

    console.log("[v0] Comments API: POST data:", { examId, studentId, textLength: text?.length })

    if (!examId || !studentId || !text) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get student info for reporter_name
    const studentResult = await sql`
      SELECT id, full_name FROM students WHERE student_id = ${studentId}
    `

    if (studentResult.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const student = studentResult[0]
    console.log("[v0] Comments API: Student found:", { id: student.id, name: student.full_name })

    const result = await sql`
      INSERT INTO quiz_issues (
        quiz_id, 
        quiz_title,
        reporter_id, 
        reporter_name,
        description, 
        issue_type, 
        status
      )
      VALUES (
        ${examId}, 
        'Mid-Semester Exam',
        ${studentId}, 
        ${student.full_name},
        ${text}, 
        'comment', 
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
      assessmentTitle: "Mid-Semester Exam",
      description: text,
      reporterName: student.full_name as string,
      reporterId: studentId,
    })

    console.log("[v0] Comments API: Comment created:", result[0])
    return NextResponse.json({ success: true, comment: result[0] })
  } catch (error) {
    console.error("[v0] Error posting comment:", error)
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 })
  }
}
