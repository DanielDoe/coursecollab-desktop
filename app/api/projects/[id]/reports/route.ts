import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireProjectMemberOrInstructor } from "@/lib/project-request-auth"

// GET all reports for a project
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params

    const projectIdNum = Number.parseInt(projectId, 10)
    if (isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID - must be a number" }, { status: 400 })
    }

    const access = await requireProjectMemberOrInstructor(request, projectIdNum)
    if (!access.ok) return access.response

    const reports = await sql`
      SELECT 
        pr.id,
        pr.project_id,
        pr.student_id,
        pr.progress,
        pr.challenges,
        pr.deliverables_status,
        pr.created_at,
        pr.updated_at,
        s.full_name as student_name,
        s.student_id as student_number
      FROM project_reports pr
      JOIN students s ON pr.student_id = s.id
      WHERE pr.project_id = ${projectIdNum}
      ORDER BY pr.created_at DESC
    `

    return NextResponse.json({ reports })
  } catch (error) {
    console.error("[v0] Failed to fetch project reports:", error)
    return NextResponse.json({ error: "Failed to fetch project reports" }, { status: 500 })
  }
}

// POST create a new report
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params

    const projectIdNum = Number.parseInt(projectId, 10)
    if (isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID - must be a number" }, { status: 400 })
    }

    const access = await requireProjectMemberOrInstructor(request, projectIdNum)
    if (!access.ok) return access.response

    const { studentId, progress, challenges, deliverablesStatus } = await request.json()

    if (!studentId || !progress) {
      return NextResponse.json({ error: "Student ID and progress are required" }, { status: 400 })
    }


    // Verify the student is a member of the project's group
    const memberCheck = await sql`
      SELECT gm.id
      FROM projects p
      JOIN group_members gm ON p.group_id = gm.group_id
      WHERE p.id = ${projectIdNum} AND gm.student_id = ${studentId}
    `

    if (memberCheck.length === 0) {
      return NextResponse.json({ error: "You must be a member of the project's group to add reports" }, { status: 403 })
    }

    const result = await sql`
      INSERT INTO project_reports (
        project_id,
        student_id,
        progress,
        challenges,
        deliverables_status
      )
      VALUES (
        ${projectIdNum},
        ${studentId},
        ${progress},
        ${challenges || null},
        ${deliverablesStatus || null}
      )
      RETURNING id, project_id, student_id, progress, challenges, deliverables_status, created_at, updated_at
    `

    return NextResponse.json({ report: result[0] })
  } catch (error) {
    console.error("[v0] Failed to create project report:", error)
    return NextResponse.json({ error: "Failed to create project report" }, { status: 500 })
  }
}
