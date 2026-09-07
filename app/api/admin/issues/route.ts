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
    const status = searchParams.get("status") || "open"
    const assessmentType = searchParams.get("assessment_type") || searchParams.get("assessmentType")

    console.log("[Admin Issues] Fetching issues with params:", { status, assessmentType })

    let issues

    if (assessmentType) {
      // Filter by assessment type - handle NULL assessment_type for backward compatibility
      issues = await sql`
        SELECT 
          qi.id,
          COALESCE(qi.assessment_id, qi.quiz_id) as quiz_id,
          qi.assessment_type,
          qi.quiz_title,
          qi.question_number,
          qi.description,
          qi.status,
          qi.reporter_name as student_name,
          qi.reporter_id as student_email,
          qi.created_at,
          (SELECT COUNT(*) FROM quiz_issue_comments WHERE issue_id = qi.id) as comment_count
        FROM quiz_issues qi
        WHERE qi.status = ${status}
          AND (qi.assessment_type = ${assessmentType} OR (qi.assessment_type IS NULL AND ${assessmentType} = 'quiz'))
        ORDER BY qi.created_at DESC
      `
    } else {
      // Get all issues (backwards compatibility)
      issues = await sql`
        SELECT 
          qi.id,
          COALESCE(qi.assessment_id, qi.quiz_id) as quiz_id,
          qi.assessment_type,
          qi.quiz_title,
          qi.question_number,
          qi.description,
          qi.status,
          qi.reporter_name as student_name,
          qi.reporter_id as student_email,
          qi.created_at,
          (SELECT COUNT(*) FROM quiz_issue_comments WHERE issue_id = qi.id) as comment_count
        FROM quiz_issues qi
        WHERE qi.status = ${status}
        ORDER BY qi.created_at DESC
      `
    }

    console.log(`[Admin Issues] Found ${issues.length} issues for assessment_type: ${assessmentType}`)
    return NextResponse.json({ issues })
  } catch (error) {
    console.error("Failed to fetch issues:", error)
    return NextResponse.json({ error: "Failed to fetch issues" }, { status: 500 })
  }
}
