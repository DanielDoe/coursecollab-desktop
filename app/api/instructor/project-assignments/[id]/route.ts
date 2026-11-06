import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { ensureProjectAssignmentsSchema } from "@/lib/ensure-project-assignments-schema"
import { ensureProjectPhase3Schema } from "@/lib/ensure-project-phase3-schema"
import { parseCourseProjectAssignment } from "@/lib/projects/project-grading-config"
import { buildAssignmentUpdateFromBody } from "@/lib/projects/project-assignment-payload"

export const dynamic = "force-dynamic"

async function loadOwnedAssignment(id: number, courseId: number) {
  const rows = await sql`
    SELECT * FROM course_project_assignments
    WHERE id = ${id} AND course_id = ${courseId}
    LIMIT 1
  `
  return rows[0] as Record<string, unknown> | undefined
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureProjectAssignmentsSchema()
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const { id } = await params
    const assignmentId = Number.parseInt(id, 10)
    if (!Number.isFinite(assignmentId)) {
      return NextResponse.json({ error: "Invalid assignment id" }, { status: 400 })
    }

    const row = await loadOwnedAssignment(assignmentId, scope.course.id)
    if (!row) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
    }

    return NextResponse.json({
      assignment: parseCourseProjectAssignment(row),
    })
  } catch (error) {
    console.error("[project-assignments GET id]", error)
    return NextResponse.json({ error: "Failed to load assignment" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureProjectAssignmentsSchema()
    await ensureProjectPhase3Schema()
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const { id } = await params
    const assignmentId = Number.parseInt(id, 10)
    if (!Number.isFinite(assignmentId)) {
      return NextResponse.json({ error: "Invalid assignment id" }, { status: 400 })
    }

    const existing = await loadOwnedAssignment(assignmentId, scope.course.id)
    if (!existing) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
    }

    const body = (await request.json()) as Record<string, unknown>
    const built = buildAssignmentUpdateFromBody(body, scope.course.id, scope.instructorId)
    if ("error" in built) {
      return NextResponse.json({ error: built.error }, { status: 400 })
    }

    const r = built.row
    const updated = await sql`
      UPDATE course_project_assignments SET
        session = ${r.session},
        title = ${r.title},
        description = ${r.description},
        instructions = ${r.instructions},
        project_mode = ${r.project_mode},
        status = ${r.status},
        available_from = ${r.available_from},
        available_until = ${r.available_until},
        due_at = ${r.due_at},
        late_policy = ${JSON.stringify(r.late_policy)}::jsonb,
        min_group_size = ${r.min_group_size},
        max_group_size = ${r.max_group_size},
        counts_toward_course_grade = ${r.counts_toward_course_grade},
        max_points = ${r.max_points},
        required_deliverables = ${JSON.stringify(r.required_deliverables)}::jsonb,
        resources = ${JSON.stringify(r.resources)}::jsonb,
        resubmissions = ${JSON.stringify(r.resubmissions)}::jsonb,
        grading_mode = ${r.grading_mode},
        grading_components = ${JSON.stringify(r.grading_components)}::jsonb,
        rubric = ${JSON.stringify(r.rubric)}::jsonb,
        peer_voting = ${JSON.stringify(r.peer_voting)}::jsonb,
        submission = ${JSON.stringify(r.submission)}::jsonb,
        presentation = ${JSON.stringify(r.presentation)}::jsonb,
        integrity_settings = ${JSON.stringify(r.integrity_settings)}::jsonb,
        ai_grading_settings = ${JSON.stringify(r.ai_grading_settings)}::jsonb,
        feedback_release = ${JSON.stringify(r.feedback_release)}::jsonb,
        updated_at = NOW()
      WHERE id = ${assignmentId} AND course_id = ${scope.course.id}
      RETURNING *
    `

    return NextResponse.json({
      assignment: parseCourseProjectAssignment(updated[0] as Record<string, unknown>),
    })
  } catch (error) {
    console.error("[project-assignments PUT]", error)
    return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureProjectAssignmentsSchema()
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const { id } = await params
    const assignmentId = Number.parseInt(id, 10)
    if (!Number.isFinite(assignmentId)) {
      return NextResponse.json({ error: "Invalid assignment id" }, { status: 400 })
    }

    await sql`
      UPDATE projects SET assignment_id = NULL
      WHERE assignment_id = ${assignmentId}
    `
    await sql`
      DELETE FROM course_project_assignments
      WHERE id = ${assignmentId} AND course_id = ${scope.course.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[project-assignments DELETE]", error)
    return NextResponse.json({ error: "Failed to delete assignment" }, { status: 500 })
  }
}
