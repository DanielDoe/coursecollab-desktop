import {
  mapBankOptionsToQuizColumns,
  normalizeQuestionBankOptions,
  resolveQuizCorrectAnswerLetter,
} from "@/lib/question-bank-normalize"
import { parseQuestionMedia } from "@/lib/question-media"
import { solutionUploadConfigToJsonString } from "@/lib/solution-upload"
import {
  buildStandardSolutionUploadConfig,
  maxPointsForMultiPartQuestion,
  normalizeMultiPartSubquestionsForPolicy,
  parseUploadPointsMultiplier,
} from "@/lib/multi-part-grading-policy"

export type ImportedQuizQuestion = {
  question_text: string
  time_limit: number | null
  question_type: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  option_e: string
  correct_answer: string
  anti_cheat_exempt: boolean
  ai_code_language: string | null
  bank_question_id: number
  question_media?: unknown
  subquestions?: unknown
  solution_upload_config?: unknown
  max_points?: number | null
  points?: number | null
}

/** Map a question_bank row into a quiz_questions draft for edit/save flows. */
export function convertBankQuestionToQuizQuestion(
  bankQuestion: Record<string, unknown>,
  _opts?: { assessmentType?: string },
): ImportedQuizQuestion {
  const qType = String(bankQuestion.question_type || "mcq").toLowerCase()
  const isMultiPart = qType === "multi_part"

  const optionTexts = normalizeQuestionBankOptions(bankQuestion.options)
  const columns = isMultiPart
    ? { option_a: "", option_b: "", option_c: "", option_d: "", option_e: "" }
    : mapBankOptionsToQuizColumns(optionTexts)

  let correctAnswer = ""
  if (!isMultiPart) {
    const letter = resolveQuizCorrectAnswerLetter(
      bankQuestion.correct_answer,
      optionTexts,
      qType,
    )
    correctAnswer = Array.isArray(bankQuestion.correct_answer)
      ? JSON.stringify(bankQuestion.correct_answer)
      : letter || String(bankQuestion.correct_answer ?? "")
  }

  const media = parseQuestionMedia(bankQuestion.question_media)
  let subquestions: unknown = bankQuestion.subquestions ?? null
  let solutionConfig: unknown = bankQuestion.solution_upload_config ?? null
  let maxPoints: number | null = null

  if (isMultiPart && subquestions != null) {
    subquestions = normalizeMultiPartSubquestionsForPolicy(subquestions)
    const cfg = bankQuestion.solution_upload_config
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
    solutionConfig = buildStandardSolutionUploadConfig({
      uploadPointsMultiplier: multiplier,
      partCount: normalizeMultiPartSubquestionsForPolicy(subquestions).length,
    })
    maxPoints = maxPointsForMultiPartQuestion(subquestions, multiplier)
  }

  const defaultTimeLimits: Record<string, number> = {
    true_false: 30,
    mcq: 50,
    select_all: 60,
    multi_part: 300,
    circuit_submission: 900,
  }

  const bankPoints =
    typeof bankQuestion.points === "number" && Number.isFinite(bankQuestion.points)
      ? Number(bankQuestion.points)
      : qType === "circuit_submission"
        ? 10
        : maxPoints

  return {
    question_text: String(bankQuestion.question_text || ""),
    time_limit: defaultTimeLimits[qType] ?? 60,
    question_type: qType,
    option_a: columns.option_a ?? "",
    option_b: columns.option_b ?? "",
    option_c: columns.option_c ?? "",
    option_d: columns.option_d ?? "",
    option_e: columns.option_e ?? "",
    correct_answer: correctAnswer,
    anti_cheat_exempt: false,
    ai_code_language: null,
    bank_question_id: Number(bankQuestion.id),
    question_media: media ?? undefined,
    subquestions: subquestions ?? undefined,
    solution_upload_config:
      solutionConfig != null
        ? typeof solutionConfig === "string"
          ? JSON.parse(solutionConfig)
          : solutionConfig
        : undefined,
    max_points: bankPoints ?? maxPoints,
    points: bankPoints ?? maxPoints,
  }
}

export function serializeSolutionUploadConfigForSave(raw: unknown): string | null {
  if (raw == null) return null
  return solutionUploadConfigToJsonString(raw)
}
