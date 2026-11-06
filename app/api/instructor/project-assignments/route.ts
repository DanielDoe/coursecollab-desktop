import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { ensureProjectAssignmentsSchema } from "@/lib/ensure-project-assignments-schema"
import { ensureProjectPhase3Schema } from "@/lib/ensure-project-phase3-schema"
import { parseCourseProjectAssignment } from "@/lib/projects/project-grading-config"
import { buildAssignmentUpdateFromBody } from "@/lib/projects/project-assignment-payload"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    await ensureProjectAssignmentsSchema()
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const session = request.nextUrl.searchParams.get("session")?.trim()
    const rows =
      session && session !== "all"
        ? await sql`
            SELECT * FROM course_project_assignments
            WHERE course_id = ${scope.course.id}
              AND (session IS NULL OR session = ${session})
            ORDER BY updated_at DESC
          `
        : await sql`
            SELECT * FROM course_project_assignments
            WHERE course_id = ${scope.course.id}
            ORDER BY updated_at DESC
          `

    return NextResponse.json({
      assignments: rows.map((r) => parseCourseProjectAssignment(r as Record<string, unknown>)),
    })
  } catch (error) {
    console.error("[project-assignments GET]", error)
    return NextResponse.json({ error: "Failed to load project assignments" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureProjectAssignmentsSchema()
    await ensureProjectPhase3Schema()
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const body = (await request.json()) as Record<string, unknown>
    const built = buildAssignmentUpdateFromBody(body, scope.course.id, scope.instructorId)
    if ("error" in built) {
      return NextResponse.json({ error: built.error }, { status: 400 })
    }

    const r = built.row
    const inserted = await sql`
      INSERT INTO course_project_assignments (
        course_id, session, title, description, instructions,
        project_mode, status, available_from, available_until, due_at,
        late_policy, min_group_size, max_group_size, counts_toward_course_grade,
        max_points, required_deliverables, resources, resubmissions,
        grading_mode, grading_components, rubric, peer_voting, submission, presentation,
        integrity_settings, ai_grading_settings, feedback_release,
        created_by_instructor_id
      )
      VALUES (
        ${r.course_id}, ${r.session}, ${r.title}, ${r.description}, ${r.instructions},
        ${r.project_mode}, ${r.status}, ${r.available_from}, ${r.available_until}, ${r.due_at},
        ${JSON.stringify(r.late_policy)}::jsonb,
        ${r.min_group_size}, ${r.max_group_size}, ${r.counts_toward_course_grade},
        ${r.max_points},
        ${JSON.stringify(r.required_deliverables)}::jsonb,
        ${JSON.stringify(r.resources)}::jsonb,
        ${JSON.stringify(r.resubmissions)}::jsonb,
        ${r.grading_mode},
        ${JSON.stringify(r.grading_components)}::jsonb,
        ${JSON.stringify(r.rubric)}::jsonb,
        ${JSON.stringify(r.peer_voting)}::jsonb,
        ${JSON.stringify(r.submission)}::jsonb,
        ${JSON.stringify(r.presentation)}::jsonb,
        ${JSON.stringify(r.integrity_settings)}::jsonb,
        ${JSON.stringify(r.ai_grading_settings)}::jsonb,
        ${JSON.stringify(r.feedback_release)}::jsonb,
        ${r.created_by_instructor_id}
      )
      RETURNING *
    `

    return NextResponse.json({
      assignment: parseCourseProjectAssignment(inserted[0] as Record<string, unknown>),
    })
  } catch (error) {
    console.error("[project-assignments POST]", error)
    return NextResponse.json({ error: "Failed to create project assignment" }, { status: 500 })
  }
}
