/**
 * Code answer validation - detects corrupt/wrong data that should not be stored
 * for code questions. Used to prevent MCQ/select_all/true_false answers from
 * overwriting student code due to bugs, race conditions, or answer matching errors.
 */

/** Patterns that indicate data from non-code question types (corrupt for code) */
const CORRUPT_PATTERNS = {
  /** Single letter MCQ choice A-E */
  singleLetterMcq: /^[A-Ea-e]$/,
  /** Boolean from true_false */
  boolean: /^(true|false)$/i,
  /** Single digit or short numeric (MCQ option index, etc.) */
  singleNumeric: /^[0-9]{1,3}$/,
  /** String "null" or "undefined" */
  stringNull: /^(null|undefined)$/i,
  /** Quoted letter e.g. "A" */
  quotedLetter: /^"[A-Ea-e]"$/,
  /** JSON array - select_all answer e.g. ["A"], ["A","B"] */
  jsonArray: /^\[[\s\S]*\]$/,
}

/** Code-like patterns - if present, likely valid code even if short */
const CODE_LIKE_PATTERNS = [
  /\n/,           // newline
  /\s*=\s*/,      // assignment
  /\b(print|return|def|class|if|for|while|else|elif)\b/i,
  /\b(int|void|main|cout|cin|std::|#include)\b/i,
  /[{}]/,         // braces
  /\([^)]*\)/,    // function call
  /#/,            // comment
  /\/\//,         // line comment
  /\/\*/,         // block comment
]

/**
 * Returns true if the value looks like corrupt/wrong data for a code question.
 * Used to avoid overwriting good code with MCQ/select_all/true_false answers.
 *
 * Edge cases covered:
 * - Single letter A-E (MCQ)
 * - true/false (true_false)
 * - Single digit or short numeric
 * - JSON arrays ["A"], ["A","B"] (select_all)
 * - "null", "undefined" as strings
 * - Quoted letter "A"
 * - Short text that doesn't look like code (< 25 chars, no code patterns)
 * - Empty, null, whitespace-only
 *
 * Short valid code (e.g. "x=1", "print(1)") is NOT treated as corrupt
 * if it contains code-like patterns.
 */
export function isCodeAnswerCorrupt(value: unknown): boolean {
  if (value == null) return true
  const s = typeof value === "string" ? value : String(value)
  const trimmed = s.trim()
  if (!trimmed) return true

  // Clearly from other question types
  if (CORRUPT_PATTERNS.singleLetterMcq.test(trimmed)) return true
  if (CORRUPT_PATTERNS.boolean.test(trimmed)) return true
  if (CORRUPT_PATTERNS.singleNumeric.test(trimmed)) return true
  if (CORRUPT_PATTERNS.stringNull.test(trimmed)) return true
  if (CORRUPT_PATTERNS.quotedLetter.test(trimmed)) return true

  // JSON array (select_all)
  if (CORRUPT_PATTERNS.jsonArray.test(trimmed)) {
    try {
      const arr = JSON.parse(trimmed)
      if (Array.isArray(arr)) return true
    } catch {
      /* not valid JSON, continue */
    }
  }

  // Object that looks like answer wrapper with wrong content
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed)
      if (obj && typeof obj === "object") {
        const inner = obj.answer ?? obj.code
        if (inner != null && isCodeAnswerCorrupt(inner)) return true
        // If it's just {code: "A"} or similar, corrupt
        if (typeof inner === "string" && isCodeAnswerCorrupt(inner)) return true
      }
    } catch {
      /* not valid JSON */
    }
  }

  // Short string: corrupt only if it doesn't look like code
  if (trimmed.length < 25) {
    const looksLikeCode = CODE_LIKE_PATTERNS.some((p) => p.test(trimmed))
    if (!looksLikeCode) return true
  }

  return false
}

/**
 * Extract code string from various answer formats for validation.
 * Handles: raw string, {code: "..."}, {answer: "..."}, JSON string, Array (returns stringified for corrupt check).
 */
export function extractCodeForValidation(
  answer: unknown,
  questionType?: string
): string | null {
  if (answer == null) return null
  if (Array.isArray(answer)) {
    return JSON.stringify(answer) // select_all format - will be corrupt for code
  }
  if (typeof answer === "string") {
    if (answer.startsWith("{")) {
      try {
        const p = JSON.parse(answer)
        const inner = p?.code ?? p?.answer ?? answer
        return typeof inner === "string" ? inner : JSON.stringify(inner)
      } catch {
        return answer
      }
    }
    return answer
  }
  if (typeof answer === "object" && answer !== null) {
    const o = answer as Record<string, unknown>
    if (questionType === "code_write_plot" && o.code) {
      return typeof o.code === "string" ? o.code : JSON.stringify(o.code)
    }
    const inner = o.code ?? o.answer
    return inner != null ? (typeof inner === "string" ? inner : JSON.stringify(inner)) : null
  }
  return String(answer)
}
