import { sql } from "@/lib/db"
import { ensureProjectWorkspaceSchema } from "@/lib/ensure-project-workspace-schema"
import {
  DEFAULT_SECTION_CONFIG,
  type ProjectSectionRevisionContent,
  type ProjectSubmissionStatus,
  type ProjectTemplateSection,
} from "@/lib/projects/project-template-types"
import { slugifySectionKey } from "@/lib/projects/project-template-utils"

export async function loadTemplateSections(assignmentId: number): Promise<ProjectTemplateSection[]> {
  await ensureProjectWorkspaceSchema()
  const rows = await sql`
    SELECT id, section_key, sort_order, title, instructions, config
    FROM project_template_sections
    WHERE assignment_id = ${assignmentId}
    ORDER BY sort_order ASC, id ASC
  `
  return rows.map((r) => ({
    id: Number(r.id),
    section_key: String(r.section_key),
    sort_order: Number(r.sort_order),
    title: String(r.title),
    instructions: r.instructions != null ? String(r.instructions) : null,
    config: { ...DEFAULT_SECTION_CONFIG(), ...(r.config as object) },
  }))
}

export async function replaceTemplateSections(
  assignmentId: number,
  sections: ProjectTemplateSection[],
): Promise<void> {
  await ensureProjectWorkspaceSchema()
  await sql`DELETE FROM project_template_sections WHERE assignment_id = ${assignmentId}`
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]
    const key = s.section_key || slugifySectionKey(s.title, i)
    await sql`
      INSERT INTO project_template_sections (
        assignment_id, section_key, sort_order, title, instructions, config
      )
      VALUES (
        ${assignmentId},
        ${key},
        ${i},
        ${s.title},
        ${s.instructions},
        ${JSON.stringify(s.config ?? DEFAULT_SECTION_CONFIG())}::jsonb
      )
    `
  }
}

export async function getOrCreateWorkspace(projectId: number, assignmentId: number | null) {
  await ensureProjectWorkspaceSchema()
  const existing = await sql`
    SELECT * FROM project_workspaces WHERE project_id = ${projectId} LIMIT 1
  `
  if (existing.length > 0) {
    return existing[0] as Record<string, unknown>
  }

  const inserted = await sql`
    INSERT INTO project_workspaces (project_id, assignment_id, submission_status)
    VALUES (${projectId}, ${assignmentId}, 'DRAFT')
    RETURNING *
  `
  const ws = inserted[0] as { id: number; assignment_id: number | null }

  if (assignmentId) {
    const template = await loadTemplateSections(assignmentId)
    for (let i = 0; i < template.length; i++) {
      const t = template[i]
      await sql`
        INSERT INTO project_workspace_sections (
          workspace_id, template_section_id, section_key, sort_order,
          title, instructions, config, status
        )
        VALUES (
          ${ws.id},
          ${t.id ?? null},
          ${t.section_key},
          ${i},
          ${t.title},
          ${t.instructions},
          ${JSON.stringify(t.config)}::jsonb,
          'NOT_STARTED'
        )
      `
    }
  }

  return inserted[0] as Record<string, unknown>
}

export async function loadWorkspaceBundle(projectId: number) {
  await ensureProjectWorkspaceSchema()
  const projectRows = await sql`
    SELECT p.id, p.title, p.assignment_id, p.group_id, p.status
    FROM projects p WHERE p.id = ${projectId} LIMIT 1
  `
  if (projectRows.length === 0) return null
  const project = projectRows[0] as {
    id: number
    title: string
    assignment_id: number | null
    group_id: number
    status: string
  }

  const ws = await getOrCreateWorkspace(projectId, project.assignment_id)
  const workspaceId = Number(ws.id)

  const sections = await sql`
    SELECT ws.*,
      (
        SELECT jsonb_build_object(
          'id', r.id,
          'revision_number', r.revision_number,
          'content', r.content,
          'change_summary', r.change_summary,
          'created_at', r.created_at,
          'created_by_student_id', r.created_by_student_id,
          'author_name', s.full_name
        )
        FROM project_section_revisions r
        LEFT JOIN students s ON s.id = r.created_by_student_id
        WHERE r.id = ws.current_revision_id
      ) AS current_revision
    FROM project_workspace_sections ws
    WHERE ws.workspace_id = ${workspaceId}
    ORDER BY ws.sort_order ASC, ws.id ASC
  `

  const members = await sql`
    SELECT s.id, s.full_name, s.student_id
    FROM group_members gm
    JOIN students s ON s.id = gm.student_id
    WHERE gm.group_id = ${project.group_id}
    ORDER BY s.full_name
  `

  return { project, workspace: ws, sections, members }
}

