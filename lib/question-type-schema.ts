/**
 * Canonical CourseCollab question schema normalization.
 * MCQ / T-F: options [{ id, text }], correct_answer = letter (A–F).
 * Select all: options [{ id, text }], correct_answers = exact option text values.
 */

import {
  normalizeCorrectAnswerToLetter,
  normalizeQuestionBankOptions,
  normalizeTrueFalseBankRow,
} from "@/lib/question-bank-normalize"

export type SchemaMcqOption = { id: string; text: string }

const LETTERS = ["A", "B", "C", "D", "E", "F"] as const

function optionIdForIndex(index: number): string {
  return LETTERS[index] ?? String(index + 1)
}

/**
 * Loose comparison key for matching a stored answer against an option's text.
 *
 * Only TRAILING sentence punctuation is dropped, so "Uses a flag." matches
 * "Uses a flag". Interior punctuation must be preserved: stripping it collapsed
 * code options that differ only by an operator — `if (n!=5)` and `if (n=5)` both
 * became `if (n=5)`, silently rewriting select_all keys to the wrong option.
 */
function normalizeComparableText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/, "")
}

function parseCorrectAnswerRaw(raw: unknown): string | string[] | null {
  if (raw == null || raw === "") return null
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean)
  if (typeof raw === "string") {
    const t = raw.trim()
    try {
      const p = JSON.parse(t)
      if (typeof p === "string") return p.trim()
      if (Array.isArray(p)) return p.map((x) => String(x).trim()).filter(Boolean)
    } catch {
      return t
    }
    return t
  }
  return String(raw).trim()
}

/** Normalize any stored options shape to schema `{ id, text }[]`. */
export function normalizeStructuredOptions(raw: unknown): SchemaMcqOption[] {
  if (raw == null || raw === "") return []

  if (typeof raw === "string") {
    const trimmed = raw.trim()
    if (!trimmed) return []
    try {
      return normalizeStructuredOptions(JSON.parse(trimmed))
    } catch {
      return trimmed
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((text, index) => ({ id: optionIdForIndex(index), text }))
    }
  }

  if (Array.isArray(raw)) {
    return raw
      .map((opt, index) => {
        if (typeof opt === "string") {
          const text = opt.trim()
          return text ? { id: optionIdForIndex(index), text } : null
        }
        if (opt && typeof opt === "object") {
          const o = opt as Record<string, unknown>
          const text = String(o.text ?? o.option_text ?? o.label ?? "").trim()
          if (!text) return null
          const id =
            String(o.id ?? optionIdForIndex(index))
              .trim()
              .toUpperCase() || optionIdForIndex(index)
          return { id, text }
        }
        const text = String(opt).trim()
        return text ? { id: optionIdForIndex(index), text } : null
      })
      .filter((opt): opt is SchemaMcqOption => opt != null)
  }

  if (typeof raw === "object") {
    const rec = raw as Record<string, unknown>
    return Object.keys(rec)
      .sort()
      .map((key) => {
        const text = String(rec[key] ?? "").trim()
        if (!text) return null
        return { id: key.trim().toUpperCase(), text }
      })
      .filter((opt): opt is SchemaMcqOption => opt != null)
  }

  return []
}

function canonicalizeSelectAllCorrectTexts(
  structured: SchemaMcqOption[],
  rawCorrect: unknown,
): string[] {
  const parsed = parseCorrectAnswerRaw(rawCorrect)
  if (parsed == null) return []
  const entries = Array.isArray(parsed) ? parsed : [parsed]
  return entries
    .map((entry) => {
      const trimmed = entry.trim()
      if (!trimmed) return ""
      if (/^[A-F]$/i.test(trimmed)) {
        const match = structured.find((o) => o.id.toUpperCase() === trimmed.toUpperCase())
        return match?.text ?? trimmed
      }
      const normalizedEntry = normalizeComparableText(trimmed)
      const byText = structured.find((o) => normalizeComparableText(o.text) === normalizedEntry)
      return byText?.text ?? trimmed
    })
    .filter(Boolean)
}

const OPTION_REQUIRED_TYPES = new Set(["mcq", "multiple_choice", "true_false", "select_all", "multi_output"])

