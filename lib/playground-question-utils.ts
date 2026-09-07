/** Question types supported in classroom playground (excludes select_all — unstable in live games). */
export const PLAYGROUND_ALLOWED_QUESTION_TYPES = ["mcq", "true_false"] as const

export type PlaygroundAllowedQuestionType = (typeof PLAYGROUND_ALLOWED_QUESTION_TYPES)[number]

export function isPlaygroundAllowedQuestionType(type?: string | null): boolean {
  if (!type) return false
  return (PLAYGROUND_ALLOWED_QUESTION_TYPES as readonly string[]).includes(type.toLowerCase())
}

/** Normalize a requested type filter to playground-safe types; falls back to defaults. */
export function filterPlaygroundQuestionTypes(types: string[]): PlaygroundAllowedQuestionType[] {
  const allowed = new Set(PLAYGROUND_ALLOWED_QUESTION_TYPES as readonly string[])
  const filtered = types
    .map((t) => t.trim().toLowerCase())
    .filter((t): t is PlaygroundAllowedQuestionType => allowed.has(t))
  return filtered.length > 0 ? filtered : [...PLAYGROUND_ALLOWED_QUESTION_TYPES]
}

function parseJsonArray(value: string): unknown[] | null {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Parse option letters (A–E) from bank/API correct_answer values. */
export function parsePlaygroundCorrectLetters(value: unknown): string[] {
  if (value == null) return []

  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? "").trim().toUpperCase())
      .filter((part) => /^[A-E]$/.test(part))
  }

  if (typeof value === "object") {
    try {
      return parsePlaygroundCorrectLetters(Object.values(value as Record<string, unknown>))
    } catch {
      return []
    }
  }

  const str = String(value).trim()
  if (!str) return []

  const jsonArray = parseJsonArray(str)
  if (jsonArray) {
    return parsePlaygroundCorrectLetters(jsonArray)
  }

  if (/^[A-E]$/i.test(str)) return [str.toUpperCase()]

  if (str.includes(",")) {
    return str
      .split(",")
      .map((part) => part.trim().toUpperCase())
      .filter((part) => /^[A-E]$/.test(part))
  }

  return []
}

/** Coerce bank/API correct_answer values (string, number, array, JSON) to a trimmed string. */
export function normalizePlaygroundCorrectAnswer(value: unknown): string {
  const letters = parsePlaygroundCorrectLetters(value)
  if (letters.length > 1) return letters.join(",")
  if (letters.length === 1) return letters[0]!

  if (value == null) return ""

  if (typeof value === "object") {
    try {
      return JSON.stringify(value).trim()
    } catch {
      return ""
    }
  }

  return String(value).trim()
}

/** Resolve the option letter (A, B, …) for a playground question's correct answer. */
export function getPlaygroundCorrectOptionLetter(question: {
  options: string[]
  correctAnswer: unknown
}): string | null {
  const raw = normalizePlaygroundCorrectAnswer(question.correctAnswer)
  if (!raw) return null

  if (/^[A-E]$/i.test(raw)) {
    return raw.toUpperCase()
  }

  if (/^\d+$/.test(raw)) {
    const index = parseInt(raw, 10)
    if (index >= 0 && index < question.options.length) {
      return String.fromCharCode(65 + index)
    }
  }

  const normalized = raw.toLowerCase()
  const byText = question.options.findIndex(
    (opt) => String(opt ?? "").trim().toLowerCase() === normalized,
  )
  if (byText >= 0) {
    return String.fromCharCode(65 + byText)
  }

  // True/False stored as "True" / "False" while options may differ slightly
  if (normalized === "true") {
    const trueIdx = question.options.findIndex((o) => /^true$/i.test(String(o ?? "").trim()))
    if (trueIdx >= 0) return String.fromCharCode(65 + trueIdx)
  }
  if (normalized === "false") {
    const falseIdx = question.options.findIndex((o) => /^false$/i.test(String(o ?? "").trim()))
    if (falseIdx >= 0) return String.fromCharCode(65 + falseIdx)
  }

  return null
}

export function isPlaygroundTrueFalse(questionType?: string): boolean {
  const t = (questionType ?? "").toLowerCase()
  return t === "true_false" || t === "true/false" || t === "tf"
}

export function isPlaygroundSelectAll(questionType?: string): boolean {
  const t = (questionType ?? "").toLowerCase().replace(/[_-]/g, "")
  return t === "selectall" || t === "multipleselect" || t === "checkbox"
}
