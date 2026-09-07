import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

import { createNotification } from "@/lib/create-notification"


export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const issueId = Number.parseInt(params.id)

    const body = await request.json()
    const { status, resolution_comment } = body

    // First, get the issue details including reporter information
    const issueResult = await sql`
      SELECT 
        qi.*,
        s.student_id as reporter_student_id,
        s.full_name as reporter_name
      FROM quiz_issues qi
      LEFT JOIN students s ON qi.reporter_id = s.id
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

    return NextResponse.json({ 
      success: true,
      message: status === "closed" ? "Issue closed and notification sent" : "Issue reopened and notification sent"
    })
  } catch (error) {
    console.error("Failed to update issue status:", error)
    return NextResponse.json({ error: "Failed to update issue status" }, { status: 500 })
  }
}
