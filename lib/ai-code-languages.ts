/**
 * Allowed values for quizzes.code_language and quiz_questions.ai_code_language.
 * Used by AI code grading prompts (evaluateCode).
 */

export const AI_CODE_LANGUAGE_OPTIONS = [
  { id: "cpp", label: "C++" },
  { id: "matlab", label: "MATLAB" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
  { id: "javascript", label: "JavaScript" },
  { id: "c", label: "C" },
] as const

export type AiCodeLanguageId = (typeof AI_CODE_LANGUAGE_OPTIONS)[number]["id"]

/** Sentinel stored in UI / legacy rows when an assessment has no AI code grading languages. */
export const AI_CODE_LANGUAGE_NONE = "none"

const ALLOWED = new Set<string>(AI_CODE_LANGUAGE_OPTIONS.map((o) => o.id))

/** Question types where per-question AI language applies (not code_write_plot — always MATLAB in grader). */
export const QUESTION_TYPES_WITH_PER_QUESTION_AI_LANGUAGE = new Set([
  "code_write",
  "code_problem",
  "debug_code",
  "code_debug",
  "code_explain",
])

export function normalizeAiCodeLanguage(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const s = String(raw).trim().toLowerCase()
  if (!s) return null
  if (s === "c++") return "cpp"
  return ALLOWED.has(s) ? s : null
}

/**
 * Effective language for AI grading: per-question override, else quiz default, else cpp.
 */
function languageIdToLabel(id: string): string {
  const row = AI_CODE_LANGUAGE_OPTIONS.find((o) => o.id === id)
  if (row) return row.label
  if (id === "c++") return "C++"
  return id
}

/** Parse quiz JSONB or client array into normalized unique ids (subset of ALLOWED). */
export function parseQuizAllowedLanguagesJson(raw: unknown): string[] {
  let arr: unknown[] = []
  if (Array.isArray(raw)) arr = raw
  else if (typeof raw === "string" && raw.trim()) {
    try {
      const p = JSON.parse(raw)
      if (Array.isArray(p)) arr = p
    } catch {
      /* ignore */
    }
  }
  const out: string[] = []
  const seen = new Set<string>()
  for (const x of arr) {
    const n = normalizeAiCodeLanguage(x == null ? null : String(x))
    if (n && !seen.has(n)) {
      seen.add(n)
      out.push(n)
    }
  }
  return out
}

/**
 * Ordered list of languages for AI grading.
 * Per-question override wins; else quiz `allowed_ai_code_languages`; else legacy `code_language`.
 */
export function resolveEvaluationLanguageList(opts: {
  questionAiCodeLanguage: string | null | undefined
  quizAllowedAiCodeLanguages: unknown
  quizFallbackCodeLanguage: string | null | undefined
}): string[] {
  const perQ = normalizeAiCodeLanguage(opts.questionAiCodeLanguage)
  if (perQ) return [perQ]

  const fromQuiz = parseQuizAllowedLanguagesJson(opts.quizAllowedAiCodeLanguages)
  if (fromQuiz.length > 0) return fromQuiz

  const fb = normalizeAiCodeLanguage(opts.quizFallbackCodeLanguage) || "cpp"
  return [fb]
}

export function formatLanguageListForPrompt(ids: string[]): string {
  return ids.map(languageIdToLabel).join(", ")
}

/** True when quiz-level AI code grading languages are explicitly disabled (None). */
export function isQuizAiCodeGradingEnabled(
  allowedRaw: unknown,
  codeLanguageFallback: string | null | undefined,
): boolean {
  if (Array.isArray(allowedRaw) && allowedRaw.length === 0) return false
  const parsed = parseQuizAllowedLanguagesJson(allowedRaw)
  if (parsed.length > 0) return true
  const fb = String(codeLanguageFallback ?? "").trim().toLowerCase()
  return fb !== "" && fb !== AI_CODE_LANGUAGE_NONE
}

/** Editor state: [] means None; otherwise ordered language ids. */
export function parseQuizAllowedLanguagesForEditor(
  allowedRaw: unknown,
  codeLanguageFallback: string | null | undefined,
): string[] {
  if (Array.isArray(allowedRaw) && allowedRaw.length === 0) return []
  const parsed = parseQuizAllowedLanguagesJson(allowedRaw)
  if (parsed.length > 0) return parsed
  const fb = String(codeLanguageFallback ?? "").trim().toLowerCase()
  if (!fb || fb === AI_CODE_LANGUAGE_NONE) return []
  const n = normalizeAiCodeLanguage(codeLanguageFallback)
  return n ? [n] : []
}

export function formatQuizDefaultLanguagesLabel(
  allowedRaw: unknown,
  codeLanguageFallback: string | null | undefined,
): string {
  const langs = parseQuizAllowedLanguagesForEditor(allowedRaw, codeLanguageFallback)
  if (langs.length === 0) return "None"
  return formatLanguageListForPrompt(langs)
}

/** Normalize client/API payload into an ordered list of allowed ids (empty = None). */
export function normalizeQuizAllowedLanguagesFromClient(
  rawAllowed: unknown,
  codeLanguageFallback: string | null | undefined,
): string[] {
  if (Array.isArray(rawAllowed) && rawAllowed.length === 0) return []
  const fromArray = parseQuizAllowedLanguagesJson(Array.isArray(rawAllowed) ? rawAllowed : null)
  if (fromArray.length > 0) return fromArray
  const fbRaw = String(codeLanguageFallback ?? "").trim().toLowerCase()
  if (!fbRaw || fbRaw === AI_CODE_LANGUAGE_NONE) return []
  const fb = normalizeAiCodeLanguage(codeLanguageFallback) || "cpp"
  return [fb]
}

export function resolveAiCodeLanguageForQuestion(
  questionAiCodeLanguage: string | null | undefined,
  quizCodeLanguage: string | null | undefined,
  quizAllowedAiCodeLanguages?: unknown,
): string {
  return resolveEvaluationLanguageList({
    questionAiCodeLanguage,
    quizAllowedAiCodeLanguages: quizAllowedAiCodeLanguages ?? null,
    quizFallbackCodeLanguage: quizCodeLanguage,
  })[0]
}

export function resolveEvaluationLanguagesArrayForQuestion(
  questionAiCodeLanguage: string | null | undefined,
  quizCodeLanguage: string | null | undefined,
  quizAllowedAiCodeLanguages?: unknown,
): string[] {
  return resolveEvaluationLanguageList({
    questionAiCodeLanguage,
    quizAllowedAiCodeLanguages: quizAllowedAiCodeLanguages ?? null,
    quizFallbackCodeLanguage: quizCodeLanguage,
  })
}
