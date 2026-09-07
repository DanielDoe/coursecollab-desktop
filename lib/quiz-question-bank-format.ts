/**
 * Client-safe question bank → quiz column formatting (no DB imports).
 * Shared by quiz taker, practice hub, and sample practice.
 */

import {
  mapBankOptionsToQuizColumns,
  normalizeQuestionBankOptions,
  resolveQuizCorrectAnswerLetter,
} from "@/lib/question-bank-normalize"
import {
  buildStandardSolutionUploadConfig,
  mergeBankGuidedSettingsIntoSolutionConfig,
  maxPointsForMultiPartQuestion,
  normalizeMultiPartSubquestionsForPolicy,
  parseUploadPointsMultiplier,
} from "@/lib/multi-part-grading-policy"
import {
  hasActiveQuestionMedia,
  resolveQuestionMedia,
} from "@/lib/question-media"

export type QuizQuestionContentRow = Record<string, unknown>

/** Normalize a question_bank row into quiz column fields (option_a…e, correct_answer). */
export function contentFromBank(bank: Record<string, unknown>): Partial<QuizQuestionContentRow> {
  const qType = String(bank.question_type || "mcq").toLowerCase()
  const isMultiPart = qType === "multi_part"

  const optionTexts = normalizeQuestionBankOptions(bank.options)
  const columns = isMultiPart
    ? { option_a: null, option_b: null, option_c: null, option_d: null, option_e: null }
    : mapBankOptionsToQuizColumns(optionTexts)

  let correctAnswer: string | null = null
  if (!isMultiPart) {
    const letter = resolveQuizCorrectAnswerLetter(bank.correct_answer, optionTexts, qType)
    correctAnswer = letter || String(bank.correct_answer ?? "")
  }

  let subquestions: unknown = bank.subquestions ?? null
  let solutionConfig: unknown = bank.solution_upload_config ?? null
  let derivedMaxPoints: number | null = null

  if (isMultiPart && subquestions != null) {
    subquestions = normalizeMultiPartSubquestionsForPolicy(subquestions)
    const cfg = bank.solution_upload_config
    let multiplier = 2
    if (cfg && typeof cfg === "object") {
      const c = cfg as Record<string, unknown>
      const gp = c.grading_policy as Record<string, unknown> | undefined
      multiplier = parseUploadPointsMultiplier(
        gp?.upload_points_multiplier ?? c.upload_points_multiplier,
      )
    } else if (typeof cfg === "string") {
      try {
        const parsed = JSON.parse(cfg) as Record<string, unknown>
        const gp = parsed.grading_policy as Record<string, unknown> | undefined
        multiplier = parseUploadPointsMultiplier(
          gp?.upload_points_multiplier ?? parsed.upload_points_multiplier,
        )
      } catch {
        /* default */
      }
    }
    solutionConfig = mergeBankGuidedSettingsIntoSolutionConfig(
      bank.solution_upload_config,
      buildStandardSolutionUploadConfig({
        uploadPointsMultiplier: multiplier,
        partCount: normalizeMultiPartSubquestionsForPolicy(subquestions).length,
      }),
    )
    derivedMaxPoints = maxPointsForMultiPartQuestion(subquestions, multiplier)
  }

  const media = resolveQuestionMedia({
    question_media: bank.question_media,
    circuit_spec: bank.circuit_spec,
  })

  return {
    question_text: String(bank.question_text || ""),
    question_type: qType,
    option_a: columns.option_a,
    option_b: columns.option_b,
    option_c: columns.option_c,
    option_d: columns.option_d,
    option_e: columns.option_e,
    correct_answer: correctAnswer,
    hint: bank.hint ?? null,
    explanation: bank.explanation ?? null,
    evaluation_mode: bank.evaluation_mode ?? null,
    sample_answer: bank.sample_answer ?? null,
    expected_answer: bank.expected_answer ?? null,
    answer_guidelines: bank.answer_guidelines ?? null,
    question_media: media ?? null,
    circuit_spec: bank.circuit_spec ?? null,
    subquestions: subquestions ?? null,
    solution_upload_config: solutionConfig ?? null,
    topic: bank.topic ?? null,
    difficulty: bank.difficulty ?? null,
    bank_question_media: bank.question_media ?? null,
    ...(derivedMaxPoints != null ? { _bank_derived_max_points: derivedMaxPoints } : {}),
  }
}

/** Format a question_bank row for QuestionRenderer (practice hub, previews, sample practice). */
export function formatQuestionBankRowForRenderer(row: Record<string, unknown>) {
  if (!row?.id) return null

  const fromBank = contentFromBank(row)
  const media = resolveQuestionMedia({
    question_media: fromBank.question_media,
    circuit_spec: row.circuit_spec ?? fromBank.circuit_spec,
    bank_question_media: row.question_media,
  })

  return {
    id: Number(row.id),
    question_text: fromBank.question_text,
    question_type: fromBank.question_type,
    option_a: fromBank.option_a ?? "",
    option_b: fromBank.option_b ?? "",
    option_c: fromBank.option_c ?? "",
    option_d: fromBank.option_d ?? "",
    option_e: fromBank.option_e ?? "",
    correct_answer: fromBank.correct_answer ?? "",
    hint: fromBank.hint ?? null,
    difficulty: row.difficulty ?? fromBank.difficulty,
    topic: row.topic ?? fromBank.topic,
    question_media: hasActiveQuestionMedia(media)
      ? { ...media, media_enabled: true }
      : (fromBank.question_media ?? null),
    subquestions: fromBank.subquestions ?? null,
    solution_upload_config: fromBank.solution_upload_config ?? null,
  }
}

export type FormattedQuestionBankRow = NonNullable<ReturnType<typeof formatQuestionBankRowForRenderer>>

/** Build verifyAnswerLocally payload from a formatted question_bank row. */
export function bankFormattedRowToVerifyPayload(formatted: FormattedQuestionBankRow) {
  return {
    correctAnswer: formatted.correct_answer,
    options: {
      A: formatted.option_a || null,
      B: formatted.option_b || null,
      C: formatted.option_c || null,
      D: formatted.option_d || null,
      E: formatted.option_e || null,
    },
  }
}
