import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireWorkspaceForProject } from "@/lib/projects/project-workspace-auth"
import { loadWorkspaceBundle } from "@/lib/projects/project-workspace-service"
import { ensureProjectPhase3Schema } from "@/lib/ensure-project-phase3-schema"
import { loadGradingConfigForProjectOrLegacy } from "@/lib/projects/load-project-grading-config"
import { readGradingMethodFlags } from "@/lib/projects/project-grading-methods"
import { applyPreviewCover, assembleReportPreview, buildPreviewPdf, renderPreviewHtml, type ReportPreviewDocument } from "@/lib/projects/project-report-preview"
import type { ProjectSectionRevisionContent } from "@/lib/projects/project-template-types"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const projectId = Number.parseInt((await params).projectId, 10)
    const access = await requireWorkspaceForProject(request, projectId)
    if (!access.ok) return access.response

    const bundle = await loadWorkspaceBundle(projectId)
    if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const workspaceId = Number(bundle.workspace.id)

    const refs = await sql`
      SELECT title, authors, year, url FROM project_workspace_references
      WHERE workspace_id = ${workspaceId}
    `

    const previewSections = bundle.sections.map((s: Record<string, unknown>) => {
      const rev = s.current_revision as { content?: ProjectSectionRevisionContent } | null
      return {
        title: String(s.title),
        instructions: s.instructions != null ? String(s.instructions) : null,
        status: String(s.status),
        config: (s.config as Record<string, unknown>) ?? {},
        revision: rev?.content ?? { blocks: [] },
      }
    })

    const doc = assembleReportPreview(String(bundle.project.title), previewSections, refs as never[])
    const view = request.nextUrl.searchParams.get("view")
    doc.submissionCopy = view === "submission" || view === "graded"
    if (view === "graded") await attachReleasedGrade(projectId, doc)
    const workspace = bundle.workspace as { submitted_at?: string | null }
    const submittedAt = workspace.submitted_at
      ? new Date(String(workspace.submitted_at)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : null
    applyPreviewCover(doc, {
      members: (bundle.members as Array<{ full_name?: string }>).map((row) => String(row.full_name || "")).filter(Boolean),
      completedOn: submittedAt,
    })
    const format = request.nextUrl.searchParams.get("format")
    if (format === "pdf") {
      const bytes = await buildPreviewPdf(doc)
      const filename = `${String(bundle.project.title).replace(/[^\w.-]+/g, "-").slice(0, 80) || "project-report"}.pdf`
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    }
    if (format === "html") {
      return new NextResponse(renderPreviewHtml(doc), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    }

    return NextResponse.json({ preview: doc })
  } catch (error) {
    console.error("[workspace preview]", error)
    return NextResponse.json({ error: "Failed to build preview" }, { status: 500 })
  }
}

type GradeRow = { title: string | null; score: number; max_score: number; feedback: string | null; workspace_section_id: number | null }

async function attachReleasedGrade(projectId: number, doc: ReportPreviewDocument) {
  await ensureProjectPhase3Schema()
  const { assignment } = await loadGradingConfigForProjectOrLegacy(projectId)
  const release = assignment?.feedback_release
  const flags = assignment ? readGradingMethodFlags(assignment) : null
  const showScore = release?.show_final_grade !== false
  const showSections = release?.show_section_scores !== false
  const showFeedback = release?.show_instructor_feedback !== false
  const showAi = release?.show_ai_grading_feedback !== false && Boolean(flags?.aiGrading)

  let rows = (await sql`
    SELECT s.title, g.score, g.max_score, g.feedback, g.workspace_section_id
    FROM project_instructor_grade_entries g
    LEFT JOIN project_workspace_sections s ON s.id = g.workspace_section_id
    WHERE g.project_id = ${projectId}
  `) as GradeRow[]

  if (rows.length === 0 && showAi) {
    rows = (await sql`
      SELECT DISTINCT ON (r.workspace_section_id)
        s.title, r.suggested_score AS score, r.max_score, r.feedback, r.workspace_section_id
      FROM project_ai_grading_results r
      LEFT JOIN project_workspace_sections s ON s.id = r.workspace_section_id
      JOIN project_ai_grading_runs run ON run.id = r.run_id
      WHERE r.project_id = ${projectId} AND run.run_kind = 'AI_GRADE'
      ORDER BY r.workspace_section_id, r.created_at DESC
    `) as GradeRow[]
  }

  const sectionRows = rows.filter((row) => row.workspace_section_id != null && row.title)
  const overall = rows.find((row) => row.workspace_section_id == null)
  const source = sectionRows.length ? sectionRows : overall ? [overall] : []
  if (source.length === 0) {
    doc.grade = { earned: 0, possible: 0, pending: true, note: null }
    return
  }

  let earned = 0
  let possible = 0
  const byTitle = new Map<string, GradeRow>()
  for (const row of sectionRows) {
    earned += Number(row.score) || 0
    possible += Number(row.max_score) || 0
    if (row.title) byTitle.set(row.title, row)
  }
  if (!sectionRows.length && overall) {
    earned = Number(overall.score) || 0
    possible = Number(overall.max_score) || 0
  }

  doc.grade = showScore
    ? {
        earned,
        possible,
        pending: false,
        note: !sectionRows.length && overall?.feedback && showFeedback ? String(overall.feedback) : null,
      }
    : null

  if (!showSections && !showFeedback) return
  for (const section of doc.sections) {
    const row = byTitle.get(section.title)
    if (!row) continue
    section.awarded = {
      score: showSections ? Number(row.score) || 0 : null,
      max: showSections ? Number(row.max_score) || 0 : null,
      feedback: showFeedback && row.feedback ? String(row.feedback) : null,
    }
  }
}
