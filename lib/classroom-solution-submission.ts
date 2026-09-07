/**
 * Classroom solution submissions — worked-solution assignments (upload / photo / workspace)
 * for classroom points, using the same answer shape as circuit_submission quizzes.
 */

import { parseQuestionMedia, type QuestionMedia } from "@/lib/question-media"
import {
  buildCircuitSubmissionConfig,
  parseCircuitSubmissionConfig,
  type CircuitSubmissionConfig,
} from "@/lib/circuit-submission"

export const CLASSROOM_SUBMISSION_KIND_CODE = "code" as const
export const CLASSROOM_SUBMISSION_KIND_SOLUTION = "solution" as const

export type ClassroomSubmissionKind =
  | typeof CLASSROOM_SUBMISSION_KIND_CODE
  | typeof CLASSROOM_SUBMISSION_KIND_SOLUTION

export type ClassroomSolutionQuestionConfig = {
  question_type: "circuit_submission" | "solution_submission"
  question_text: string
  question_media?: QuestionMedia | null
  solution_upload_config?: CircuitSubmissionConfig | null
  expected_answer?: string | null
  /** Display points hint for students (actual award uses classroom points base + booster) */
  points_hint?: number
}

export function parseClassroomSubmissionKind(raw: unknown): ClassroomSubmissionKind {
  const k = String(raw ?? "").trim().toLowerCase()
  return k === CLASSROOM_SUBMISSION_KIND_SOLUTION
    ? CLASSROOM_SUBMISSION_KIND_SOLUTION
    : CLASSROOM_SUBMISSION_KIND_CODE
}

export function isClassroomSolutionAssignment(kind: unknown): boolean {
  return parseClassroomSubmissionKind(kind) === CLASSROOM_SUBMISSION_KIND_SOLUTION
}

export function parseClassroomSolutionQuestionConfig(raw: unknown): ClassroomSolutionQuestionConfig | null {
  if (raw == null || raw === "") return null
  try {
    const obj =
      typeof raw === "string"
        ? (JSON.parse(raw) as Record<string, unknown>)
        : (raw as Record<string, unknown>)
    if (!obj || typeof obj !== "object") return null
    const question_text = String(obj.question_text ?? "").trim()
    if (!question_text) return null
    const qt = String(obj.question_type ?? "circuit_submission").trim().toLowerCase()
    const media = obj.question_media != null ? parseQuestionMedia(obj.question_media) : null
    const config = obj.solution_upload_config
      ? parseCircuitSubmissionConfig(obj.solution_upload_config)
      : parseCircuitSubmissionConfig(null)
    return {
      question_type:
        qt === "solution_submission" || qt === "circuit_submission"
          ? (qt as ClassroomSolutionQuestionConfig["question_type"])
          : "circuit_submission",
      question_text,
      question_media: media?.media_enabled && media.media_url ? media : null,
      solution_upload_config: config,
      expected_answer:
        typeof obj.expected_answer === "string" && obj.expected_answer.trim()
          ? obj.expected_answer.trim()
          : null,
      points_hint:
        typeof obj.points_hint === "number" && Number.isFinite(obj.points_hint)
          ? obj.points_hint
          : undefined,
    }
  } catch {
    return null
  }
}

export function buildClassroomCircuitQuestionConfig(input: {
  question_text: string
  title: string
  media_url?: string | null
  media_caption?: string | null
  expected_answer?: string | null
  submission_instructions?: string
  points_hint?: number
}): ClassroomSolutionQuestionConfig {
  return {
    question_type: "circuit_submission",
    question_text: input.question_text,
    question_media: input.media_url
      ? {
          media_enabled: true,
          media_url: input.media_url,
          media_type: "image",
          media_caption: input.media_caption ?? null,
          media_alt_text: input.media_caption ?? null,
          media_placement: "above_question",
          media_allow_zoom: true,
        }
      : null,
    solution_upload_config: buildCircuitSubmissionConfig({
      title: input.title,
      submission_instructions:
        input.submission_instructions ??
        "Show all work. Upload a PDF or photo, or use the ink workspace to write your solution.",
      require_solution_upload: true,
      grading_type: "manual",
    }),
    expected_answer: input.expected_answer ?? null,
    points_hint: input.points_hint ?? 2.5,
  }
}

export const CLASSROOM_SOLUTION_POINTS_CATEGORY = "solution_submission"
