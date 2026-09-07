import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

import { createNotification } from "@/lib/create-notification"


export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const issueId = params.id

    const comments = await sql`
      SELECT 
        qic.id,
        qic.commenter_name,
        qic.commenter_role,
        qic.comment_text,
        qic.created_at
      FROM quiz_issue_comments qic
      WHERE qic.issue_id = ${issueId}
      ORDER BY qic.created_at ASC
    `

    return NextResponse.json({ comments })
  } catch (error) {
    console.error("[v0] Error fetching issue comments:", error)
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const issueId = params.id
    const body = await request.json()
    const { commenterName, commenterId, commenterRole, commentText } = body

    console.log("[API Mid-Semester Comments] Received comment request:", { 
      issueId, 
      commenterName, 
      commenterId, 
      commenterRole, 
      commentTextLength: commentText?.length 
    })

    if (!commenterName || !commenterId || !commenterRole || !commentText) {
      console.error("[API Mid-Semester Comments] Missing fields:", { 
        commenterName: !!commenterName, 
        commenterId: !!commenterId, 
        commenterRole: !!commenterRole, 
        commentText: !!commentText 
      })
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO quiz_issue_comments (
        issue_id,
        commenter_name,
        commenter_id,
        commenter_role,
        comment_text
      )
      VALUES (
        ${issueId},
        ${commenterName},
        ${commenterId},
        ${commenterRole},
        ${commentText}
      )
      RETURNING id, created_at
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
            type: "exam",
            title: `New Comment on Your Issue`,
            message: `${commenterName} replied to your issue for "${issue.quiz_title}": "${commentText.substring(0, 100)}${commentText.length > 100 ? '...' : ''}"`,
            link: "/student/mid-semester-exams"
          })

          console.log(`[v0] ✅ Notification sent to student ${issue.reporter_student_id} for new comment on mid-semester issue ${issueId}`)
        }
      } catch (notificationError) {
        console.error("[v0] ❌ Failed to send comment notification:", notificationError)
        // Don't fail the entire operation if notification fails
      }
    }

    console.log("[API Mid-Semester Comments] Returning success response")
    return NextResponse.json({ success: true, comment: result[0] })
  } catch (error) {
    console.error("[API Mid-Semester Comments] ❌ Failed to add comment:", error)
    console.error("[API Mid-Semester Comments] Error stack:", error instanceof Error ? error.stack : String(error))
    return NextResponse.json({ 
      error: "Failed to add comment",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

