/**
 * In-lecture circuit workspace — circuit_submission-style problems on slide decks.
 */

import { markdownLatexExplanationToMarkdown } from "@/lib/markdown-latex-explanation"
import { repairLatexDamagedByJsonEscapes } from "@/lib/math-markdown"
import { parseQuestionMedia, type QuestionMedia } from "@/lib/question-media"
import { parseCircuitSubmissionConfig, type CircuitSubmissionConfig } from "@/lib/circuit-submission"
import {
  parseCircuitWorkspace,
  workspaceHasContent,
  type CircuitWorkspace,
} from "@/lib/circuit-workspace"

export type LectureWorkspaceCategory = "nodal" | "mesh" | "thevenin_norton"

export type LectureWorkspaceQuestion = {
  id: string
  category: LectureWorkspaceCategory
  title: string
  topic?: string
  question_text: string
  question_media?: QuestionMedia
  step_by_step_solution: {
    format: "markdown_latex"
    content: string[]
  }
  solution_upload_config?: CircuitSubmissionConfig
  /** Instructor-published ink solution (read-only for students). */
  instructor_solution_workspace?: CircuitWorkspace | null
  /** When true, students can view step_by_step_solution content. Defaults to locked. */
  solution_unlocked?: boolean
  /** Set by student API: authored solution exists but may be locked. */
  solution_available?: boolean
}

export type LectureWorkspaceConfig = {
  enabled: boolean
  title: string
  button_label?: string
  questions: LectureWorkspaceQuestion[]
}

const DEFAULT_BUTTON_LABEL = "Workspace"
const DEFAULT_TITLE = "In-Class Workspace"

/** Draft/upload key when no structured problems are configured. */
export const LECTURE_WORKSPACE_FREEFORM_ID = "scratch"

export function defaultLectureWorkspaceConfig(): LectureWorkspaceConfig {
  return { enabled: true, title: DEFAULT_TITLE, button_label: DEFAULT_BUTTON_LABEL, questions: [] }
}

/** Short label for the lecture viewer header (avoids overlap with action buttons). */
export function condenseLectureViewerTitle(fullTitle: string): string {
  const trimmed = fullTitle.trim()
  if (!trimmed) return "Lecture"

  const lectureMatch = trimmed.match(/Lecture\s+(\d+)\s*:\s*([^—]+?)(?:\s*;\s*|$)/i)
  if (lectureMatch) {
    const week = lectureMatch[1]
    let topic = lectureMatch[2]!.trim()
    if (topic.length > 36) topic = `${topic.slice(0, 33)}…`
    return `Lecture ${week} · ${topic}`
  }

  const dashParts = trimmed.split(/\s*[—–-]\s*/)
  if (dashParts.length >= 2) {
    const tail = dashParts[dashParts.length - 1]!.trim()
    if (tail.length <= 44) return tail
    return `${tail.slice(0, 41)}…`
  }

  if (trimmed.length <= 44) return trimmed
  return `${trimmed.slice(0, 41)}…`
}

export function freeformWorkspaceQuestion(lectureTitle?: string): LectureWorkspaceQuestion {
  const label = lectureTitle?.trim() ? `Notes for ${condenseLectureViewerTitle(lectureTitle)}` : "In-class workspace"
  return {
    id: LECTURE_WORKSPACE_FREEFORM_ID,
    category: "nodal",
    title: label,
    topic: "Open workspace",
    question_text:
      "Use the workspace below for in-class notes, sketches, and problem work.",
    step_by_step_solution: { format: "markdown_latex", content: [] },
    solution_unlocked: false,
    solution_upload_config: {
      title: "In-class workspace",
      submission_instructions: "Draw and write in the ink workspace.",
      max_files: 0,
      require_solution_upload: false,
      grading_type: "manual",
    },
  }
}

export function categoryLabel(category: LectureWorkspaceCategory): string {
  switch (category) {
    case "nodal":
      return "Nodal Analysis"
    case "mesh":
      return "Mesh Analysis"
    case "thevenin_norton":
      return "Thevenin & Norton"
    default:
      return category
  }
}

function parseInstructorSolutionWorkspace(raw: Record<string, unknown>): CircuitWorkspace | null {
  const candidates: unknown[] = [
    raw.instructor_solution_workspace,
    raw.instructor_solution,
    raw.published_solution,
    raw.reference_solution,
    raw.demo_solution,
    raw.instructor_answer,
    raw.model_answer,
    raw.worked_solution,
  ]

  for (const candidate of candidates) {
    if (candidate == null) continue
    if (typeof candidate === "object" && candidate !== null && "workspace" in candidate) {
      const nested = parseCircuitWorkspace((candidate as Record<string, unknown>).workspace)
      if (nested && workspaceHasContent(nested)) return nested
    }
    const parsed = parseCircuitWorkspace(candidate)
    if (parsed && workspaceHasContent(parsed)) return parsed
  }

  return null
}

function normalizeSolution(raw: unknown): LectureWorkspaceQuestion["step_by_step_solution"] {
  if (!raw || typeof raw !== "object") {
    return { format: "markdown_latex", content: [] }
  }
  const o = raw as Record<string, unknown>
  const lines = Array.isArray(o.content)
    ? o.content.map((line) => String(line).trim()).filter(Boolean)
    : []
  const content = lines
    .map((line) => repairLatexDamagedByJsonEscapes(line))
    .map((line) => markdownLatexExplanationToMarkdown(line) ?? line)
    .filter(Boolean)
  return { format: "markdown_latex", content }
}

