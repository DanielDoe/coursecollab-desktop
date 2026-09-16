import { resolveQuestionBankTypeMeta, type CustomQuestionTypeDraft } from "@/lib/custom-question-types"
import {
  normalizeQuestionBankOptions,
  normalizeTrueFalseBankRow,
  normalizeCorrectAnswerToLetter,
} from "@/lib/question-bank-normalize"
import { normalizeQuestionBankRowForStorage } from "@/lib/question-type-schema"
import type { QuestionBankTypeId } from "@/lib/question-bank-type-config"
import type { QuestionBankAiDifficulty } from "@/lib/question-bank-ai-generation-spec"
import type { DraftQuestionBankItem } from "@/lib/question-bank-ai-from-pdf-types"

export type DraftPreviewData = {
  question_text: string
  question_type: string
  difficulty?: string | null
  topic?: string | null
  hint?: string | null
  explanation?: string | null
  sample_answer?: string | null
  evaluation_mode?: string | null
  options?: unknown
  correct_answer?: unknown
  subquestions?: unknown
}

export type DraftNormalizeContext = {
  questionType: QuestionBankTypeId | string
  difficulty: QuestionBankAiDifficulty
  topic: string
  includeHint: boolean
  includeExplanation: boolean
}

function createDraftId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function normalizeDraftFromRaw(
  raw: Record<string, unknown>,
  ctx: DraftNormalizeContext,
  customTypes: CustomQuestionTypeDraft[] = [],
): DraftQuestionBankItem {
  const meta = resolveQuestionBankTypeMeta(ctx.questionType, customTypes)
  const questionType = ctx.questionType as QuestionBankTypeId
  const questionText = String(raw.question_text ?? "").trim()
  let options = normalizeQuestionBankOptions(raw.options)
  let correctAnswer: string | string[] = String(raw.correct_answer ?? "A")

  if (questionType === "true_false") {
    const tf = normalizeTrueFalseBankRow(options, raw.correct_answer)
    options = tf.options
    correctAnswer = tf.correct_answer
  } else if (meta?.requiresOptions) {
    const normalized = normalizeQuestionBankRowForStorage({
      question_type: questionType,
      options: raw.options,
      correct_answer: raw.correct_answer,
    })
    options = normalized.options.map((o) => o.text)
    correctAnswer =
      questionType === "select_all"
        ? (normalized.correct_answer as string[])
        : String(normalized.correct_answer ?? "A")
  } else if (questionType === "fill_blank") {
    correctAnswer = normalizeCorrectAnswerToLetter(raw.correct_answer, options, "fill_blank")
  }

  const guidelinesRaw = raw.answer_guidelines
  const answerGuidelines = Array.isArray(guidelinesRaw)
    ? guidelinesRaw.map((g) => String(g)).filter(Boolean)
    : guidelinesRaw
      ? [String(guidelinesRaw)]
      : []

  return {
    draftId: createDraftId(),
    question_text: questionText,
    question_type: questionType,
    difficulty: ctx.difficulty,
    topic: ctx.topic.trim(),
    options,
    correct_answer: correctAnswer,
    hint: ctx.includeHint && raw.hint != null ? String(raw.hint) : null,
    explanation: ctx.includeExplanation && raw.explanation != null ? String(raw.explanation) : null,
    evaluation_mode: meta?.usesGradingGuidelines ? "auto" : "auto",
    answer_guidelines: answerGuidelines,
    sample_answer: raw.sample_answer != null ? String(raw.sample_answer) : null,
    subquestions: questionType === "multi_part" && Array.isArray(raw.subquestions) ? raw.subquestions : null,
    source_note: raw.source_note != null ? String(raw.source_note).slice(0, 300) : null,
  }
}

export function draftToPreviewData(draft: DraftQuestionBankItem): DraftPreviewData {
  return {
    question_text: draft.question_text,
    question_type: draft.question_type,
    difficulty: draft.difficulty,
    topic: draft.topic,
    hint: draft.hint,
    explanation: draft.explanation,
    sample_answer: draft.sample_answer,
    evaluation_mode: draft.evaluation_mode,
    options: draft.options,
    correct_answer: draft.correct_answer,
    subquestions: draft.subquestions,
  }
}

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) throw new Error("AI did not return valid JSON")
    return JSON.parse(match[0])
  }
}
