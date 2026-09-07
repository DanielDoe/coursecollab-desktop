import { parseCircuitSpec } from "@/lib/engineering-circuit-types"

export type QuestionWithReferenceFields = {
  expected_answer?: string | null
  sample_answer?: string | null
  correct_answer?: unknown
  circuit_spec?: unknown
  expectedAnswer?: string | null
  sampleAnswer?: string | null
}

function trimOrNull(value: unknown): string | null {
  if (value == null) return null
  const text = String(value).trim()
  return text.length > 0 ? text : null
}

/**
 * Canonical reference answer for AI grading. Every student on the same question
 * must be scored against this value so results stay consistent.
 *
 * Priority: expected_answer → sample_answer → circuit_spec.expectedAnswer →
 * circuit_spec.sampleSolution → correct_answer (when not a bare MCQ letter).
 */
export function resolveReferenceAnswerForAiGrading(
  question: QuestionWithReferenceFields | null | undefined,
): string | null {
  if (!question) return null

  const direct =
    trimOrNull(question.expected_answer) ??
    trimOrNull(question.expectedAnswer) ??
    trimOrNull(question.sample_answer) ??
    trimOrNull(question.sampleAnswer)

  if (direct) return direct

  const spec = parseCircuitSpec(question.circuit_spec)
  const fromSpec =
    trimOrNull(spec.expectedAnswer) ?? trimOrNull(spec.sampleSolution)
  if (fromSpec) return fromSpec

  const correct = trimOrNull(question.correct_answer)
  if (!correct) return null

  // Single-letter MCQ keys are not useful as AI reference answers.
  if (/^[A-E]$/i.test(correct)) return null

  return correct
}

export function formatCanonicalReferenceAnswerForPrompt(reference: string | null): string {
  if (!reference) {
    return "N/A — grade from question requirements only; be consistent across students."
  }

  return `CANONICAL REFERENCE ANSWER (authoritative — grade EVERY student against this exact reference; do NOT re-derive, invent, or substitute a different expected result):
${reference}`
}

export const REFERENCE_ANSWER_FEEDBACK_MARKER = "REFERENCE SOLUTION (same for all students)"

export function formatReferenceAnswerFeedbackHeader(reference: string | null | undefined): string | null {
  const ref = String(reference ?? "").trim()
  if (!ref) return null
  return `${REFERENCE_ANSWER_FEEDBACK_MARKER}:\n${ref}`
}

export function stripReferenceAnswerFeedbackHeader(feedback: string): string {
  const text = String(feedback ?? "").trim()
  if (!text.includes(REFERENCE_ANSWER_FEEDBACK_MARKER)) return text
  const notesMarker = "\n\nNotes on your submission:\n"
  const idx = text.indexOf(notesMarker)
  if (idx >= 0) return text.slice(idx + notesMarker.length).trim()
  const lines = text.split("\n")
  const headerLine = lines.findIndex((l) => l.includes(REFERENCE_ANSWER_FEEDBACK_MARKER))
  if (headerLine >= 0) return lines.slice(headerLine + 2).join("\n").trim()
  return text
}

export function withReferenceAnswerFeedbackHeader(
  aiFeedback: string,
  reference: string | null | undefined,
): string {
  const body = stripReferenceAnswerFeedbackHeader(aiFeedback).trim()
  const header = formatReferenceAnswerFeedbackHeader(reference)
  if (!header) return body
  if (!body) return header
  return `${header}\n\nNotes on your submission:\n${body}`
}
