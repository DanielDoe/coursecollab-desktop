import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const issueId = Number.parseInt(params.id)
    const caller = await requireCallerStudentDbId(request)
    if (!caller.ok) return caller.response
    const studentIdHeader = String(caller.studentDbId)

    const issue = await sql`
      SELECT 
        qi.*,
        (SELECT COUNT(*)::INTEGER FROM quiz_issue_comments WHERE issue_id = qi.id) as comment_count
      FROM quiz_issues qi
      WHERE qi.id = ${issueId}
    `

    if (issue.length === 0) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 })
    }

    const issueData = issue[0]
    
    // Add ownership information
    const canEdit = issueData.reporter_id === studentIdHeader

    return NextResponse.json({ 
      issue: issueData,
      canEdit,
      canDelete: canEdit
    })
  } catch (error) {
    console.error("Failed to fetch issue:", error)
    return NextResponse.json({ error: "Failed to fetch issue" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const issueId = Number.parseInt(params.id)
    const body = await request.json()
    const { description } = body

    const caller = await requireCallerStudentDbId(request)
    if (!caller.ok) return caller.response
    const studentIdHeader = String(caller.studentDbId)

    // Check if issue exists and belongs to the student
    const issueCheck = await sql`
      SELECT id FROM quiz_issues 
      WHERE id = ${issueId} AND reporter_id = ${studentIdHeader}
    `

    if (issueCheck.length === 0) {
      return NextResponse.json({ error: "Issue not found or access denied" }, { status: 404 })
    }

    await sql`
      UPDATE quiz_issues
      SET description = ${description}, updated_at = NOW()
      WHERE id = ${issueId} AND reporter_id = ${studentIdHeader}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to update issue:", error)
    return NextResponse.json({ error: "Failed to update issue" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const issueId = Number.parseInt(params.id)

    const caller = await requireCallerStudentDbId(request)
    if (!caller.ok) return caller.response
    const studentIdHeader = String(caller.studentDbId)

    // Check if issue exists and belongs to the student
    const issueCheck = await sql`
      SELECT id FROM quiz_issues 
      WHERE id = ${issueId} AND reporter_id = ${studentIdHeader}
    `

    if (issueCheck.length === 0) {
      return NextResponse.json({ error: "Issue not found or access denied" }, { status: 404 })
    }

    // Delete comments first (foreign key constraint)
    await sql`DELETE FROM quiz_issue_comments WHERE issue_id = ${issueId}`
    // Delete the issue
    await sql`DELETE FROM quiz_issues WHERE id = ${issueId} AND reporter_id = ${studentIdHeader}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete issue:", error)
    return NextResponse.json({ error: "Failed to delete issue" }, { status: 500 })
  }
}
