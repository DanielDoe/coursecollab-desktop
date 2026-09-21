import { sql } from "@/lib/db"
import { practiceAnswerReviewForEvaluateResponse, type PracticeAnswerReview } from "@/lib/practice-answer-review"
import { formatQuestionBankRowForRenderer } from "@/lib/resolve-quiz-question-from-bank"
import { normalizePracticeStudentAnswer } from "@/lib/save-practice-answer"

export type PracticePriorAnswer = {
  questionId: number
  studentAnswer: unknown
  isCorrect: boolean
  attemptId: number
  answeredAt: string | null
}

export async function getLatestPracticeAnswerForQuestion(
  studentDbId: number,
  questionId: number,
): Promise<PracticePriorAnswer | null> {
  const qid = Math.trunc(Number(questionId))
  if (!Number.isFinite(studentDbId) || studentDbId < 1 || !Number.isFinite(qid) || qid < 1) {
    return null
  }
  const [row] = await sql`
    SELECT
      pa.bank_question_id,
      pa.student_answer,
      pa.is_correct,
      pa.attempt_id,
      pa.answered_at
    FROM practice_answers pa
    JOIN practice_attempts pat ON pat.id = pa.attempt_id
    WHERE pat.student_id = ${studentDbId}
      AND pa.bank_question_id = ${qid}
    ORDER BY pa.answered_at DESC NULLS LAST, pa.id DESC
    LIMIT 1
  `
  if (!row) return null
  return {
    questionId: Number(row.bank_question_id),
    studentAnswer: normalizePracticeStudentAnswer(row.student_answer),
    isCorrect: Boolean(row.is_correct),
    attemptId: Number(row.attempt_id),
    answeredAt: row.answered_at ? String(row.answered_at) : null,
  }
}

export function buildPracticePriorReview(
  question: Record<string, unknown>,
  studentAnswer: unknown,
  isCorrect: boolean,
): PracticeAnswerReview | null {
  const formatted = formatQuestionBankRowForRenderer(question)
  if (!formatted) return null
  return practiceAnswerReviewForEvaluateResponse({
    question: { ...formatted, question_type: String(formatted.question_type ?? "") },
    studentAnswer: studentAnswer as string | string[],
    isCorrect,
  })
}

export function toSafePracticeQuestionPayload(
  formatted: Record<string, unknown> | null,
  extras: Record<string, unknown> = {},
) {
  if (!formatted) return null
  const {
    correct_answer: _correctAnswer,
    correctLetters: _correctLetters,
    correctTexts: _correctTexts,
    ...safe
  } = formatted as typeof formatted & {
    correctLetters?: unknown
    correctTexts?: unknown
  }
  return { ...safe, ...extras }
}

export async function listPracticedQuestionIds(studentDbId: number): Promise<number[]> {
  if (!Number.isFinite(studentDbId) || studentDbId < 1) return []
  const rows = await sql`
    SELECT DISTINCT pa.bank_question_id
    FROM practice_answers pa
    JOIN practice_attempts pat ON pat.id = pa.attempt_id
    WHERE pat.student_id = ${studentDbId}
      AND pa.bank_question_id IS NOT NULL
  `
  return rows.map((row) => Number(row.bank_question_id)).filter((id) => Number.isFinite(id) && id > 0)
}

export async function loadLatestPracticeAnswersForQuestionIds(
  studentDbId: number,
  questionIds: number[],
): Promise<
  Array<{
    questionId: number
    studentAnswer: unknown
    isCorrect: boolean
    question: Record<string, unknown>
    answerReview: PracticeAnswerReview | null
  }>
> {
  const ids = Array.from(new Set(questionIds.map((id) => Math.trunc(Number(id))).filter((id) => Number.isFinite(id) && id > 0)))
  if (!Number.isFinite(studentDbId) || studentDbId < 1 || ids.length === 0) return []

  const rows = await sql`
    SELECT DISTINCT ON (qb.id)
      qb.id, qb.question_text, qb.question_type, qb.hint, qb.difficulty, qb.topic, qb.options,
      qb.correct_answer, qb.question_media, qb.subquestions, qb.solution_upload_config, qb.explanation,
      pa.student_answer, pa.is_correct
    FROM question_bank qb
    JOIN practice_answers pa ON pa.bank_question_id = qb.id
    JOIN practice_attempts pat ON pat.id = pa.attempt_id
    WHERE pat.student_id = ${studentDbId}
      AND qb.id = ANY(${ids}::int[])
      AND qb.deleted_at IS NULL
    ORDER BY qb.id, pa.answered_at DESC NULLS LAST, pa.id DESC
  `

  return rows.map((row) => {
    const question = row as Record<string, unknown>
    const studentAnswer = normalizePracticeStudentAnswer(row.student_answer)
    const isCorrect = Boolean(row.is_correct)
    return {
      questionId: Number(row.id),
      studentAnswer,
      isCorrect,
      question,
      answerReview: buildPracticePriorReview(question, studentAnswer, isCorrect),
    }
  })
}

export async function loadPracticedQuestionsForTopics(opts: {
  studentDbId: number
  topics: string[]
  qbScope: unknown
}): Promise<
  Array<{
    question: Record<string, unknown>
    studentAnswer: unknown
    isCorrect: boolean
  }>
> {
  const { studentDbId, topics, qbScope } = opts
  if (!topics.length) return []
  const rows = await sql`
    SELECT DISTINCT ON (qb.id)
      qb.id, qb.question_text, qb.question_type, qb.hint, qb.difficulty, qb.topic, qb.options,
      qb.correct_answer, qb.question_media, qb.subquestions, qb.solution_upload_config, qb.explanation,
      pa.student_answer, pa.is_correct
    FROM question_bank qb
    JOIN practice_answers pa ON pa.bank_question_id = qb.id
    JOIN practice_attempts pat ON pat.id = pa.attempt_id
    WHERE pat.student_id = ${studentDbId}
      AND qb.topic = ANY(${topics})
      AND qb.deleted_at IS NULL
      AND (${qbScope})
    ORDER BY qb.id, pa.answered_at DESC NULLS LAST, pa.id DESC
  `
  return rows.map((row) => ({
    question: row as Record<string, unknown>,
    studentAnswer: normalizePracticeStudentAnswer(row.student_answer),
    isCorrect: Boolean(row.is_correct),
  }))
}
