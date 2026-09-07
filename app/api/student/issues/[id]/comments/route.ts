import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { requireInstructorSession } from "@/lib/instructor-session-auth"

import { createNotification } from "@/lib/create-notification"
import { logAssessmentIssueToSystemLog } from "@/lib/system-log-assessment-issue"


export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const issueId = Number.parseInt(id)
    const student = await requireCallerStudentDbId(request)
    const instructor = student.ok ? null : await requireInstructorSession(request)
    if (!student.ok && (!instructor || !instructor.ok)) {
      return NextResponse.json({ error: "Student or instructor authentication required" }, { status: 401 })
    }

    const viewerId = student.ok ? String(student.studentDbId) : "instructor"
    const comments = await sql`
      SELECT 
        qic.*,
        (qic.commenter_id::text = ${viewerId} OR qic.commenter_id = ${viewerId}) as can_edit,
        (qic.commenter_id::text = ${viewerId} OR qic.commenter_id = ${viewerId}) as can_delete
      FROM quiz_issue_comments qic
      WHERE qic.issue_id = ${issueId}
      ORDER BY qic.created_at ASC
    `

    return NextResponse.json({ comments })
  } catch (error) {
    console.error("[v0] Failed to fetch comments:", error)
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const issueId = Number.parseInt(id)
    const body = await request.json()
    const { commenterName, commentText } = body

    const student = await requireCallerStudentDbId(request)
    const instructor = student.ok ? null : await requireInstructorSession(request)
    if (!student.ok && (!instructor || !instructor.ok)) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const commenterId = student.ok ? String(student.studentDbId) : String(instructor!.instructorId)
    const commenterRole = student.ok ? "student" : "instructor"

    if (!commenterName || !commentText) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const [comment] = await sql`
      INSERT INTO quiz_issue_comments (issue_id, commenter_name, commenter_id, commenter_role, comment_text)
      VALUES (${issueId}, ${commenterName}, ${commenterId}, ${commenterRole}, ${commentText})
      RETURNING *
    `

    // If the commenter is an instructor or admin, notify the student who reported the issue
    if (commenterRole === "instructor" || commenterRole === "admin") {
      try {
        // Get the issue details to find the reporter
        const issueResult = await sql`
          SELECT 
            qi.reporter_id,
            qi.quiz_title,
            qi.description,
            s.student_id as reporter_student_id
          FROM quiz_issues qi
          LEFT JOIN students s ON qi.reporter_id = s.student_id
          WHERE qi.id = ${issueId}
        `

        if (issueResult.length > 0 && issueResult[0].reporter_student_id) {
          const issue = issueResult[0]
          
          await createNotification({
            studentId: issue.reporter_student_id,
            type: "quiz",
            title: `New Comment on Your Issue`,
            message: `${commenterName} replied to your issue for "${issue.quiz_title}": "${commentText.substring(0, 100)}${commentText.length > 100 ? '...' : ''}"`,
            link: "/student/issues"
          })

          console.log(`[v0] ✅ Notification sent to student ${issue.reporter_student_id} for new comment on issue ${issueId}`)
        }
      } catch (notificationError) {
        console.error("[v0] ❌ Failed to send comment notification:", notificationError)
        // Don't fail the entire operation if notification fails
      }
    }

    try {
      const [issueRow] = await sql`
        SELECT id, quiz_title, assessment_type, quiz_id, assessment_id, description,
               reporter_name, reporter_id, question_number
        FROM quiz_issues WHERE id = ${issueId} LIMIT 1
      `
      if (issueRow) {
        const row = issueRow as {
          id: number
          quiz_title: string | null
          assessment_type: string | null
          quiz_id: number | null
          assessment_id: number | null
          description: string | null
          reporter_name: string | null
          reporter_id: string | null
          question_number: number | null
        }
        void logAssessmentIssueToSystemLog({
          issueId: row.id,
          eventType: "new_comment",
          assessmentType: row.assessment_type,
          assessmentId: row.assessment_id ?? row.quiz_id,
          assessmentTitle: row.quiz_title,
          description: row.description ?? "",
          reporterName: row.reporter_name,
          reporterId: row.reporter_id,
          commenterName: commenterName,
          commenterRole: commenterRole || "student",
          commentText: commentText,
          questionNumber: row.question_number,
        })
      }
    } catch (logErr) {
      console.warn("[API Comments] system log failed", logErr)
    }

    console.log("[API Comments] Returning success response")
    return NextResponse.json({ comment, success: true })
  } catch (error) {
    console.error("[API Comments] ❌ Failed to create comment:", error)
    console.error("[API Comments] Error stack:", error instanceof Error ? error.stack : String(error))
    return NextResponse.json({ 
      error: "Failed to create comment",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
