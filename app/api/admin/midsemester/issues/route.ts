import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { searchParams } = new URL(request.url)
    const examId = searchParams.get("examId")

    if (!examId) {
      return NextResponse.json({ error: "Exam ID required" }, { status: 400 })
    }

    const issues = await sql`
      SELECT 
        qi.id,
        qi.quiz_title as title,
        qi.description,
        qi.status,
        qi.created_at,
        qi.closed_at,
        qi.resolution_comment,
        qi.reporter_name as student_name,
        qi.reporter_id as student_id,
        a.username as closed_by_username
      FROM quiz_issues qi
      JOIN quizzes q ON qi.quiz_id = q.id
      LEFT JOIN admin_users a ON qi.closed_by = a.id
      WHERE qi.quiz_id = ${examId}
        AND qi.issue_type = 'issue'
        AND q.assessment_type = 'mid_semester'
      ORDER BY 
        CASE WHEN qi.status = 'open' THEN 0 ELSE 1 END,
        qi.created_at DESC
    `

    // Fetch comments for each issue
    for (const issue of issues) {
      const comments = await sql`
        SELECT 
          qic.id,
          qic.comment_text as text,
          qic.created_at,
          qic.commenter_role as author_type,
          qic.commenter_name as author
        FROM quiz_issue_comments qic
        WHERE qic.issue_id = ${issue.id}
        ORDER BY qic.created_at ASC
      `
      issue.comments = comments
    }

    return NextResponse.json({ issues })
  } catch (error) {
    console.error("[v0] Error fetching admin issues:", error)
    return NextResponse.json({ error: "Failed to fetch issues" }, { status: 500 })
  }
}
