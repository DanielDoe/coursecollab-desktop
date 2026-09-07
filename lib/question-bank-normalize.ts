/**
 * Normalize question bank options + correct_answer for storage and quiz copy.
 * MCQ/T/F: options = string[], correct_answer = letter ("A"–"E" or "A"/"B" for T/F).
 */

import { normalizeBankOptions } from "@/lib/question-bank-preview"

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const

export const TRUE_FALSE_OPTIONS = ["True", "False"] as const

function parseStoredValue(raw: unknown): unknown {
  if (raw == null || raw === "") return null
  if (typeof raw !== "string") return raw
  const t = raw.trim()
  try {
    return JSON.parse(t)
  } catch {
    return t
  }
}

function letterForOptionText(text: string, options: string[]): string | null {
  const trimmed = text.trim()
  const exact = options.findIndex((o) => o.trim() === trimmed)
  if (exact >= 0) return OPTION_LETTERS[exact] ?? null
  const lower = trimmed.toLowerCase()
  const ci = options.findIndex((o) => o.trim().toLowerCase() === lower)
  if (ci >= 0) return OPTION_LETTERS[ci] ?? null
  return null
}

/** Map any bank options shape to ordered option text strings. */
export function normalizeQuestionBankOptions(raw: unknown): string[] {
  return normalizeBankOptions(raw)
}

/** Normalize MCQ / T/F correct_answer to a single letter (or JSON array string for select_all). */
export function normalizeCorrectAnswerToLetter(
  correctAnswer: unknown,
  options: string[],
  questionType?: string,
): string {
  const parsed = parseStoredValue(correctAnswer)
  const qType = (questionType ?? "").toLowerCase()

  if (Array.isArray(parsed)) {
    const letters = parsed
      .map((item) => {
        const s = String(item).trim()
        if (/^[A-F]$/i.test(s)) return s.toUpperCase()
        return letterForOptionText(s, options) ?? s
      })
      .filter(Boolean)
    return JSON.stringify(letters)
  }

  if (parsed == null) return "A"

  if (typeof parsed === "number" && Number.isFinite(parsed)) {
    const idx = Math.floor(parsed)
    if (idx >= 0 && idx < OPTION_LETTERS.length) return OPTION_LETTERS[idx] ?? "A"
  }

  const str = String(parsed).trim()
  if (/^[A-F]$/i.test(str)) return str.toUpperCase()

  if (qType === "select_all" || qType === "multi_output") {
    if (str.includes(",") && !str.startsWith("[")) {
      const letters = str
        .split(",")
        .map((item) => {
          const part = item.trim()
          if (/^[A-F]$/i.test(part)) return part.toUpperCase()
          return letterForOptionText(part, options) ?? part
        })
        .filter(Boolean)
      return JSON.stringify(letters)
    }
  }

  if (qType === "true_false") {
    const lower = str.toLowerCase()
    if (lower === "true" || lower === "t") return "A"
    if (lower === "false" || lower === "f") return "B"
  }

  const byText = letterForOptionText(str, options)
  if (byText) return byText

  return str
}

export function normalizeTrueFalseBankRow(options: string[], correctAnswer: unknown): {
  options: string[]
  correct_answer: string
} {
  const opts =
    options.length >= 2
      ? [options[0] || TRUE_FALSE_OPTIONS[0], options[1] || TRUE_FALSE_OPTIONS[1]]
      : [...TRUE_FALSE_OPTIONS]

  return {
    options: opts,
    correct_answer: normalizeCorrectAnswerToLetter(correctAnswer, opts, "true_false"),
  }
}

export function normalizeMcqBankRow(options: unknown, correctAnswer: unknown): {
  options: string[]
  correct_answer: string
} {
  const opts = normalizeQuestionBankOptions(options)
  return {
    options: opts,
    correct_answer: normalizeCorrectAnswerToLetter(correctAnswer, opts, "mcq"),
  }
}

export function mapBankOptionsToQuizColumns(raw: unknown): {
  option_a: string | null
  option_b: string | null
  option_c: string | null
  option_d: string | null
  option_e: string | null
} {
  const options = normalizeQuestionBankOptions(raw)
  return {
    option_a: options[0] ?? null,
    option_b: options[1] ?? null,
    option_c: options[2] ?? null,
    option_d: options[3] ?? null,
    option_e: options[4] ?? null,
  }
}

export function resolveQuizCorrectAnswerLetter(
  correctAnswer: unknown,
  options: string[],
  questionType?: string,
): string {
  return normalizeCorrectAnswerToLetter(correctAnswer, options, questionType)
}

export function quizQuestionOptionsAsStrings(q: {
  option_a?: string | null
  option_b?: string | null
  option_c?: string | null
  option_d?: string | null
  option_e?: string | null
}): string[] {
  return [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e].filter(
    (o): o is string => typeof o === "string" && o.trim().length > 0,
  )
}

/** Normalize quiz_questions.correct_answer to letters before local grading. */
export function normalizeQuizRowForEvaluation<
  T extends {
    question_type?: string | null
    correct_answer?: unknown
    option_a?: string | null
    option_b?: string | null
    option_c?: string | null
    option_d?: string | null
    option_e?: string | null
  },
>(row: T): T {
  const qType = String(row.question_type || "mcq").toLowerCase()
  if (!["mcq", "multiple_choice", "true_false", "select_all", "multi_output"].includes(qType)) {
    return row
  }

  const options = quizQuestionOptionsAsStrings(row)
  const normalized = normalizeCorrectAnswerToLetter(row.correct_answer, options, qType)
  const prev =
    row.correct_answer == null
      ? ""
      : typeof row.correct_answer === "string"
        ? row.correct_answer.trim()
        : JSON.stringify(row.correct_answer)

  if (normalized === prev) return row
  return { ...row, correct_answer: normalized }
}

/** Compact quiz_questions.correct_answer for API save (letters for MCQ/T-F/select_all). */
export function normalizeQuizQuestionCorrectAnswerForSave(q: {
  question_type?: string | null
  correct_answer?: unknown
  option_a?: string | null
  option_b?: string | null
  option_c?: string | null
  option_d?: string | null
  option_e?: string | null
}): string {
  const qType = String(q.question_type || "mcq").toLowerCase()
  if (qType === "circuit_submission" || qType === "circuit_multi_part") {
    return ""
  }

  const options = quizQuestionOptionsAsStrings(q)

  if (["select_all", "multi_output", "mcq", "multiple_choice", "true_false"].includes(qType)) {
    return normalizeCorrectAnswerToLetter(q.correct_answer, options, qType)
  }

  if (q.correct_answer == null) return ""
  return String(q.correct_answer)
}
