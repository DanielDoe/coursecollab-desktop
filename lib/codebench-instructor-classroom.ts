import {
  CLASSROOM_SUBMISSION_KIND_CODE,
  CLASSROOM_SUBMISSION_KIND_SOLUTION,
  parseClassroomSolutionQuestionConfig,
  type ClassroomSolutionQuestionConfig,
} from "@/lib/classroom-solution-submission"
import {
  CODEBENCH_LANGUAGES,
  DEFAULT_CODEBENCH_LANGUAGE_ID,
  type CodebenchLanguageId,
} from "@/lib/codebench-languages"
import { classroomAssignmentIsOpen } from "@/lib/classroom-submission-availability"
import {
  classifyCodebenchCourseTopic,
  groupRowsByCodebenchTopic,
  type CodebenchCourseTopic,
} from "@/lib/codebench-course-topics"

export type ClassroomAssignmentRow = {
  id: number
  title: string
  description: string | null
  created_at: string
  session: string | null
  submission_kind: string
  question_config: unknown
  due_at: string | null
  expires_at: string | null
  is_active: boolean
  duration_hours?: number | null
}

export type InstructorClassroomHandoff = {
  submissionId: number
  title: string
  submissionKind: typeof CLASSROOM_SUBMISSION_KIND_CODE | typeof CLASSROOM_SUBMISSION_KIND_SOLUTION
  questionText: string
  description: string | null
  session: string | null
  languageId: CodebenchLanguageId
  starterCode: string
  starterFileName: string
  questionConfig: ClassroomSolutionQuestionConfig | null
  isActive: boolean
  dueAt: string | null
  pointsHint?: number
}

function inferLanguageId(text: string): CodebenchLanguageId {
  const lower = text.toLowerCase()
  if (/\bpython\b|\bdef main\b|\.py\b/.test(lower)) return "python"
  if (/\b#include\s*<stdio\.h>|\bprintf\s*\(/.test(lower)) return "c"
  return DEFAULT_CODEBENCH_LANGUAGE_ID
}

export function extractClassroomQuestionText(row: ClassroomAssignmentRow): string {
  const kind = String(row.submission_kind ?? CLASSROOM_SUBMISSION_KIND_CODE).toLowerCase()
  if (kind === CLASSROOM_SUBMISSION_KIND_SOLUTION) {
    const config = parseClassroomSolutionQuestionConfig(row.question_config)
    if (config?.question_text) return config.question_text
  }
  const description = String(row.description ?? "").trim()
  if (description) return description
  return row.title
}

export function classroomAssignmentToHandoff(row: ClassroomAssignmentRow): InstructorClassroomHandoff {
  const kindRaw = String(row.submission_kind ?? CLASSROOM_SUBMISSION_KIND_CODE).toLowerCase()
  const submissionKind =
    kindRaw === CLASSROOM_SUBMISSION_KIND_SOLUTION
      ? CLASSROOM_SUBMISSION_KIND_SOLUTION
      : CLASSROOM_SUBMISSION_KIND_CODE
  const questionConfig =
    submissionKind === CLASSROOM_SUBMISSION_KIND_SOLUTION
      ? parseClassroomSolutionQuestionConfig(row.question_config)
      : null
  const questionText = extractClassroomQuestionText(row)
  const languageId = inferLanguageId(questionText)
  const language = CODEBENCH_LANGUAGES.find((entry) => entry.id === languageId) ?? CODEBENCH_LANGUAGES[0]!

  return {
    submissionId: row.id,
    title: row.title,
    submissionKind,
    questionText,
    description: row.description,
    session: row.session,
    languageId,
    starterCode: language.defaultCode,
    starterFileName: language.fileName,
    questionConfig,
    isActive: classroomAssignmentIsOpen(row),
    dueAt: row.due_at ?? row.expires_at ?? null,
    pointsHint: questionConfig?.points_hint,
  }
}

export function groupClassroomAssignmentsBySession(rows: ClassroomAssignmentRow[]) {
  const map = new Map<string, ClassroomAssignmentRow[]>()
  for (const row of rows) {
    const key = row.session?.trim() || "All sections"
    const list = map.get(key) ?? []
    list.push(row)
    map.set(key, list)
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
}

function questionConfigTopicHint(config: unknown): string | null {
  if (config == null || config === "") return null
  try {
    const obj =
      typeof config === "string" ? (JSON.parse(config) as Record<string, unknown>) : (config as Record<string, unknown>)
    if (!obj || typeof obj !== "object") return null
    for (const key of ["topic", "unit", "module", "chapter"]) {
      const value = obj[key]
      if (typeof value === "string" && value.trim()) return value.trim()
    }
  } catch {
    return null
  }
  return null
}

export function classroomAssignmentTopicMeta(row: ClassroomAssignmentRow): CodebenchCourseTopic {
  return classifyCodebenchCourseTopic(
    questionConfigTopicHint(row.question_config),
    row.title,
    extractClassroomQuestionText(row),
  )
}

export function classroomAssignmentTopic(row: ClassroomAssignmentRow): string {
  return classroomAssignmentTopicMeta(row).label
}

export function groupClassroomAssignmentsByTopic(
  rows: ClassroomAssignmentRow[],
): Array<[CodebenchCourseTopic, ClassroomAssignmentRow[]]> {
  return groupRowsByCodebenchTopic(rows, classroomAssignmentTopicMeta)
}
