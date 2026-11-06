import { NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { sql } from "@/lib/db"
import {
  loadTemplateSections,
  replaceTemplateSections,
} from "@/lib/projects/project-workspace-service"
import type { ProjectTemplateSection } from "@/lib/projects/project-template-types"
import { ensureProjectWorkspaceSchema } from "@/lib/ensure-project-workspace-schema"

export const dynamic = "force-dynamic"

async function assertAssignment(id: number, courseId: number) {
  const rows = await sql`
    SELECT id FROM course_project_assignments WHERE id = ${id} AND course_id = ${courseId} LIMIT 1
  `
  return rows.length > 0
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureProjectWorkspaceSchema()
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response
    const assignmentId = Number.parseInt((await params).id, 10)
    if (!(await assertAssignment(assignmentId, scope.course.id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const sections = await loadTemplateSections(assignmentId)
    const modeRows = await sql`
      SELECT submission_mode, submission_workflow FROM course_project_assignments WHERE id = ${assignmentId} LIMIT 1
    `
    return NextResponse.json({
      sections,
      submission_mode: modeRows[0]?.submission_mode ?? "FREEFORM_SUBMISSION",
      submission_workflow: modeRows[0]?.submission_workflow ?? {},
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to load template" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureProjectWorkspaceSchema()
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response
    const assignmentId = Number.parseInt((await params).id, 10)
    if (!(await assertAssignment(assignmentId, scope.course.id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = await request.json()
    const sections = (body.sections ?? []) as ProjectTemplateSection[]
    await replaceTemplateSections(assignmentId, sections)

    await sql`
      UPDATE course_project_assignments
      SET submission_mode = ${body.submission_mode === "STRUCTURED_REPORT" ? "STRUCTURED_REPORT" : "FREEFORM_SUBMISSION"},
          submission_workflow = COALESCE(${JSON.stringify(body.submission_workflow ?? {})}::jsonb, submission_workflow),
          updated_at = NOW()
      WHERE id = ${assignmentId}
    `

    return NextResponse.json({ sections: await loadTemplateSections(assignmentId) })
  } catch (error) {
    console.error("[template-sections PUT]", error)
    return NextResponse.json({ error: "Failed to save template" }, { status: 500 })
  }
}
