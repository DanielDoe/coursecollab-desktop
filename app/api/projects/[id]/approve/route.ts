import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorProjectAccess } from "@/lib/project-request-auth"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const projectId = Number.parseInt(id)

    if (Number.isNaN(projectId)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 })
    }

    const access = await requireInstructorProjectAccess(request, projectId)
    if (!access.ok) return access.response

    // Check if project exists and get its current state
    const projectCheck = await sql`
      SELECT id, title, status, pending_changes FROM projects WHERE id = ${projectId}
    `

    if (projectCheck.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const project = projectCheck[0]

    // If there are pending changes, apply them
    if (project.pending_changes) {
      const changes = project.pending_changes as any

      const updateFields = []
      const updateValues: any[] = []
      let paramIndex = 1

      if (changes.title) {
        updateFields.push(`title = $${paramIndex++}`)
        updateValues.push(changes.title)
      }
      if (changes.summary) {
        updateFields.push(`summary = $${paramIndex++}`)
        updateValues.push(changes.summary)
      }
      if (changes.deliverables) {
        updateFields.push(`deliverables = $${paramIndex++}`)
        updateValues.push(changes.deliverables)
      }
      if (changes.target_platform) {
        updateFields.push(`target_platform = $${paramIndex++}`)
        updateValues.push(changes.target_platform)
      }
      if (changes.timeline) {
        updateFields.push(`timeline = $${paramIndex++}`)
        updateValues.push(JSON.stringify(changes.timeline))
      }

      if (updateFields.length > 0) {
        // Apply changes and approve in one query
        updateFields.push(`status = 'approved'`)
        updateFields.push(`pending_changes = NULL`)
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`)
        updateValues.push(projectId)
        
        const query = `
          UPDATE projects 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramIndex}
        `
        await sql.unsafe(query, updateValues)
      } else {
        // No pending changes, just approve
        await sql`
          UPDATE projects 
          SET 
            status = 'approved',
            pending_changes = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${projectId}
        `
      }
    } else {
      // No pending changes, just approve
      await sql`
        UPDATE projects 
        SET 
          status = 'approved',
          pending_changes = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${projectId}
      `
    }

    return NextResponse.json({
      success: true,
      message: "Project approved successfully",
    })
  } catch (error) {
    console.error("[v0] Failed to approve project:", error)
    console.error("[v0] Error details:", error instanceof Error ? error.message : String(error))
    return NextResponse.json({ 
      error: "Failed to approve project",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
