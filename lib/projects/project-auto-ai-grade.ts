import { sql } from "@/lib/db"
import { ensureProjectPhase3Schema } from "@/lib/ensure-project-phase3-schema"
import { ensureProjectWorkspaceSchema } from "@/lib/ensure-project-workspace-schema"
import { loadGradingConfigForProjectOrLegacy } from "@/lib/projects/load-project-grading-config"
import { readGradingMethodFlags } from "@/lib/projects/project-grading-methods"
import { composeStudentProjectFeedback, runProjectSectionAiGrade } from "@/lib/projects/project-ai-grader"
import { logProjectGradingAudit } from "@/lib/projects/project-grading-audit"
import { upsertProjectComponentScore, syncProjectTotalFromComponents } from "@/lib/projects/project-sync-component-scores"
import { resolveModelForFeature } from "@/lib/resolve-feature-ai-model"
import type { ProjectResponseField, SectionContentBlock } from "@/lib/projects/project-template-types"
import type { ProjectRubric } from "@/lib/projects/project-grading-types"

function plainText(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim()
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
    case "link":
      return [block.label, block.url].filter(Boolean).join(" — ") || "(blank link)"
    case "file":
      return block.label?.trim() || `File #${block.file_id}`
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
  const blocks = ((row.content as { blocks?: SectionContentBlock[] } | null)?.blocks ?? []) as SectionContentBlock[]
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
    lines.push(`- ${field.label} (${field.kind}${field.required ? ", required" : ", optional"})`)
    lines.push(block ? blockAnswer(block) : "(not answered)")
  }
  return lines.join("\n")
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

