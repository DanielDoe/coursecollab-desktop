/**
 * In-lecture sample practice — simple MCQ / T-F / select-all drills on slide decks.
 * Canonical shape matches question bank MCQ schema (not multi_part).
 */

import { markdownLatexExplanationToMarkdown } from "@/lib/markdown-latex-explanation"
import { parseQuestionMedia, type QuestionMedia } from "@/lib/question-media"
import {
  normalizeSamplePracticeMcqSubquestion,
  normalizeStructuredOptions,
  type SchemaMcqOption,
} from "@/lib/question-type-schema"
import { verifyAnswerLocally } from "@/lib/local-answer-verification"
import { parseSubquestions, subquestionOptionLabels, type MultiPartSubQuestion } from "@/lib/multi-part-question"
import type { PracticeAnswerReview } from "@/lib/practice-answer-review"
import {
  samplePracticeAnswerReview,
  samplePracticeQuestionToVerifyPayload,
} from "@/lib/sample-practice-quiz-adapter"

export type SamplePracticeQuestionType = "mcq" | "true_false" | "select_all"

export type LectureSamplePracticeQuestion = {
  id: string
  title: string
  topic?: string
  difficulty?: string
  points?: number
  question_type: SamplePracticeQuestionType
  question_text: string
  options: SchemaMcqOption[]
  correct_answer?: string
  correct_answers?: string[]
  explanation?: string
  question_media?: QuestionMedia
  solution_upload_config?: { enabled: false; require_solution_upload: false }
}

export type LectureSamplePracticeConfig = {
  enabled: boolean
  button_label?: string
  questions: LectureSamplePracticeQuestion[]
}

export type LectureSamplePracticeEvaluateResult = {
  question_id: string
  is_mcq_correct: boolean
  mcq_earned_fraction: number
  parts: Array<{
    id: string
    prompt: string
    selected: string | string[] | null
    correct_answer: string | string[] | null
    is_correct: boolean
    explanation?: string
    options?: Array<{ letter: string; text: string }>
  }>
  has_upload: boolean
  upload_acknowledged: boolean
  explanation?: string
  /** Same review payload as practice hub / quiz taker objective feedback. */
  answerReview?: PracticeAnswerReview | null
}

const DEFAULT_BUTTON_LABEL = "Sample Practice"

function normalizeComparableText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ")
}

function isGenericLegacyPartPrompt(prompt: string, type?: string): boolean {
  const p = normalizeComparableText(prompt)
  if (!p) return true
  const t = (type ?? "").toLowerCase()
  if (t === "select_all" && p.startsWith("select all")) return true
  if (t === "true_false" && (p.includes("true or false") || p.includes("above statement"))) {
    return true
  }
  return false
}

/** Merge legacy stem + sub-question prompt into one question_text when they differ. */
function mergeStemAndPartPrompt(stem: string, sq: MultiPartSubQuestion): string {
  const base = stem.trim()
  const prompt = sq.prompt.trim()
  if (!prompt || normalizeComparableText(prompt) === normalizeComparableText(base)) return base
  if (isGenericLegacyPartPrompt(prompt, sq.type)) return base
  if (!base) return prompt
  return `${base}\n\n${prompt}`
}

function inferQuestionType(raw: Record<string, unknown>, sq?: MultiPartSubQuestion): SamplePracticeQuestionType {
  const explicit = String(raw.question_type ?? "").toLowerCase()
  if (explicit === "true_false") return "true_false"
  if (explicit === "select_all") return "select_all"
  if (sq?.type === "select_all") return "select_all"
  if (sq?.type === "true_false") return "true_false"
  return "mcq"
}

function flattenLegacySubquestion(
  stem: string,
  sq: MultiPartSubQuestion,
  questionType: SamplePracticeQuestionType,
): Pick<
  LectureSamplePracticeQuestion,
  "question_text" | "options" | "correct_answer" | "correct_answers" | "explanation"
> {
  const normalized = normalizeSamplePracticeMcqSubquestion({
    type: questionType,
    options: sq.options,
    correct_answer: sq.correct_answer,
    correct_answers: sq.correct_answers,
  })
  const explanation = markdownLatexExplanationToMarkdown(sq.explanation) ?? sq.explanation
  return {
    question_text: mergeStemAndPartPrompt(stem, sq),
    options: normalized.options,
    correct_answer: normalized.correct_answer,
    correct_answers: normalized.correct_answers,
    explanation,
  }
}

