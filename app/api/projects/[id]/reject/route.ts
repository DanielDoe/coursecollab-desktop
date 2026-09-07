import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorProjectAccess } from "@/lib/project-request-auth"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const projectId = Number.parseInt(id)
    const body = await request.json().catch(() => ({} as { reason?: string }))
    const { reason } = body

    if (Number.isNaN(projectId)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 })
    }

    const access = await requireInstructorProjectAccess(request, projectId)
    if (!access.ok) return access.response

    // Check if project exists
    const projectCheck = await sql`
      SELECT id, status FROM projects WHERE id = ${projectId}
    `

    if (projectCheck.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Note: rejection_reason column doesn't exist, so we can't store the reason
    await sql`
      UPDATE projects 
      SET 
        status = 'rejected',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${projectId}
    `

    return NextResponse.json({
      success: true,
      message: "Project rejected successfully",
    })
  } catch (error) {
    console.error("[v0] Failed to reject project:", error)
    return NextResponse.json({ error: "Failed to reject project" }, { status: 500 })
  }
}
