import { sql } from "@/lib/db"
import { getDefaultTimeLimit } from "@/lib/config/quizSettings"
import {
  questionHasCircuitDiagram,
  resolveObjectiveQuestionTimeLimitSeconds,
} from "@/lib/assessment-timer"
import {
  maxPointsForMultiPartQuestion,
  normalizeMultiPartSubquestionsForPolicy,
  parseUploadPointsMultiplier,
} from "@/lib/multi-part-grading-policy"
import {
  hasActiveQuestionMedia,
  parseQuestionMedia,
} from "@/lib/question-media"
import { contentFromBank } from "@/lib/quiz-question-bank-format"
import { normalizeQuizRowForEvaluation } from "@/lib/question-bank-normalize"

export {
  bankFormattedRowToVerifyPayload,
  formatQuestionBankRowForRenderer,
  type FormattedQuestionBankRow,
} from "@/lib/quiz-question-bank-format"

export type QuizQuestionRow = Record<string, unknown>

/** SQL fragment: join question_bank for live content resolution. */
export function quizQuestionBankJoin(tableAlias = "qq"): string {
  return `
  LEFT JOIN question_bank qb
    ON qb.id = ${tableAlias}.bank_question_id
    AND qb.deleted_at IS NULL
`
}

export const QUIZ_QUESTION_BANK_JOIN = quizQuestionBankJoin("qq")

/** SELECT columns from joined question_bank (alias qb). */
export const QUIZ_QUESTION_BANK_SELECT = `
  qb.question_text AS bank_question_text,
  qb.question_type AS bank_question_type,
  qb.options AS bank_options,
  qb.correct_answer AS bank_correct_answer,
  qb.hint AS bank_hint,
  qb.explanation AS bank_explanation,
  qb.evaluation_mode AS bank_evaluation_mode,
  qb.sample_answer AS bank_sample_answer,
  qb.expected_answer AS bank_expected_answer,
  qb.answer_guidelines AS bank_answer_guidelines,
  qb.question_media AS bank_question_media,
  qb.subquestions AS bank_subquestions,
  qb.solution_upload_config AS bank_solution_upload_config,
  qb.topic AS bank_topic,
  qb.difficulty AS bank_difficulty
`

function hasJoinedBankContent(row: QuizQuestionRow): boolean {
  if (!row.bank_question_id) return false
  return (
    row.bank_question_text != null ||
    row.bank_options != null ||
    row.bank_subquestions != null ||
    row.bank_correct_answer != null ||
    row.bank_question_media != null
  )
}

function bankRowFromJoin(row: QuizQuestionRow): Record<string, unknown> | null {
  const bankId = row.bank_question_id
  if (!bankId || !hasJoinedBankContent(row)) return null
  return {
    id: bankId,
    question_text: row.bank_question_text,
    question_type: row.bank_question_type,
    options: row.bank_options,
    correct_answer: row.bank_correct_answer,
    hint: row.bank_hint,
    explanation: row.bank_explanation,
    evaluation_mode: row.bank_evaluation_mode,
    sample_answer: row.bank_sample_answer,
    expected_answer: row.bank_expected_answer,
    answer_guidelines: row.bank_answer_guidelines,
    question_media: row.bank_question_media,
    subquestions: row.bank_subquestions,
    solution_upload_config: row.bank_solution_upload_config,
    topic: row.bank_topic,
    difficulty: row.bank_difficulty,
  }
}

/**
 * When `bank_question_id` is set, overlay live question-bank content onto the quiz row.
 * Assessment-specific fields (order, time limit, points overrides) stay on the quiz row.
 */
export function resolveQuizQuestionFromBank<T extends QuizQuestionRow>(row: T): T {
  if (!row?.bank_question_id) return normalizeQuizRowForEvaluation(row)

  const bank = bankRowFromJoin(row)
  if (!bank) return normalizeQuizRowForEvaluation(row)

  const fromBank = contentFromBank(bank)
  const bankDerivedMax = fromBank._bank_derived_max_points as number | undefined
  delete (fromBank as Record<string, unknown>)._bank_derived_max_points

  const quizPoints = row.points != null ? Number(row.points) : null
  const quizMaxPoints = row.max_points != null ? Number(row.max_points) : null
  const hasQuizPointsOverride =
    (quizPoints != null && quizPoints > 0 && quizPoints !== 1) ||
    (quizMaxPoints != null && quizMaxPoints > 0 && quizMaxPoints !== 1)

  const resolvedMaxPoints =
    hasQuizPointsOverride && quizMaxPoints != null
      ? quizMaxPoints
      : bankDerivedMax ?? quizMaxPoints ?? quizPoints ?? 1

  const resolvedPoints =
    hasQuizPointsOverride && quizPoints != null
      ? quizPoints
      : bankDerivedMax ?? quizPoints ?? quizMaxPoints ?? 1

  // Per-quiz media override: when the quiz_questions row carries its own active
  // media (e.g. an instructor cropped the diagram for this specific assessment),
  // keep it instead of letting the bank's figure overwrite it. Fall back to the
  // bank figure only when the quiz row has no media of its own.
  const quizOwnMedia = parseQuestionMedia(row.question_media)
  const resolvedMedia = hasActiveQuestionMedia(quizOwnMedia)
    ? quizOwnMedia
    : fromBank.question_media ?? null

  return normalizeQuizRowForEvaluation({
    ...row,
    ...fromBank,
    id: row.id,
    quiz_id: row.quiz_id,
    bank_question_id: row.bank_question_id,
    question_order: row.question_order,
    time_limit: row.time_limit ?? row.time_limit,
    points: resolvedPoints,
    max_points: resolvedMaxPoints,
    hint_penalty: row.hint_penalty,
    anti_cheat_exempt: row.anti_cheat_exempt,
    ai_code_language: row.ai_code_language,
    circuit_spec: row.circuit_spec ?? fromBank.circuit_spec,
    question_media: resolvedMedia,
  } as T)
}

