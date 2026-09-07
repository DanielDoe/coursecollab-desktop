import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { createNotification } from "@/lib/create-notification"

import { cookies } from "next/headers"

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const cookieStore = await cookies()
    const adminId = cookieStore.get("adminId")?.value

    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { issueId, resolutionComment } = body

    if (!issueId) {
      return NextResponse.json({ error: "Issue ID required" }, { status: 400 })
    }

    const issueResult = await sql`
      SELECT qi.*, s.student_id as reporter_student_id
      FROM quiz_issues qi
      LEFT JOIN students s ON qi.reporter_id = s.id
      WHERE qi.id = ${issueId}
      LIMIT 1
    `

    if (issueResult.length === 0) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 })
    }

    const issue = issueResult[0]

    const result = await sql`
      UPDATE quiz_issues
      SET
        status = 'closed',
        closed_by = ${adminId},
        closed_at = NOW(),
        resolution_comment = ${resolutionComment || null},
        updated_at = NOW()
      WHERE id = ${issueId}
      RETURNING id
    `

    const studentIdForNotify = issue.reporter_student_id || issue.reporter_id
    if (studentIdForNotify && resolutionComment) {
      try {
        await createNotification({
          studentId: studentIdForNotify,
          type: "quiz",
          title: `Issue resolved: ${issue.quiz_title || "Mid-semester exam"}`,
          message: String(resolutionComment).slice(0, 500),
          link: "/student/issues",
        })
      } catch (notificationError) {
        console.error("[v0] Failed to send issue close notification:", notificationError)
      }
    }

    return NextResponse.json({ success: true, issue: result[0] })
  } catch (error) {
    console.error("[v0] Error closing issue:", error)
    return NextResponse.json({ error: "Failed to close issue" }, { status: 500 })
  }
}
