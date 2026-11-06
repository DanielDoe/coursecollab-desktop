import { sql } from "@/lib/db"
import { blockHasContent } from "@/lib/projects/project-contribution"
import type { ProjectSubmissionWorkflowConfig, SectionContentBlock } from "@/lib/projects/project-template-types"

export function parseSubmissionWorkflow(raw: unknown): ProjectSubmissionWorkflowConfig {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  return {
    confirmation_mode: o.confirmation_mode === "ALL_MEMBERS" ? "ALL_MEMBERS" : "ONE_MEMBER",
    require_presentation_upload: Boolean(o.require_presentation_upload),
    require_references: Boolean(o.require_references),
    checklist_labels: Array.isArray(o.checklist_labels) ? o.checklist_labels.map(String) : undefined,
  }
}

export type SubmissionChecklistItem = {
  id: string
  label: string
  ok: boolean
}

type ChecklistSection = {
  status?: unknown
  title?: unknown
  config?: unknown
  current_revision?: { content?: { blocks?: SectionContentBlock[] } } | null
}

function sectionAnswered(section: ChecklistSection | undefined) {
  const blocks = section?.current_revision?.content?.blocks ?? []
  return blocks.some((block) => blockHasContent(block))
}

export async function buildSubmissionChecklist(
  workspaceId: number,
  source?: { workflow?: unknown; sections?: ChecklistSection[] },
): Promise<SubmissionChecklistItem[]> {
  const queried = source?.sections
    ? null
    : await sql`
        SELECT status, config, title FROM project_workspace_sections
        WHERE workspace_id = ${workspaceId}
      `
  const sections: ChecklistSection[] = source?.sections ?? (queried as ChecklistSection[])
  const files = await sql`SELECT COUNT(*)::int AS c FROM project_workspace_files WHERE workspace_id = ${workspaceId}`
  const refs = await sql`SELECT COUNT(*)::int AS c FROM project_workspace_references WHERE workspace_id = ${workspaceId}`

  const raw = source?.workflow && typeof source.workflow === "object" ? (source.workflow as Record<string, unknown>) : {}
  const workflow = parseSubmissionWorkflow(raw)
  const allowFileUpload = raw.allow_file_upload !== false
  const fileCount = Number(files[0]?.c) || 0

  const requiredIncomplete = sections.filter((section) => {
    const cfg = section.config as { required?: boolean } | undefined
    return cfg?.required !== false && section.status !== "COMPLETE"
  })

  const items: SubmissionChecklistItem[] = [
    {
      id: "sections",
      label: requiredIncomplete.length
        ? `${requiredIncomplete.length} required section${requiredIncomplete.length === 1 ? "" : "s"} still open`
        : "Required sections complete",
      ok: requiredIncomplete.length === 0,
    },
  ]

  if (allowFileUpload) {
    items.push(
      { id: "files", label: "Project files uploaded", ok: fileCount > 0 },
      { id: "evidence", label: "Evidence attached", ok: fileCount > 0 },
    )
  }

  if (workflow.require_references) {
    const referenceSection = sections.find((section) => /reference/i.test(String(section.title || "")))
    items.push({
      id: "references",
      label: "References included",
      ok: Number(refs[0]?.c) > 0 || sectionAnswered(referenceSection),
    })
  }

  if (workflow.require_presentation_upload) {
    items.push({
      id: "presentation",
      label: "Presentation uploaded",
      ok: fileCount > 0,
    })
  }

  return items
}
