export type ProjectSubmissionMode = "FREEFORM_SUBMISSION" | "STRUCTURED_REPORT"

export const PROJECT_SUBMISSION_STATUSES = [
  "DRAFT",
  "IN_PROGRESS",
  "READY_FOR_REVIEW",
  "GROUP_CONFIRMATION",
  "SUBMITTED",
  "RETURNED_FOR_REVISION",
  "FINALIZED",
] as const

export type ProjectSubmissionStatus = (typeof PROJECT_SUBMISSION_STATUSES)[number]

export type ProjectSectionContentType =
  | "text"
  | "image"
  | "figure"
  | "table"
  | "code"
  | "equation"
  | "file"
  | "link"
  | "diagram"

export type ProjectResponseFieldKind = "short_text" | "long_text" | "image" | "file" | "link" | "checklist" | "roster"

export type ProjectResponseField = {
  id: string
  label: string
  kind: ProjectResponseFieldKind
  required: boolean
  help?: string
  /** Record keystrokes for instructor replay. Off for names, course, and other short identity fields. */
  track_typing?: boolean
}

export type ProjectFieldTypingFrame = { t: number; v: string }

export type ProjectFieldContributor = {
  student_id?: number
  name: string
  words: number
  at?: string
}

export type ProjectFieldMeta = {
  author_student_id?: number
  author_name?: string
  /** Everyone who saved this field. The last saver owns the current text. */
  contributors?: ProjectFieldContributor[]
  typing?: ProjectFieldTypingFrame[]
}

export type ProjectTemplateSectionConfig = {
  required: boolean
  points: number
  expected_content?: string
  response_fields?: ProjectResponseField[]
  allowed_content_types: ProjectSectionContentType[]
  required_attachments?: string[]
  allow_figures: boolean
  allow_tables: boolean
  allow_references: boolean
  /** When on, students cannot copy or paste in this section and must type their answers. */
  block_paste?: boolean
  rubric_criterion_ids?: string[]
  cora_policy_placeholder?: string
  integrity_policy_placeholder?: string
  integrity?: import("@/lib/projects/project-integrity-types").ProjectSectionIntegrityOverride
}

export type ProjectTemplateSection = {
  id?: number
  section_key: string
  sort_order: number
  title: string
  instructions: string | null
  config: ProjectTemplateSectionConfig
}

export type ProjectSubmissionWorkflowConfig = {
  confirmation_mode: "ONE_MEMBER" | "ALL_MEMBERS"
  require_presentation_upload: boolean
  require_references: boolean
  checklist_labels?: string[]
}

export type SectionContentBlock =
  | { id: string; type: "text"; html: string }
  | { id: string; type: "image" | "figure"; url: string; caption?: string; alt?: string }
  | { id: string; type: "table"; headers: string[]; rows: string[][] }
  | { id: string; type: "code"; language: string; code: string }
  | { id: string; type: "equation"; latex: string }
  | { id: string; type: "file"; file_id: number; label?: string }
  | { id: string; type: "link"; url: string; label: string }
  | { id: string; type: "diagram"; url?: string; description?: string }

export type ProjectSectionRevisionContent = {
  blocks: SectionContentBlock[]
  /** Reserved for future Yjs snapshot / CRDT merge */
  collab?: { version: number; provider?: "yjs" | "none" }
  field_meta?: Record<string, ProjectFieldMeta>
}

export function fieldTracksTyping(field: { kind: string; track_typing?: boolean } | undefined) {
  if (!field) return false
  if (field.kind === "roster") return false
  if (field.track_typing != null) return field.track_typing
  return field.kind === "long_text"
}

export const DEFAULT_SECTION_CONFIG = (): ProjectTemplateSectionConfig => ({
  required: true,
  points: 0,
  response_fields: [],
  allowed_content_types: ["text", "image", "figure", "table", "code", "equation", "file", "link", "diagram"],
  allow_figures: true,
  allow_tables: true,
  allow_references: true,
})

export const PROJECT_ACTIVITY_TYPES = [
  "SECTION_EDITED",
  "TEXT_ADDED",
  "FIGURE_ADDED",
  "FILE_UPLOADED",
  "FILE_DELETED",
  "REFERENCE_ADDED",
  "COMMENT_ADDED",
  "COMMENT_RESOLVED",
  "SECTION_COMPLETED",
  "SUBMISSION_STATUS_CHANGED",
] as const

export type ProjectActivityType = (typeof PROJECT_ACTIVITY_TYPES)[number]
