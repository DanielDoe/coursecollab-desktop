import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

import { createNotification } from "@/lib/create-notification"
import { logAssessmentIssueToSystemLog } from "@/lib/system-log-assessment-issue"


export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify instructor authentication
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    
    if (!instructorSession) {
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

    const { id } = await params
    const issueId = Number.parseInt(id)

    const body = await request.json()
    const { status, resolution_comment } = body

    // First, get the issue details including reporter information
    const issueResult = await sql`
      SELECT 
        qi.*,
        s.student_id as reporter_student_id,
        qi.reporter_name,
        qi.quiz_title
      FROM quiz_issues qi
      LEFT JOIN students s ON qi.reporter_id = s.student_id
      WHERE qi.id = ${issueId}
    `

    if (issueResult.length === 0) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 })
    }

    const issue = issueResult[0]

    // Update the issue status
    await sql`
      UPDATE quiz_issues
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${issueId}
    `

    // If closing the issue and we have a reporter, send notification
    if (status === "closed" && issue.reporter_student_id) {
      try {
        const notificationTitle = `Issue Resolved: ${issue.quiz_title}`
        const notificationMessage = resolution_comment 
          ? `Your reported issue for "${issue.quiz_title}" has been resolved. Resolution: ${resolution_comment}`
          : `Your reported issue for "${issue.quiz_title}" has been resolved by the instructor.`

        await createNotification({
          studentId: issue.reporter_student_id,
          type: "quiz",
          title: notificationTitle,
          message: notificationMessage,
          link: "/student/issues"
        })

        console.log(`[v0] ✅ Notification sent to student ${issue.reporter_student_id} for closed issue ${issueId}`)
      } catch (notificationError) {
        console.error("[v0] ❌ Failed to send notification:", notificationError)
        // Don't fail the entire operation if notification fails
      }
    }

    // If reopening the issue, also send a notification
    if (status === "open" && issue.reporter_student_id) {
      try {
        const notificationTitle = `Issue Reopened: ${issue.quiz_title}`
        const notificationMessage = `Your reported issue for "${issue.quiz_title}" has been reopened for further investigation.`

        await createNotification({
          studentId: issue.reporter_student_id,
          type: "quiz",
          title: notificationTitle,
          message: notificationMessage,
          link: "/student/issues"
        })

        console.log(`[v0] ✅ Notification sent to student ${issue.reporter_student_id} for reopened issue ${issueId}`)
      } catch (notificationError) {
        console.error("[v0] ❌ Failed to send notification:", notificationError)
        // Don't fail the entire operation if notification fails
      }
    }

    if (status === "open") {
      void logAssessmentIssueToSystemLog({
        issueId,
        eventType: "issue_reopened",
        assessmentType: issue.assessment_type as string | null,
        assessmentId: (issue.assessment_id ?? issue.quiz_id) as number | null,
        assessmentTitle: issue.quiz_title as string | null,
        description: String(issue.description ?? ""),
        reporterName: issue.reporter_name as string | null,
        reporterId: issue.reporter_id as string | null,
        commenterRole: "instructor",
        commentText: resolution_comment ?? "Issue reopened by instructor",
      })
    }

    return NextResponse.json({
      success: true,
      message: status === "closed" ? "Issue closed and notification sent" : "Issue reopened and notification sent",
    })
  } catch (error) {
    console.error("Failed to update issue status:", error)
    return NextResponse.json({ error: "Failed to update issue status" }, { status: 500 })
  }
}

