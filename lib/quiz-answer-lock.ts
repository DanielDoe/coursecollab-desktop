/** Server-side helpers to prevent changing finalized lockable quiz answers on resume. */

import { sql } from "@/lib/db"

const LOCKABLE_QUESTION_TYPES = new Set(["mcq", "true_false", "select_all", "multi_output"])

export function isLockableQuizQuestionType(questionType: string | null | undefined): boolean {
  return LOCKABLE_QUESTION_TYPES.has(String(questionType || "").toLowerCase())
}

function parseAnswerData(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null
  try {
    const parsed = JSON.parse(trimmed) as unknown
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function normalizeComparableAnswer(value: unknown): string {
  if (value == null) return ""
  if (Array.isArray(value)) {
    return JSON.stringify([...value].map(String).sort())
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        return normalizeComparableAnswer(JSON.parse(trimmed))
      } catch {
        return trimmed.toLowerCase()
      }
    }
    return trimmed.toLowerCase()
  }
  return String(value).trim().toLowerCase()
}

function storedAnswerMatchesIncoming(
  selectedAnswer: unknown,
  answerDataRaw: unknown,
  incomingAnswer: unknown,
): boolean {
  const data = parseAnswerData(answerDataRaw)
  const storedFromData = data?.answer ?? data?.selectedAnswer
  const stored = storedFromData ?? selectedAnswer
  return normalizeComparableAnswer(stored) === normalizeComparableAnswer(incomingAnswer)
}

/** Matches LOCKABLE_ANSWER_FINALIZED_SQL in lib/quiz-answer-data-sql.ts */
export function isLockableAnswerFinalized(
  answerDataRaw: unknown,
  selectedAnswer: unknown,
): boolean {
  const hasAnswer =
    selectedAnswer != null && String(selectedAnswer).trim() !== ""
  if (!hasAnswer) return false

  const data = parseAnswerData(answerDataRaw)
  if (!data) return true
  if (data.evaluatedAt != null && String(data.evaluatedAt).trim() !== "") return true
  if (data.autoSave === false || data.autoSave === "false") return true
  return false
}

export async function getLockableAnswerBlockReason(
  attemptId: number,
  questionId: number,
  questionType: string | null | undefined,
  options?: { incomingAnswer?: unknown },
): Promise<string | null> {
  if (!isLockableQuizQuestionType(questionType)) return null
  const rows = await sql`
    SELECT selected_answer, answer_data
    FROM quiz_answers
    WHERE attempt_id = ${attemptId} AND question_id = ${questionId}
    LIMIT 1
  `
  if (rows.length === 0) return null
  const row = rows[0] as { selected_answer: unknown; answer_data: unknown }
  if (!isLockableAnswerFinalized(row.answer_data, row.selected_answer)) {
    return null
  }
  if (
    options?.incomingAnswer !== undefined &&
    storedAnswerMatchesIncoming(row.selected_answer, row.answer_data, options.incomingAnswer)
  ) {
    // Idempotent evaluate/submit for the same answer (submit already graded server-side).
    return null
  }
  return "This answer was already submitted and cannot be changed."
}