/** Normalize question bank row before DB write. */
export function normalizeQuestionBankRowForStorage(input: {
  question_type: string
  options?: unknown
  correct_answer?: unknown
}): { options: SchemaMcqOption[]; correct_answer: string | string[] | null } {
  const type = input.question_type.toLowerCase()
  const structured = normalizeStructuredOptions(input.options)
  const optionTexts = structured.map((o) => o.text)

  if (type === "select_all" || type === "multi_output") {
    return {
      options: structured,
      correct_answer: canonicalizeSelectAllCorrectTexts(structured, input.correct_answer),
    }
  }

  if (type === "true_false") {
    const tf = normalizeTrueFalseBankRow(optionTexts.length >= 2 ? optionTexts : ["True", "False"], input.correct_answer)
    return {
      options: normalizeStructuredOptions(tf.options),
      correct_answer: tf.correct_answer,
    }
  }

  if (OPTION_REQUIRED_TYPES.has(type) || structured.length > 0) {
    const letter = normalizeCorrectAnswerToLetter(input.correct_answer, optionTexts, type)
    return { options: structured, correct_answer: letter }
  }

  const parsed = parseCorrectAnswerRaw(input.correct_answer)
  if (Array.isArray(parsed)) return { options: structured, correct_answer: parsed }
  return { options: structured, correct_answer: parsed }
}

/** Back-compat: option text list for quiz column mapping. */
export function structuredOptionsToTextList(options: SchemaMcqOption[]): string[] {
  return options.map((o) => o.text)
}

/** Resolve MCQ correct letter from structured options + stored answer (letter, index, or legacy text). */
export function resolveMcqCorrectLetterFromOptions(
  structured: SchemaMcqOption[],
  correctAnswer?: string | null,
): string | undefined {
  const ans = (correctAnswer ?? "").trim()
  if (!ans || structured.length === 0) return undefined

  const byLetter = structured.find((o) => o.id.toUpperCase() === ans.toUpperCase())
  if (byLetter) return byLetter.id.toUpperCase()

  const numeric = Number(ans)
  if (Number.isInteger(numeric) && numeric >= 0 && numeric < structured.length) {
    return structured[numeric].id.toUpperCase()
  }

  const normalizedAnswer = normalizeComparableText(ans)
  const byText = structured.find((o) => normalizeComparableText(o.text) === normalizedAnswer)
  if (byText) return byText.id.toUpperCase()

  return undefined
}

/** Canonicalize a sample-practice MCQ sub-question for storage and editor display. */
export function normalizeSamplePracticeMcqSubquestion(input: {
  type?: string
  options?: unknown
  correct_answer?: string | null
  correct_answers?: string[] | null
}): { options: SchemaMcqOption[]; correct_answer?: string; correct_answers?: string[] } {
  const structured = normalizeStructuredOptions(input.options)
  const type = (input.type ?? "mcq").toLowerCase()

  if (type === "select_all") {
    return {
      options: structured,
      correct_answers: canonicalizeSelectAllCorrectTexts(structured, input.correct_answers),
    }
  }

  const letter = resolveMcqCorrectLetterFromOptions(structured, input.correct_answer)
  return {
    options: structured,
    ...(letter ? { correct_answer: letter } : {}),
  }
}

/** Normalize legacy string[] bank options from reads. */
export function normalizeQuestionBankOptionsFromDb(raw: unknown): SchemaMcqOption[] {
  const texts = normalizeQuestionBankOptions(raw)
  return texts.map((text, index) => ({ id: optionIdForIndex(index), text }))
}

/** Convert admin/import `{ option_text, is_correct }[]` into canonical storage fields. */
export function normalizeImportOptionsForStorage(
  options: Array<{ option_text?: string; is_correct?: boolean }>,
  questionType: string,
): { options: SchemaMcqOption[]; correct_answer: string | string[] | null } {
  const filled = options.filter((o) => String(o.option_text ?? "").trim())
  const structured = filled.map((o, index) => ({
    id: optionIdForIndex(index),
    text: String(o.option_text).trim(),
  }))

  const type = questionType.toLowerCase()
  if (type === "select_all" || type === "multi_output") {
    const texts = filled.filter((o) => o.is_correct).map((o) => String(o.option_text).trim())
    return normalizeQuestionBankRowForStorage({
      question_type: type,
      options: structured,
      correct_answer: texts,
    })
  }

  const correctIdx = filled.findIndex((o) => o.is_correct)
  const letter = correctIdx >= 0 ? optionIdForIndex(correctIdx) : "A"
  return normalizeQuestionBankRowForStorage({
    question_type: type,
    options: structured,
    correct_answer: letter,
  })
}