export function normalizeLectureWorkspaceQuestion(
  raw: unknown,
  fallbackIndex = 0,
): LectureWorkspaceQuestion | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const id =
    typeof o.id === "string" && o.id.trim() ? o.id.trim() : `q${fallbackIndex + 1}`
  const category = o.category as LectureWorkspaceCategory
  if (!["nodal", "mesh", "thevenin_norton"].includes(category)) return null
  const title = String(o.title ?? o.question_text ?? `Question ${fallbackIndex + 1}`).trim()
  const question_text = String(o.question_text ?? title).trim()
  if (!question_text) return null
  const media = parseQuestionMedia(o.question_media ?? o)
  const config = o.solution_upload_config
    ? parseCircuitSubmissionConfig(o.solution_upload_config)
    : parseCircuitSubmissionConfig({
        title: "Your worked solution",
        submission_instructions:
          "Use the workspace to show node/mesh equations and arithmetic, or upload a photo of your work.",
        max_files: 10,
        require_solution_upload: false,
        grading_type: "manual",
      })
  const solution = normalizeSolution(o.step_by_step_solution)
  return {
    id,
    category,
    title,
    topic: typeof o.topic === "string" ? o.topic.trim() : undefined,
    question_text,
    question_media: media ?? undefined,
    step_by_step_solution: solution,
    solution_upload_config: config,
    instructor_solution_workspace: parseInstructorSolutionWorkspace(o),
    solution_unlocked: o.solution_unlocked === true,
  }
}

export function parseLectureWorkspace(raw: unknown): LectureWorkspaceConfig {
  if (raw == null || raw === "") return defaultLectureWorkspaceConfig()
  if (typeof raw === "object" && Object.keys(raw as object).length === 0) {
    return defaultLectureWorkspaceConfig()
  }
  const o = raw as Record<string, unknown>
  const questionsRaw = Array.isArray(o.questions) ? o.questions : []
  const questions = questionsRaw
    .map((q, idx) => normalizeLectureWorkspaceQuestion(q, idx))
    .filter((q): q is LectureWorkspaceQuestion => q != null)
  return {
    enabled: o.enabled !== false,
    title:
      typeof o.title === "string" && o.title.trim() ? o.title.trim() : DEFAULT_TITLE,
    button_label:
      typeof o.button_label === "string" && o.button_label.trim()
        ? o.button_label.trim()
        : DEFAULT_BUTTON_LABEL,
    questions,
  }
}

export function groupWorkspaceQuestions(
  questions: LectureWorkspaceQuestion[],
): Array<{ label: string; items: LectureWorkspaceQuestion[] }> {
  const hasTopics = questions.some((q) => q.topic?.trim())
  if (!hasTopics) {
    return [{ label: "", items: questions }]
  }

  const groups = new Map<string, LectureWorkspaceQuestion[]>()
  const order: string[] = []
  for (const question of questions) {
    const label = question.topic?.trim() || categoryLabel(question.category)
    if (!groups.has(label)) {
      groups.set(label, [])
      order.push(label)
    }
    groups.get(label)!.push(question)
  }

  return order.map((label) => ({ label, items: groups.get(label)! }))
}

export function workspaceQuestionHasAuthoredSolution(q: LectureWorkspaceQuestion): boolean {
  return q.step_by_step_solution.content.some((line) => line.trim().length > 0)
}

export function isWorkspaceSolutionUnlocked(q: LectureWorkspaceQuestion): boolean {
  return q.solution_unlocked === true
}

export function sectionAllSolutionsUnlocked(items: LectureWorkspaceQuestion[]): boolean {
  const withSolutions = items.filter(workspaceQuestionHasAuthoredSolution)
  if (withSolutions.length === 0) return false
  return withSolutions.every(isWorkspaceSolutionUnlocked)
}

/** Strip step-by-step solutions for student fetch; reveal only instructor-unlocked questions. */
export function stripLectureWorkspaceSolutions(
  config: LectureWorkspaceConfig,
  revealAll = false,
): LectureWorkspaceConfig {
  if (revealAll) return config
  return {
    ...config,
    questions: config.questions.map((q) => {
      const hasContent = workspaceQuestionHasAuthoredSolution(q)
      const unlocked = isWorkspaceSolutionUnlocked(q)
      return {
        ...q,
        solution_available: hasContent,
        solution_unlocked: unlocked,
        step_by_step_solution:
          unlocked && hasContent
            ? q.step_by_step_solution
            : { format: "markdown_latex", content: [] },
      }
    }),
  }
}

export function serializeLectureWorkspaceForStorage(
  config: LectureWorkspaceConfig,
): LectureWorkspaceConfig {
  return parseLectureWorkspace(config)
}

/** Stable numeric id for upload paths (per lecture question). */
export function lectureWorkspaceQuestionNumericId(questionId: string, index: number): number {
  const digits = questionId.replace(/\D/g, "")
  const parsed = Number.parseInt(digits, 10)
  if (Number.isFinite(parsed) && parsed > 0) return parsed
  return index + 1
}

export function solutionMarkdownFromQuestion(q: LectureWorkspaceQuestion): string {
  return q.step_by_step_solution.content.join("\n\n")
}