/** Score every report section with AI and store the result as a provisional instructor grade. */
export async function applyProvisionalAiGrades(projectId: number): Promise<{ graded: number; errors: string[] }> {
  await ensureProjectPhase3Schema()
  await ensureProjectWorkspaceSchema()
  const { assignment } = await loadGradingConfigForProjectOrLegacy(projectId)
  if (!assignment) throw new Error("Project has no assignment config")
  const flags = readGradingMethodFlags(assignment)
  if (!flags.instructorAiAssist && !flags.aiGrading && !assignment.ai_grading_settings.auto_run_on_submit) {
    return { graded: 0, errors: ["AI grading is not enabled"] }
  }

  const instructorRows = await sql`
    SELECT c.instructor_id
    FROM projects p
    JOIN courses c ON c.id = p.course_id
    WHERE p.id = ${projectId}
    LIMIT 1
  `
  const instructorId = Number((instructorRows[0] as { instructor_id?: number } | undefined)?.instructor_id) || null

  const sectionRows = await sql`
    SELECT ws.id, ws.title, ws.instructions, ws.config, ws.sort_order, rev.content
    FROM project_workspace_sections ws
    LEFT JOIN project_section_revisions rev ON rev.id = ws.current_revision_id
    WHERE ws.workspace_id IN (SELECT id FROM project_workspaces WHERE project_id = ${projectId})
    ORDER BY ws.sort_order ASC, ws.id ASC
  `
  const sections = sectionRows as Record<string, unknown>[]
  const files = await sql`
    SELECT workspace_section_id, file_name, storage_url FROM project_workspace_files
    WHERE workspace_id IN (SELECT id FROM project_workspaces WHERE project_id = ${projectId})
  `
  const evidenceSummary = (files as Array<{ workspace_section_id?: number; file_name?: string; storage_url?: string }>)
    .map((row) => {
      const section = sections.find((item) => Number(item.id) === Number(row.workspace_section_id))
      return `${section ? String(section.title) : "Project"}: ${row.file_name || "file"} ${row.storage_url || ""}`.trim()
    })
    .join("\n")
  const reportContext = sections.map((row) => formatSectionPacket(row, false)).join("\n\n")
  const assignmentBrief = [`Assignment: ${assignment.title}`, assignment.instructions || ""].filter(Boolean).join("\n")
  const modelId = resolveModelForFeature(assignment.ai_grading_settings.model_feature || "project_ai_grade")
  const errors: string[] = []
  let graded = 0

  for (const section of sections) {
    const sectionId = Number(section.id)
    const maxScore = Math.max(0.01, Number((section.config as { points?: number } | null)?.points) || 1)
    try {
      const grade = await runProjectSectionAiGrade({
        sectionTitle: String(section.title || "Section"),
        instructions: section.instructions != null ? String(section.instructions) : assignment.instructions,
        maxScore,
        rubric: rubricForSection(assignment.rubric, section),
        studentContent: formatSectionPacket(section, true),
        reportContext,
        assignmentBrief,
        evidenceSummary,
        settings: assignment.ai_grading_settings,
      })
      grade.feedback = composeStudentProjectFeedback(grade)
      const runInsert = await sql`
        INSERT INTO project_ai_grading_runs (
          project_id, workspace_section_id, run_kind, scope, model_id, created_by_instructor_id
        )
        VALUES (${projectId}, ${sectionId}, 'AI_ASSIST', 'section', ${modelId}, ${instructorId})
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
          ${runId}, ${projectId}, ${sectionId},
          ${grade.suggested_score}, ${grade.max_score},
          ${JSON.stringify(grade.rubric_results)}::jsonb,
          ${JSON.stringify(grade.strengths)}::jsonb,
          ${JSON.stringify(grade.areas_for_improvement)}::jsonb,
          ${JSON.stringify(grade.missing_requirements)}::jsonb,
          ${JSON.stringify(grade.missing_evidence)}::jsonb,
          ${grade.feedback}, ${grade.confidence}, ${true},
          ${JSON.stringify(grade.raw_model_output)}::jsonb
        )
        RETURNING id
      `
      const resultId = Number((resultInsert[0] as { id: number }).id)
      await sql`
        INSERT INTO project_instructor_grade_entries (
          project_id, workspace_section_id, instructor_id, score, max_score, feedback, ai_suggestion_result_id
        )
        VALUES (
          ${projectId}, ${sectionId}, ${instructorId}, ${grade.suggested_score}, ${grade.max_score}, ${grade.feedback}, ${resultId}
        )
        ON CONFLICT (project_id, workspace_section_id)
        DO UPDATE SET
          score = EXCLUDED.score,
          max_score = EXCLUDED.max_score,
          feedback = EXCLUDED.feedback,
          ai_suggestion_result_id = EXCLUDED.ai_suggestion_result_id,
          instructor_id = EXCLUDED.instructor_id,
          updated_at = NOW()
      `
      graded += 1
      console.log(`[auto-ai-grade] section ${sectionId} ${grade.suggested_score}/${grade.max_score}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI grading failed"
      errors.push(`${String(section.title || sectionId)}: ${message}`)
      console.error("[auto-ai-grade]", sectionId, error)
    }
  }

  const all = await sql`
    SELECT score, max_score FROM project_instructor_grade_entries WHERE project_id = ${projectId}
  `
  let earned = 0
  let possible = 0
  for (const row of all) {
    earned += Number((row as { score: number }).score) || 0
    possible += Number((row as { max_score: number }).max_score) || 0
  }
  const cap = Number(assignment.max_points) || possible || 20
  const instrPoints = possible > 0 ? (earned / possible) * cap : 0
  try {
    const existingScore = await sql`SELECT project_id FROM project_scores WHERE project_id = ${projectId} LIMIT 1`
    if (existingScore.length) {
      await sql`
        UPDATE project_scores
        SET instructor_points = ${instrPoints}, last_updated = NOW()
        WHERE project_id = ${projectId}
      `
    } else {
      await sql`
        INSERT INTO project_scores (project_id, instructor_points, total_score)
        VALUES (${projectId}, ${instrPoints}, ${instrPoints})
      `
    }
    await upsertProjectComponentScore(projectId, "instructor", instrPoints, cap, { provisional: true, sections: graded })
    await syncProjectTotalFromComponents(projectId)
  } catch (error) {
    console.error("[auto-ai-grade] score rollup", error)
    errors.push(error instanceof Error ? error.message : "Could not roll up the total")
  }
  await logProjectGradingAudit({
    projectId,
    eventType: "AI_ASSIST_RUN",
    actorInstructorId: instructorId,
    comment: `Provisional AI grade ${instrPoints.toFixed(1)} / ${cap}. Waiting for instructor approval.`,
    payload: { graded, errors },
  })
  return { graded, errors }
}