export function resolveQuizQuestionsFromBank<T extends QuizQuestionRow>(rows: T[]): T[] {
  return rows.map((row) => resolveQuizQuestionFromBank(row))
}

/** Fetch one quiz_questions row with live bank overlay. */
export async function getQuizQuestionByIdResolved(questionId: number): Promise<QuizQuestionRow | null> {
  const rows = await sql`
    SELECT
      qq.*,
      ${sql.unsafe(QUIZ_QUESTION_BANK_SELECT)}
    FROM quiz_questions qq
    ${sql.unsafe(QUIZ_QUESTION_BANK_JOIN)}
    WHERE qq.id = ${questionId}
    LIMIT 1
  `
  if (rows.length === 0) return null
  return resolveQuizQuestionFromBank(rows[0] as QuizQuestionRow)
}

/** Fetch one quiz_questions row with quiz context + live bank overlay (for evaluate). */
export async function getQuizQuestionForEvaluateResolved(
  questionId: number,
): Promise<QuizQuestionRow | null> {
  const rows = await sql`
    SELECT
      qq.*,
      COALESCE(qq.max_points, qq.points, 1) as effective_max_points,
      quiz.assessment_type as quiz_assessment_type,
      COALESCE(NULLIF(TRIM(quiz.ai_evaluation_mode), ''),
        CASE
          WHEN LOWER(COALESCE(quiz.assessment_type, '')) IN ('homework', 'quiz') THEN 'relaxed'
          WHEN LOWER(COALESCE(quiz.assessment_type, '')) IN ('mid_semester', 'mid-semester') THEN 'strict'
          WHEN LOWER(COALESCE(quiz.assessment_type, '')) IN ('final', 'finals') THEN 'very_strict'
          ELSE 'standard'
        END
      ) as ai_evaluation_mode,
      COALESCE(quiz.ai_model, 'auto') as ai_model,
      quiz.ai_model_by_task,
      COALESCE(quiz.ai_enable_opus_fallback, false) as ai_enable_opus_fallback,
      COALESCE(quiz.ai_opus_confidence_threshold, 0.800) as ai_opus_confidence_threshold,
      COALESCE(NULLIF(TRIM(qq.ai_code_language), ''), NULLIF(TRIM(quiz.code_language), ''), 'cpp') as code_language,
      quiz.allowed_ai_code_languages,
      ${sql.unsafe(QUIZ_QUESTION_BANK_SELECT)}
    FROM quiz_questions qq
    JOIN quizzes quiz ON quiz.id = qq.quiz_id
    ${sql.unsafe(QUIZ_QUESTION_BANK_JOIN)}
    WHERE qq.id = ${questionId}
    LIMIT 1
  `
  if (rows.length === 0) return null
  return resolveQuizQuestionFromBank(rows[0] as QuizQuestionRow)
}

/** Minimal quiz_questions row when linking from question bank (content read live). */
export type MinimalBankLinkedQuizQuestion = {
  bank_question_id: number
  question_order: number
  time_limit: number | null
  question_type: string
  points?: number | null
  max_points?: number | null
}

export function minimalBankLinkedQuizQuestionFields(
  bankQuestion: Record<string, unknown>,
  opts: { questionOrder: number; timeLimit?: number | null; points?: number | null },
): MinimalBankLinkedQuizQuestion {
  const qType = String(bankQuestion.question_type || "mcq").toLowerCase()
  const hasDiagram = questionHasCircuitDiagram({
    question_media: bankQuestion.question_media,
    circuit_spec: bankQuestion.circuit_spec,
  })
  const objectiveTypes = new Set(["mcq", "true_false", "select_all", "multiple_choice", "multi_output"])
  let maxPoints: number | null = opts.points ?? null
  if (qType === "multi_part" && bankQuestion.subquestions != null) {
    const subs = normalizeMultiPartSubquestionsForPolicy(bankQuestion.subquestions)
    const cfg = bankQuestion.solution_upload_config
    let multiplier = 2
    if (cfg && typeof cfg === "object") {
      const c = cfg as Record<string, unknown>
      const gp = c.grading_policy as Record<string, unknown> | undefined
      multiplier = parseUploadPointsMultiplier(
        gp?.upload_points_multiplier ?? c.upload_points_multiplier,
      )
    }
    maxPoints = maxPoints ?? maxPointsForMultiPartQuestion(subs, multiplier)
  }

  return {
    bank_question_id: Number(bankQuestion.id),
    question_order: opts.questionOrder,
    time_limit:
      opts.timeLimit ??
      (objectiveTypes.has(qType)
        ? resolveObjectiveQuestionTimeLimitSeconds(qType, hasDiagram)
        : getDefaultTimeLimit(qType)),
    question_type: qType,
    points: maxPoints ?? 1,
    max_points: maxPoints ?? 1,
  }
}