/** Parse student answer — supports letter string or legacy `{ parts: { a: "B" } }`. */
export function parseSamplePracticeStudentAnswer(raw: unknown): string | string[] {
  if (raw == null) return ""
  if (typeof raw === "string") {
    const t = raw.trim()
    if (t.startsWith("{") || t.startsWith("[")) {
      try {
        return parseSamplePracticeStudentAnswer(JSON.parse(t))
      } catch {
        return t
      }
    }
    return t
  }
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean)
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>
    if (o.parts && typeof o.parts === "object") {
      const parts = o.parts as Record<string, unknown>
      const first = parts.a ?? parts.A ?? Object.values(parts)[0]
      if (Array.isArray(first)) return first.map((x) => String(x).trim()).filter(Boolean)
      if (typeof first === "string") return first.trim()
    }
    if (typeof o.answer === "string") return o.answer.trim()
  }
  return String(raw).trim()
}

export function defaultLectureSamplePracticeConfig(): LectureSamplePracticeConfig {
  return { enabled: false, button_label: DEFAULT_BUTTON_LABEL, questions: [] }
}

export function emptySamplePracticeQuestion(index: number): LectureSamplePracticeQuestion {
  return {
    id: `new-${Date.now()}-${index}`,
    title: `Practical Example ${index + 1}`,
    topic: "",
    difficulty: "easy",
    points: 1,
    question_type: "mcq",
    question_text: "",
    options: [
      { id: "A", text: "Option A" },
      { id: "B", text: "Option B" },
      { id: "C", text: "Option C" },
      { id: "D", text: "Option D" },
    ],
    correct_answer: "A",
    explanation: "",
    solution_upload_config: { enabled: false, require_solution_upload: false },
  }
}

export function parseLectureSamplePractice(raw: unknown): LectureSamplePracticeConfig {
  if (!raw || typeof raw !== "object") return defaultLectureSamplePracticeConfig()
  const o = raw as Record<string, unknown>
  const questionsRaw = Array.isArray(o.questions) ? o.questions : []
  const questions = questionsRaw
    .map((q, idx) => normalizeSamplePracticeQuestion(q, idx))
    .filter((q): q is LectureSamplePracticeQuestion => q != null)

  const enabledRaw = o.enabled
  const enabled =
    enabledRaw === false || enabledRaw === 0
      ? false
      : questions.length > 0 || enabledRaw === true

  return {
    enabled,
    button_label:
      typeof o.button_label === "string" && o.button_label.trim()
        ? o.button_label.trim()
        : DEFAULT_BUTTON_LABEL,
    questions,
  }
}

/** Normalize to flat MCQ schema; legacy subquestions are flattened on read. */
export function normalizeSamplePracticeQuestion(
  raw: unknown,
  fallbackIndex = 0,
): LectureSamplePracticeQuestion | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const id =
    typeof o.id === "string" && o.id.trim() ? o.id.trim() : `q${fallbackIndex + 1}`
  const title = String(o.title ?? o.question_text ?? `Question ${fallbackIndex + 1}`).trim()
  const stem = String(o.question_text ?? title).trim()

  const questionMedia = parseQuestionMedia(o.question_media)
  const hasMedia = Boolean((questionMedia.media_url || "").trim())

  const flatOptions = normalizeStructuredOptions(o.options)
  const hasFlatOptions = flatOptions.length >= 2

  if (hasFlatOptions) {
    const questionType = inferQuestionType(o)
    const normalized = normalizeSamplePracticeMcqSubquestion({
      type: questionType,
      options: flatOptions,
      correct_answer: o.correct_answer,
      correct_answers: o.correct_answers,
    })
    const explanation =
      markdownLatexExplanationToMarkdown(o.explanation) ??
      (typeof o.explanation === "string" ? o.explanation : undefined)
    const question_text = stem || title
    if (!question_text) return null
    return {
      id,
      title,
      topic: typeof o.topic === "string" ? o.topic : undefined,
      difficulty: typeof o.difficulty === "string" ? o.difficulty : undefined,
      points: typeof o.points === "number" ? o.points : Number(o.points) || undefined,
      question_type: questionType,
      question_text,
      options: normalized.options,
      correct_answer: normalized.correct_answer,
      correct_answers: normalized.correct_answers,
      explanation,
      question_media: hasMedia ? questionMedia : undefined,
      solution_upload_config: { enabled: false, require_solution_upload: false },
    }
  }

  const subsRaw = o.subquestions ?? o.sub_questions
  const allSubs = parseSubquestions(subsRaw).filter((sq) => {
    const t = sq.type.toLowerCase()
    return t !== "file_upload" && t !== "solution_upload"
  })

  if (allSubs.length === 0) return null

  const sq = allSubs[0]
  const questionType = inferQuestionType(o, sq)
  const flat = flattenLegacySubquestion(stem || title, sq, questionType)
  if (!flat.question_text.trim()) return null

  return {
    id,
    title,
    topic: typeof o.topic === "string" ? o.topic : undefined,
    difficulty: typeof o.difficulty === "string" ? o.difficulty : undefined,
    points: typeof o.points === "number" ? o.points : Number(o.points) || sq.points || 1,
    question_type: questionType,
    question_text: flat.question_text,
    options: flat.options,
    correct_answer: flat.correct_answer,
    correct_answers: flat.correct_answers,
    explanation: flat.explanation,
    question_media: hasMedia ? questionMedia : undefined,
    solution_upload_config: { enabled: false, require_solution_upload: false },
  }
}

