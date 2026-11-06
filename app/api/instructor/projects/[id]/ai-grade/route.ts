import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorProjectAccess } from "@/lib/project-request-auth"
import { ensureProjectPhase3Schema } from "@/lib/ensure-project-phase3-schema"
import { ensureProjectWorkspaceSchema } from "@/lib/ensure-project-workspace-schema"
import { loadGradingConfigForProjectOrLegacy } from "@/lib/projects/load-project-grading-config"
import { readGradingMethodFlags } from "@/lib/projects/project-grading-methods"
import { runProjectSectionAiGrade, composeStudentProjectFeedback } from "@/lib/projects/project-ai-grader"
import { logProjectGradingAudit } from "@/lib/projects/project-grading-audit"
import { upsertProjectComponentScore, syncProjectTotalFromComponents } from "@/lib/projects/project-sync-component-scores"
import { resolveModelForFeature } from "@/lib/resolve-feature-ai-model"

import type { ProjectResponseField, SectionContentBlock } from "@/lib/projects/project-template-types"
import type { ProjectRubric } from "@/lib/projects/project-grading-types"

export const dynamic = "force-dynamic"

function plainText(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function blockAnswer(block: SectionContentBlock): string {
  switch (block.type) {
    case "text":
      return plainText(block.html) || "(blank)"
    case "code":
      return block.code?.trim() ? `Code (${block.language || "text"}):\n${block.code.trim()}` : "(blank)"
    case "image":
    case "figure":
      return [block.caption, block.alt, block.url].filter(Boolean).join(" — ") || "(image with no caption)"
    case "table": {
      const header = block.headers?.join(" | ") || ""
      const rows = (block.rows ?? []).map((row) => row.join(" | ")).join("\n")
      return [header, rows].filter(Boolean).join("\n") || "(empty table)"
    }
    case "equation":
      return block.latex?.trim() || "(blank equation)"
    case "file":
      return block.label?.trim() || `File #${block.file_id}`
    case "link":
      return [block.label, block.url].filter(Boolean).join(" — ") || "(blank link)"
    case "diagram":
      return [block.description, block.url].filter(Boolean).join(" — ") || "(diagram with no description)"
    default:
      return "(unsupported answer)"
  }
}

function formatSectionPacket(row: Record<string, unknown>, target: boolean): string {
  const config = (row.config ?? {}) as {
    points?: number
    expected_content?: string
    response_fields?: ProjectResponseField[]
  }
  const fields = config.response_fields ?? []
  const blocks =
    ((row.content as { blocks?: SectionContentBlock[] } | null)?.blocks ?? []) as SectionContentBlock[]
  const lines = [
    `## ${String(row.title || "Section")}${target ? " [GRADE THIS SECTION]" : ""}`,
    `Template points: ${Number(config.points) || 0}`,
    `Template instructions: ${row.instructions ? String(row.instructions) : "(none)"}`,
    `What a strong answer includes: ${config.expected_content || "(not specified)"}`,
  ]
  if (fields.length === 0) {
    lines.push(blocks.length ? blocks.map(blockAnswer).join("\n\n") : "Student answer: (not answered)")
    return lines.join("\n")
  }
  lines.push("Template fields and student answers:")
  const used = new Set<string>()
  for (const field of fields) {
    used.add(field.id)
    const block = blocks.find((item) => item.id === field.id)
    const meta = `${field.kind}${field.required ? ", required" : ", optional"}${field.help ? `. ${field.help}` : ""}`
    lines.push(`- ${field.label} (${meta})`)
    lines.push(block ? blockAnswer(block) : "(not answered)")
  }
  for (const block of blocks) {
    if (used.has(block.id)) continue
    if (block.type === "text" && !plainText(block.html)) continue
    lines.push(`- Additional ${block.type}`)
    lines.push(blockAnswer(block))
  }
  return lines.join("\n")
}

function blockIsFilled(block: SectionContentBlock | undefined) {
  if (!block) return false
  const answer = blockAnswer(block)
  return Boolean(answer) && !answer.startsWith("(blank)") && !answer.startsWith("(empty") && !answer.startsWith("(image with no") && !answer.startsWith("(diagram with no")
}

function capScoreForMissingFields(grade: Awaited<ReturnType<typeof runProjectSectionAiGrade>>, row: Record<string, unknown> | null) {
  if (!row) return grade
  const fields = ((row.config as { response_fields?: ProjectResponseField[] } | null)?.response_fields ?? []).filter(
    (field) => field.required,
  )
  if (fields.length === 0) return grade
  const blocks = ((row.content as { blocks?: SectionContentBlock[] } | null)?.blocks ?? []) as SectionContentBlock[]
  const answered = fields.filter((field) => blockIsFilled(blocks.find((block) => block.id === field.id))).length
  const cap = Math.round(((grade.max_score * answered) / fields.length) * 10) / 10
  if (grade.suggested_score <= cap) return grade
  const prose = String(grade.raw_model_output.feedback || "")
    .split(/(?<=[.!?])\s+/)
    .slice(0, 3)
    .join(" ")
    .trim()
  const next = {
    ...grade,
    suggested_score: cap,
    requires_human_review: true,
    feedback: prose || "Required fields are still blank, so the score is limited to the answered portion.",
  }
  next.feedback = composeStudentProjectFeedback(next)
  return next
}

function rubricForSection(rubric: ProjectRubric, row: Record<string, unknown>): ProjectRubric {
  const config = (row.config ?? {}) as { rubric_criterion_ids?: string[] }
  const ids = config.rubric_criterion_ids ?? []
  const title = String(row.title || "").toLowerCase()
  const byId = ids.length ? rubric.criteria.filter((item) => ids.includes(item.id)) : []
  const byTitle = rubric.criteria.filter((item) => item.title && title.includes(item.title.toLowerCase()))
  const criteria = byId.length ? byId : byTitle.length ? byTitle : rubric.criteria
  return { ...rubric, criteria }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureProjectPhase3Schema()
    await ensureProjectWorkspaceSchema()
    const projectId = Number.parseInt((await params).id, 10)
    const access = await requireInstructorProjectAccess(request, projectId)
    if (!access.ok) return access.response

    const body = await request.json()
    const workspaceSectionId = body.workspaceSectionId != null ? Number(body.workspaceSectionId) : null
    const runKind = body.runKind === "AI_ASSIST" ? "AI_ASSIST" : "AI_GRADE"

    const { assignment } = await loadGradingConfigForProjectOrLegacy(projectId)
    if (!assignment) {
      return NextResponse.json({ error: "Project has no assignment config" }, { status: 400 })
    }
    const flags = readGradingMethodFlags(assignment)
    if (runKind === "AI_GRADE" && !flags.aiGrading) {
      return NextResponse.json({ error: "AI Grading is not enabled for this project setup" }, { status: 403 })
    }
    if (runKind === "AI_ASSIST" && !flags.instructorGrading) {
      return NextResponse.json({ error: "Instructor grading is not enabled" }, { status: 403 })
    }
    if (runKind === "AI_ASSIST" && !flags.instructorAiAssist && !body.forceAssist) {
      return NextResponse.json({ error: "AI grading assistant is not enabled" }, { status: 403 })
    }

    let sectionRow: Record<string, unknown> | null = null
    const sectionRows = await sql`
      SELECT ws.id, ws.title, ws.instructions, ws.config, ws.sort_order, rev.content
      FROM project_workspace_sections ws
      LEFT JOIN project_section_revisions rev ON rev.id = ws.current_revision_id
      WHERE ws.workspace_id IN (SELECT id FROM project_workspaces WHERE project_id = ${projectId})
      ORDER BY ws.sort_order ASC, ws.id ASC
    `
    const sections = sectionRows as Record<string, unknown>[]
    if (workspaceSectionId) {
      sectionRow = sections.find((row) => Number(row.id) === workspaceSectionId) ?? null
      if (!sectionRow) {
        return NextResponse.json({ error: "Section not found" }, { status: 404 })
      }
    }

    const config = (sectionRow?.config ?? {}) as { points?: number }
    const maxScore = Math.max(0.01, Number(config.points) || Number(assignment.max_points) || 1)
    const targetPacket = sectionRow
      ? formatSectionPacket(sectionRow, true)
      : sections.map((row) => formatSectionPacket(row, false)).join("\n\n")
    const reportContext = sections.map((row) => formatSectionPacket(row, Number(row.id) === workspaceSectionId)).join("\n\n")
    const files = await sql`
      SELECT workspace_section_id, file_name, storage_url FROM project_workspace_files
      WHERE workspace_id IN (SELECT id FROM project_workspaces WHERE project_id = ${projectId})
    `
    const evidenceSummary = files
      .map((file) => {
        const row = file as { workspace_section_id?: number; file_name?: string; storage_url?: string }
        const section = sections.find((item) => Number(item.id) === Number(row.workspace_section_id))
        return `${section ? String(section.title) : "Project"}: ${row.file_name || "file"} ${row.storage_url || ""}`.trim()
      })
      .join("\n")
    const assignmentBrief = [
      `Assignment: ${assignment.title}`,
      assignment.instructions ? `Template instructions: ${assignment.instructions}` : "",
      assignment.description ? `Description: ${assignment.description}` : "",
      assignment.submission?.template_instructions
        ? `Submission template: ${assignment.submission.template_instructions}`
        : "",
      assignment.required_deliverables?.length
        ? `Required deliverables: ${assignment.required_deliverables.join("; ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n")

    const settings = assignment.ai_grading_settings
    const grade = capScoreForMissingFields(
      await runProjectSectionAiGrade({
      sectionTitle: String(sectionRow?.title ?? assignment.title ?? "Project"),
      instructions: sectionRow?.instructions != null ? String(sectionRow.instructions) : assignment.instructions,
      maxScore,
      rubric: sectionRow ? rubricForSection(assignment.rubric, sectionRow) : assignment.rubric,
      studentContent: targetPacket,
      reportContext,
      assignmentBrief,
      evidenceSummary,
      settings,
    }),
      sectionRow,
    )

    const modelId = resolveModelForFeature(settings.model_feature || "project_ai_grade")
    const runInsert = await sql`
      INSERT INTO project_ai_grading_runs (
        project_id, workspace_section_id, run_kind, scope, model_id, created_by_instructor_id
      )
      VALUES (
        ${projectId},
        ${workspaceSectionId},
        ${runKind},
        ${workspaceSectionId ? "section" : "whole_project"},
        ${modelId},
        ${access.instructorId ?? null}
      )
      RETURNING id
    `
    const runId = Number((runInsert[0] as { id: number }).id)

    const resultInsert = await sql`
      INSERT INTO project_ai_grading_results (
        run_id, project_id, workspace_section_id,
        suggested_score, max_score, rubric_results, strengths, areas_for_improvement,
        missing_requirements, missing_evidence, feedback, confidence, requires_human_review,
        raw_model_output
      )
      VALUES (
        ${runId},
        ${projectId},
        ${workspaceSectionId},
        ${grade.suggested_score},
        ${grade.max_score},
        ${JSON.stringify(grade.rubric_results)}::jsonb,
        ${JSON.stringify(grade.strengths)}::jsonb,
        ${JSON.stringify(grade.areas_for_improvement)}::jsonb,
        ${JSON.stringify(grade.missing_requirements)}::jsonb,
        ${JSON.stringify(grade.missing_evidence)}::jsonb,
        ${grade.feedback},
        ${grade.confidence},
        ${grade.requires_human_review},
        ${JSON.stringify(grade.raw_model_output)}::jsonb
      )
      RETURNING *
    `

    if (runKind === "AI_GRADE") {
      const allSection = await sql`
        SELECT suggested_score, max_score FROM project_ai_grading_results
        WHERE project_id = ${projectId} AND run_id IN (
          SELECT id FROM project_ai_grading_runs WHERE project_id = ${projectId} AND run_kind = 'AI_GRADE'
        )
      `
      let earned = 0
      let possible = 0
      for (const row of allSection) {
        earned += Number((row as { suggested_score: number }).suggested_score) || 0
        possible += Number((row as { max_score: number }).max_score) || 0
      }
      const aiComponent = assignment.grading_components.find((c) => c.key === "ai" && c.enabled)
      const cap =
        aiComponent?.points_cap != null
          ? Number(aiComponent.points_cap)
          : (assignment.max_points * (Number(aiComponent?.weight_percent) || 0)) / 100
      const aiPoints = possible > 0 ? (earned / possible) * cap : 0
      await upsertProjectComponentScore(projectId, "ai", aiPoints, cap, {
        section_aggregate: true,
        raw_percent: possible > 0 ? (earned / possible) * 100 : 0,
      })
      await syncProjectTotalFromComponents(projectId)
    }

    await logProjectGradingAudit({
      projectId,
      eventType: runKind === "AI_GRADE" ? "AI_GRADE_RUN" : "AI_ASSIST_RUN",
      actorInstructorId: access.instructorId,
      payload: { runId, workspaceSectionId, confidence: grade.confidence },
    })

    return NextResponse.json({ result: resultInsert[0], grade })
  } catch (error) {
    console.error("[ai-grade]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI grading failed" },
      { status: 500 },
    )
  }
}
