import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireProjectMemberOrInstructor, studentDbIdFromGroupsRequest } from "@/lib/project-request-auth"

// PATCH update a report
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const { reportId } = await params
    const { studentId, progress, challenges, deliverablesStatus } = await request.json()

    if (!progress) {
      return NextResponse.json({ error: "Progress is required" }, { status: 400 })
    }

    const reportCheck = await sql`
      SELECT id, student_id, project_id FROM project_reports WHERE id = ${reportId}
    `

    if (reportCheck.length === 0) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    const access = await requireProjectMemberOrInstructor(request, Number(reportCheck[0].project_id))
    if (!access.ok) return access.response
    if (access.role === "student" && Number(reportCheck[0].student_id) !== access.studentDbId) {
      return NextResponse.json({ error: "You can only edit your own reports" }, { status: 403 })
    }
    if (studentId && access.role === "student" && Number(studentId) !== access.studentDbId) {
      return NextResponse.json({ error: "You can only edit your own reports" }, { status: 403 })
    }

    const result = await sql`
      UPDATE project_reports
      SET 
        progress = ${progress},
        challenges = ${challenges || null},
        deliverables_status = ${deliverablesStatus || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${reportId}
      RETURNING id, project_id, student_id, progress, challenges, deliverables_status, created_at, updated_at
    `

    return NextResponse.json({ report: result[0] })
  } catch (error) {
    console.error("[v0] Failed to update project report:", error)
    return NextResponse.json({ error: "Failed to update project report" }, { status: 500 })
  }
}

// DELETE a report
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const { reportId } = await params
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    // Verify the student owns this report
    const reportCheck = await sql`
      SELECT id, student_id, project_id FROM project_reports WHERE id = ${reportId}
    `

    if (reportCheck.length === 0) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 })
    }

    const access = await requireProjectMemberOrInstructor(request, Number(reportCheck[0].project_id))
    if (!access.ok) return access.response
    const actorStudentId = await studentDbIdFromGroupsRequest(request)
    if (access.role === "student" && Number(reportCheck[0].student_id) !== actorStudentId) {
      return NextResponse.json({ error: "You can only delete your own reports" }, { status: 403 })
    }
    if (studentId && access.role === "student" && reportCheck[0].student_id !== Number.parseInt(studentId)) {
      return NextResponse.json({ error: "You can only delete your own reports" }, { status: 403 })
    }

    await sql`
      DELETE FROM project_reports WHERE id = ${reportId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to delete project report:", error)
    return NextResponse.json({ error: "Failed to delete project report" }, { status: 500 })
  }
}