export async function saveSectionRevision(params: {
  workspaceSectionId: number
  content: ProjectSectionRevisionContent
  studentId?: number | null
  instructorId?: number | null
  changeSummary: string
  activityType?: string
}) {
  await ensureProjectWorkspaceSchema()
  const secRows = await sql`
    SELECT ws.id, ws.workspace_id, ws.title, ws.status,
      (SELECT MAX(revision_number) FROM project_section_revisions WHERE workspace_section_id = ws.id) AS max_rev
    FROM project_workspace_sections ws
    WHERE ws.id = ${params.workspaceSectionId}
    LIMIT 1
  `
  if (secRows.length === 0) throw new Error("Section not found")
  const sec = secRows[0] as { id: number; workspace_id: number; title: string; max_rev: number | null }

  const nextRev = (Number(sec.max_rev) || 0) + 1
  const inserted = await sql`
    INSERT INTO project_section_revisions (
      workspace_section_id, revision_number, content, change_summary,
      created_by_student_id, created_by_instructor_id
    )
    VALUES (
      ${params.workspaceSectionId},
      ${nextRev},
      ${JSON.stringify(params.content)}::jsonb,
      ${params.changeSummary},
      ${params.studentId ?? null},
      ${params.instructorId ?? null}
    )
    RETURNING id
  `
  const revisionId = Number(inserted[0].id)

  const hasContent = (params.content.blocks?.length ?? 0) > 0
  const newStatus = hasContent ? "IN_PROGRESS" : "NOT_STARTED"

  await sql`
    UPDATE project_workspace_sections
    SET current_revision_id = ${revisionId},
        status = ${newStatus},
        updated_at = NOW()
    WHERE id = ${params.workspaceSectionId}
  `

  await sql`
    UPDATE project_workspaces
    SET submission_status = CASE
          WHEN submission_status IN ('DRAFT', 'RETURNED_FOR_REVISION') THEN 'IN_PROGRESS'
          ELSE submission_status
        END,
        updated_at = NOW()
    WHERE id = ${sec.workspace_id}
  `

  await sql`
    INSERT INTO project_activity_events (
      workspace_id, workspace_section_id, event_type,
      actor_student_id, actor_instructor_id, summary, metadata
    )
    VALUES (
      ${sec.workspace_id},
      ${params.workspaceSectionId},
      ${params.activityType ?? "SECTION_EDITED"},
      ${params.studentId ?? null},
      ${params.instructorId ?? null},
      ${params.changeSummary},
      ${JSON.stringify({ revision_number: nextRev, section_title: sec.title })}::jsonb
    )
  `

  return { revisionId, revisionNumber: nextRev, status: newStatus as ProjectSubmissionStatus }
}

export async function markSectionComplete(workspaceSectionId: number, studentId: number) {
  await ensureProjectWorkspaceSchema()
  await sql`
    UPDATE project_workspace_sections
    SET status = 'COMPLETE', updated_at = NOW()
    WHERE id = ${workspaceSectionId}
  `
  const sec = await sql`
    SELECT workspace_id, title FROM project_workspace_sections WHERE id = ${workspaceSectionId} LIMIT 1
  `
  if (sec.length) {
    await sql`
      INSERT INTO project_activity_events (
        workspace_id, workspace_section_id, event_type, actor_student_id, summary
      )
      VALUES (
        ${sec[0].workspace_id},
        ${workspaceSectionId},
        'SECTION_COMPLETED',
        ${studentId},
        ${`Marked "${sec[0].title}" complete`}
      )
    `
  }
}