export function stripSamplePracticeAnswers(
  config: LectureSamplePracticeConfig,
): LectureSamplePracticeConfig {
  return {
    ...config,
    questions: config.questions.map((q) => {
      const { correct_answer, correct_answers, explanation, ...rest } = q
      return rest as LectureSamplePracticeQuestion
    }),
  }
}

export function evaluateSamplePracticeQuestion(
  question: LectureSamplePracticeQuestion,
  answerRaw: unknown,
): LectureSamplePracticeEvaluateResult {
  const selected = parseSamplePracticeStudentAnswer(answerRaw)
  const type = question.question_type
  const questionData = samplePracticeQuestionToVerifyPayload(question)
  const verified = verifyAnswerLocally(type, selected, questionData)
  const isCorrect = verified.isCorrect
  const labels = question.options.map((o) => ({ letter: o.id.toUpperCase(), text: o.text }))

  const correctDisplay =
    type === "select_all"
      ? (question.correct_answers ?? null)
      : (() => {
          const letter = String(question.correct_answer ?? "").toUpperCase()
          const match = labels.find((l) => l.letter === letter)
          return match ? match.text : question.correct_answer ?? null
        })()

  const answerReview = samplePracticeAnswerReview({
    question,
    studentAnswer: selected,
    isCorrect,
    correctTexts:
      type === "select_all" && Array.isArray(correctDisplay)
        ? correctDisplay
        : undefined,
  })

  return {
    question_id: question.id,
    is_mcq_correct: isCorrect,
    mcq_earned_fraction: parseFloat((verified.score / 100).toFixed(4)),
    parts: [
      {
        id: "a",
        prompt: question.question_text,
        selected: selected || null,
        correct_answer: correctDisplay,
        is_correct: isCorrect,
        explanation: question.explanation,
        options: labels,
      },
    ],
    has_upload: false,
    upload_acknowledged: false,
    explanation: question.explanation,
    answerReview,
  }
}

/** Persist only flat MCQ fields (no subquestions). */
export function serializeSamplePracticeForStorage(
  config: LectureSamplePracticeConfig,
): LectureSamplePracticeConfig {
  const parsed = parseLectureSamplePractice(config)
  return {
    ...parsed,
    enabled: parsed.questions.length > 0 ? parsed.enabled : false,
  }
}

/** @deprecated Legacy helper — sample practice no longer uses subquestions. */
export function samplePracticePromptDiffersFromStem(): boolean {
  return false
}

/** @deprecated Legacy helper — sample practice no longer uses subquestions. */
export function syncSamplePracticeQuestionPrompts(
  question: LectureSamplePracticeQuestion,
): LectureSamplePracticeQuestion {
  return question
}

/** @deprecated Legacy helper — sample practice no longer uses subquestions. */
export function isGenericSamplePracticePartPrompt(): boolean {
  return false
}
