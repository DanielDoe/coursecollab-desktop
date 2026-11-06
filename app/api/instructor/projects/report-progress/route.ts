import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { ensureProjectPhase3Schema } from "@/lib/ensure-project-phase3-schema"
import { ensureProjectWorkspaceSchema } from "@/lib/ensure-project-workspace-schema"
import { resolveInstructorOwnedGroupsCourseScopeSqlFragment } from "@/lib/instructor-default-courses"
import { resolveGroupProjectTermScope } from "@/lib/group-project-term-scope"
import { resolveInstructorSessionCodeForScope } from "@/lib/instructor-session-scope"

export const dynamic = "force-dynamic"

function statusSymbol(status: string) {
  if (status === "COMPLETE") return "complete"
  if (status === "IN_PROGRESS") return "in_progress"
  if (status === "NEEDS_ATTENTION") return "attention"
  return "not_started"
}

export async function GET(request: NextRequest) {
  try {
    await ensureProjectWorkspaceSchema()
    await ensureProjectPhase3Schema()
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const assignmentId = Number(request.nextUrl.searchParams.get("assignmentId"))
    if (!Number.isFinite(assignmentId)) {
      return NextResponse.json({ error: "assignmentId required" }, { status: 400 })
    }

    const selectedSessionCode = await resolveInstructorSessionCodeForScope(request)
    const gScope = await resolveInstructorOwnedGroupsCourseScopeSqlFragment(
      "g",
      scope.course.id,
      scope.instructorId,
      scope.course.course_code,
      "g.session",
      selectedSessionCode,
    )
    const gTerm = await resolveGroupProjectTermScope(request, scope.course.id, selectedSessionCode)

    const templateSections = await sql`
      SELECT section_key, title, sort_order, config
      FROM project_template_sections
      WHERE assignment_id = ${assignmentId}
      ORDER BY sort_order ASC
    `

    const assignmentRows = await sql`
      SELECT title, project_mode, submission_mode, due_at, max_points, grading_components, presentation
      FROM course_project_assignments
      WHERE id = ${assignmentId}
      LIMIT 1
    `
    const assignment = assignmentRows[0] as {
      title?: string
      project_mode?: string
      submission_mode?: string
      due_at?: string | null
      max_points?: number
      grading_components?: Array<{ key?: string; label?: string; weight_percent?: number; enabled?: boolean }> | string
      presentation?: { required?: boolean } | string
    } | undefined

    const groups = await sql`
      SELECT p.id AS project_id, g.name AS group_name, g.session,
        w.id AS workspace_id, w.submission_status, w.submitted_at, w.updated_at AS workspace_updated_at,
        COALESCE(ps.instructor_points, 0) AS instructor_points
      FROM projects p
      JOIN groups g ON g.id = p.group_id
      LEFT JOIN project_workspaces w ON w.project_id = p.id
      LEFT JOIN project_scores ps ON ps.project_id = p.id
      WHERE p.assignment_id = ${assignmentId}
        AND p.status = 'approved'
        AND (${gScope})
        AND (${gTerm})
      ORDER BY g.name
    `

    const matrix = []
    for (const g of groups) {
      const workspaceId = g.workspace_id as number | null
      let sectionStatuses: Record<string, string> = {}
      const sectionUpdated: Record<string, string | null> = {}
      if (workspaceId) {
        const secs = await sql`
          SELECT section_key, status, updated_at FROM project_workspace_sections
          WHERE workspace_id = ${workspaceId}
        `
        for (const s of secs) {
          sectionStatuses[String(s.section_key)] = statusSymbol(String(s.status))
          sectionUpdated[String(s.section_key)] = s.updated_at ? new Date(s.updated_at as string).toISOString() : null
        }
      }
      matrix.push({
        projectId: g.project_id,
        groupName: g.group_name,
        session: g.session,
        submissionStatus: g.submission_status ?? null,
        submittedAt: g.submitted_at ? new Date(g.submitted_at as string).toISOString() : null,
        updatedAt: g.workspace_updated_at ? new Date(g.workspace_updated_at as string).toISOString() : null,
        instructorPoints: Number(g.instructor_points) || 0,
        sections: templateSections.map((t) => ({
          section_key: t.section_key,
          title: t.title,
          points: Number((t.config as { points?: number } | null)?.points) || null,
          state: sectionStatuses[String(t.section_key)] ?? "not_started",
          updatedAt: sectionUpdated[String(t.section_key)] ?? null,
        })),
      })
    }

    const parsedComponents = (() => {
      const raw = assignment?.grading_components
      if (Array.isArray(raw)) return raw
      if (typeof raw === "string") {
        try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
      }
      return []
    })()
    const presentation = (() => {
      const raw = assignment?.presentation
      if (raw && typeof raw === "object") return raw
      if (typeof raw === "string") {
        try { return JSON.parse(raw) as { required?: boolean } } catch { return null }
      }
      return null
    })()
    const sources = parsedComponents
      .filter((c) => c?.enabled)
      .map((c) => ({
        key: String(c.key ?? "other"),
        label: String(c.label ?? c.key ?? "Score"),
        weight: Number(c.weight_percent) || 0,
      }))

    let activity: Array<{ at: string; actor: string; action: string; group: string; projectId: number }> = []
    try {
      const edits = await sql`
        SELECT ws.updated_at, ws.title AS section_title, g.name AS group_name, p.id AS project_id,
          st.full_name AS student_name
        FROM project_workspace_sections ws
        JOIN project_workspaces w ON w.id = ws.workspace_id
        JOIN projects p ON p.id = w.project_id
        JOIN groups g ON g.id = p.group_id
        LEFT JOIN project_section_revisions r ON r.id = ws.current_revision_id
        LEFT JOIN students st ON st.id = r.created_by_student_id
        WHERE p.assignment_id = ${assignmentId}
          AND ws.status <> 'NOT_STARTED'
          AND (${gScope})
        ORDER BY ws.updated_at DESC
        LIMIT 8
      `
      const audits = await sql`
        SELECT a.created_at, a.event_type, g.name AS group_name, p.id AS project_id,
          i.name AS instructor_name, st.full_name AS student_name
        FROM project_grading_audit_log a
        JOIN projects p ON p.id = a.project_id
        JOIN groups g ON g.id = p.group_id
        LEFT JOIN instructors i ON i.id = a.actor_instructor_id
        LEFT JOIN students st ON st.id = a.actor_student_id
        WHERE p.assignment_id = ${assignmentId}
          AND (${gScope})
        ORDER BY a.created_at DESC
        LIMIT 8
      `
      activity = [
        ...edits.map((row) => ({
          at: new Date(row.updated_at as string).toISOString(),
          actor: String(row.student_name || "A student"),
          action: `updated ${String(row.section_title || "a section")}`,
          group: String(row.group_name || "Group"),
          projectId: Number(row.project_id),
        })),
        ...audits.map((row) => ({
          at: new Date(row.created_at as string).toISOString(),
          actor: String(row.instructor_name || row.student_name || "Instructor"),
          action: String(row.event_type || "updated the grade").replaceAll("_", " ").toLowerCase(),
          group: String(row.group_name || "Group"),
          projectId: Number(row.project_id),
        })),
      ]
        .sort((a, b) => +new Date(b.at) - +new Date(a.at))
        .slice(0, 8)
    } catch (activityError) {
      console.error("[report-progress] activity", activityError)
    }

    return NextResponse.json({
      templateSections,
      matrix,
      operations: {
        assignment: assignment
          ? {
              id: assignmentId,
              title: assignment.title ?? "Project",
              projectMode: assignment.project_mode ?? "group",
              submissionMode: assignment.submission_mode ?? "FREEFORM_SUBMISSION",
              dueAt: assignment.due_at ? new Date(assignment.due_at).toISOString() : null,
              maxPoints: Number(assignment.max_points) || 0,
              sources,
              presentationRequired: Boolean(presentation?.required),
            }
          : null,
        activity,
      },
    })
  } catch (error) {
    console.error("[report-progress]", error)
    return NextResponse.json({ error: "Failed to load progress" }, { status: 500 })
  }
}
