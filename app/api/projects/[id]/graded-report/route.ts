import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireProjectMemberOrInstructor } from "@/lib/project-request-auth"
import { ensureProjectPhase3Schema } from "@/lib/ensure-project-phase3-schema"
import { ensureProjectWorkspaceSchema } from "@/lib/ensure-project-workspace-schema"
import { loadGradingConfigForProjectOrLegacy } from "@/lib/projects/load-project-grading-config"
import { loadWorkspaceBundle } from "@/lib/projects/project-workspace-service"

export const dynamic = "force-dynamic"

function withoutTyping(content: unknown) {
  if (!content || typeof content !== "object") return content
  const source = content as { field_meta?: Record<string, Record<string, unknown>> }
  if (!source.field_meta) return content
  const field_meta: Record<string, Record<string, unknown>> = {}
  for (const [key, value] of Object.entries(source.field_meta)) {
    if (!value || typeof value !== "object") continue
    const { typing: _typing, ...rest } = value
    field_meta[key] = rest
  }
  return { ...source, field_meta }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureProjectPhase3Schema()
    await ensureProjectWorkspaceSchema()
    const projectId = Number.parseInt((await params).id, 10)
    const access = await requireProjectMemberOrInstructor(request, projectId)
    if (!access.ok) return access.response

    const bundle = await loadWorkspaceBundle(projectId)
    if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { assignment } = await loadGradingConfigForProjectOrLegacy(projectId)
    const release = assignment?.feedback_release
    const grades = await sql`
      SELECT workspace_section_id, score, max_score, feedback
      FROM project_instructor_grade_entries
      WHERE project_id = ${projectId}
    `
    const group = await sql`
      SELECT g.name, g.session
      FROM projects p
      JOIN groups g ON g.id = p.group_id
      WHERE p.id = ${projectId}
      LIMIT 1
    `

    const sections = (bundle.sections as Array<Record<string, unknown>>).map((section) => {
      const config = (section.config ?? {}) as { points?: number; response_fields?: unknown }
      const revision = section.current_revision as { content?: unknown; author_name?: string | null; created_by_student_id?: number | null } | null
      return {
        id: Number(section.id),
        title: String(section.title || "Section"),
        instructions: section.instructions != null ? String(section.instructions) : null,
        status: String(section.status || ""),
        config: {
          points: typeof config.points === "number" ? config.points : 0,
          response_fields: Array.isArray(config.response_fields) ? config.response_fields : [],
        },
        current_revision: revision
          ? {
              content: withoutTyping(revision.content),
              author_name: revision.author_name ?? null,
              created_by_student_id: revision.created_by_student_id ?? null,
            }
          : null,
      }
    })

    const submissionStatus = String((bundle.workspace as { submission_status?: string }).submission_status || "")
    return NextResponse.json({
      title: String(bundle.project.title),
      groupName: String((group[0] as { name?: string } | undefined)?.name || ""),
      session: String((group[0] as { session?: string } | undefined)?.session || ""),
      members: bundle.members,
      submissionStatus,
      provisional: submissionStatus !== "FINALIZED" && grades.length > 0,
      maxPoints: Number(assignment?.max_points) || 20,
      showScore: release?.show_final_grade !== false,
      showSectionScores: release?.show_section_scores !== false,
      showFeedback: release?.show_instructor_feedback !== false,
      sections,
      grades,
    })
  } catch (error) {
    console.error("[graded-report]", error)
    return NextResponse.json({ error: "Failed to load graded report" }, { status: 500 })
  }
}
