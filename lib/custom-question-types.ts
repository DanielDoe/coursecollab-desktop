import {
  getQuestionBankTypeMeta,
  QUESTION_BANK_TYPES,
  type QuestionBankTypeCategory,
  type QuestionBankTypeMeta,
} from "@/lib/question-bank-type-config"

export type CustomQuestionTypeFieldKind =
  | "text"
  | "textarea"
  | "options"
  | "code"
  | "rubric"
  | "media"
  | "boolean"

export type CustomQuestionTypeField = {
  key: string
  label: string
  kind: CustomQuestionTypeFieldKind
  required?: boolean
  description?: string
}

export type CustomQuestionTypeSchema = {
  fields: CustomQuestionTypeField[]
}

export type CustomQuestionTypeDraft = {
  typeId: string
  label: string
  description: string
  category: QuestionBankTypeCategory
  requiresOptions: boolean
  usesCodeEditor: boolean
  usesGradingGuidelines: boolean
  schema: CustomQuestionTypeSchema
  aiQuestionPrompt: string
}

export type CustomQuestionTypeRecord = CustomQuestionTypeDraft & {
  id: number
  courseId: number
  createdAt: string
}

const CUSTOM_TYPE_ID_RE = /^custom_[a-z0-9_]+$/

export function isCustomQuestionTypeId(typeId: string): boolean {
  return CUSTOM_TYPE_ID_RE.test(typeId)
}

export function normalizeCustomTypeId(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
  const base = slug.startsWith("custom_") ? slug : `custom_${slug || "type"}`
  return base.slice(0, 64)
}

export function customTypeToMeta(row: CustomQuestionTypeDraft): QuestionBankTypeMeta {
  return {
    id: row.typeId as QuestionBankTypeMeta["id"],
    label: row.label,
    description: row.description,
    category: row.category,
    icon: QUESTION_BANK_TYPES[0]!.icon,
    requiresOptions: row.requiresOptions,
    usesCodeEditor: row.usesCodeEditor,
    usesGradingGuidelines: row.usesGradingGuidelines,
  }
}

export function resolveQuestionBankTypeMeta(
  typeId: string,
  customTypes: CustomQuestionTypeDraft[] = [],
): QuestionBankTypeMeta | undefined {
  const builtIn = getQuestionBankTypeMeta(typeId)
  if (builtIn) return builtIn
  const custom = customTypes.find((t) => t.typeId === typeId)
  return custom ? customTypeToMeta(custom) : undefined
}

const ALLOWED_FIELD_KINDS = new Set<CustomQuestionTypeFieldKind>([
  "text",
  "textarea",
  "options",
  "code",
  "rubric",
  "media",
  "boolean",
])
const FIELD_KEY_RE = /^[a-z][a-z0-9_]{0,47}$/
const MAX_SCHEMA_FIELDS = 12
const MAX_FIELD_LABEL = 80
const MAX_FIELD_DESCRIPTION = 400
const MAX_AI_PROMPT = 2000

export function validateCustomQuestionTypeDraft(draft: CustomQuestionTypeDraft): string | null {
  if (!draft.label.trim()) return "Type name is required."
  if (!draft.description.trim()) return "Describe what this question type is for."
  if (!isCustomQuestionTypeId(draft.typeId)) {
    return "Type id must start with custom_ and use lowercase letters, numbers, or underscores."
  }
  if (!["choice", "coding", "structured"].includes(draft.category)) return "Invalid category."
  if (!Array.isArray(draft.schema.fields) || draft.schema.fields.length === 0) {
    return "Schema must include at least one field."
  }
  if (draft.schema.fields.length > MAX_SCHEMA_FIELDS) {
    return `Schema may include at most ${MAX_SCHEMA_FIELDS} fields.`
  }
  const seen = new Set<string>()
  for (const field of draft.schema.fields) {
    if (!field || typeof field !== "object") return "Invalid schema field."
    const key = String(field.key ?? "")
    if (!FIELD_KEY_RE.test(key)) {
      return "Each field needs a lowercase key (letters, numbers, underscores)."
    }
    if (seen.has(key)) return "Schema field keys must be unique."
    seen.add(key)
    if (!ALLOWED_FIELD_KINDS.has(field.kind)) return "Unknown schema field kind."
    if (!String(field.label ?? "").trim()) return "Each field needs a label."
    if (String(field.label).length > MAX_FIELD_LABEL) return "Field label is too long."
    if (field.description && String(field.description).length > MAX_FIELD_DESCRIPTION) {
      return "Field description is too long."
    }
  }
  if (draft.aiQuestionPrompt && draft.aiQuestionPrompt.length > MAX_AI_PROMPT) {
    return "AI prompt is too long."
  }
  return null
}

export function mapCustomTypeRow(row: Record<string, unknown>): CustomQuestionTypeRecord {
  const schemaRaw = row.schema_json
  let schema: CustomQuestionTypeSchema = { fields: [] }
  if (schemaRaw && typeof schemaRaw === "object") {
    schema = schemaRaw as CustomQuestionTypeSchema
  } else if (typeof schemaRaw === "string") {
    try {
      schema = JSON.parse(schemaRaw) as CustomQuestionTypeSchema
    } catch {
      schema = { fields: [] }
    }
  }

  return {
    id: Number(row.id),
    courseId: Number(row.course_id),
    typeId: String(row.type_id),
    label: String(row.label),
    description: String(row.description ?? ""),
    category: String(row.category) as QuestionBankTypeCategory,
    requiresOptions: Boolean(row.requires_options),
    usesCodeEditor: Boolean(row.uses_code_editor),
    usesGradingGuidelines: Boolean(row.uses_grading_guidelines),
    schema,
    aiQuestionPrompt: String(row.ai_question_prompt ?? ""),
    createdAt: String(row.created_at),
  }
}
