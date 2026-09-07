/**
 * Schema repair for course exchange **initial import (clone) only**.
 *
 * Course Exchange is a one-way fork: destination instructors own their copy.
 * These helpers normalize legacy MCQ shapes when material first lands in the
 * destination course. They never write to the source/creator course.
 *
 * Faculty edits on the destination copy are left untouched until the instructor
 * explicitly applies a creator update in Course Exchange sync — sync copies
 * creator content as-is and does not call these helpers.
 *
 * One-time global backfill (`scripts/normalize-question-bank-all-courses.ts`) covers
 * courses already shared before these fixes existed.
 */

import { sql } from "@/lib/db"
import {
  parseLectureSamplePractice,
  serializeSamplePracticeForStorage,
} from "@/lib/lecture-sample-practice"
import { normalizeQuizQuestionCorrectAnswerForSave } from "@/lib/question-bank-normalize"
import {
  convertBankQuestionToQuizQuestion,
  serializeSolutionUploadConfigForSave,
} from "@/lib/quiz-bank-question-import"

const OPTION_QUIZ_TYPES = new Set([
  "mcq",
  "multiple_choice",
  "true_false",
  "select_all",
  "multi_output",
])

/** Pure helper — flatten legacy sample practice JSON to canonical flat MCQ shape. */
export function normalizeSamplePracticeRawForStorage(raw: unknown): unknown | null {
  if (raw == null) return null
  const parsed = parseLectureSamplePractice(raw)
  if (!parsed.enabled && parsed.questions.length === 0) return null
  return serializeSamplePracticeForStorage(parsed)
}

/** Re-normalize lectures.sample_practice after course exchange clone (destination course only). */
export async function persistNormalizedSamplePracticeForLecture(
  lectureId: number,
  destinationCourseId: number,
): Promise<boolean> {
  const rows = await sql`
    SELECT sample_practice
    FROM lectures
    WHERE id = ${lectureId}
      AND course_id = ${destinationCourseId}
      AND deleted_at IS NULL
    LIMIT 1
  `
  if (rows.length === 0) return false

  const raw = (rows[0] as { sample_practice: unknown }).sample_practice
  const normalized = normalizeSamplePracticeRawForStorage(raw)
  if (normalized == null) return false

  const changed = JSON.stringify(normalized) !== JSON.stringify(raw)
  if (!changed) return false

  await sql`
    UPDATE lectures
    SET sample_practice = ${JSON.stringify(normalized)}::jsonb,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${lectureId}
      AND course_id = ${destinationCourseId}
  `
  return true
}

type QuizQuestionRow = {
  id: number
  bank_question_id: number | null
  question_type: string
  option_a: string | null
  option_b: string | null
  option_c: string | null
  option_d: string | null
  option_e: string | null
  correct_answer: string | null
}

type BankRow = {
  id: number
  question_text: string
  question_type: string
  options: unknown
  correct_answer: unknown
  question_media: unknown
  subquestions: unknown
  solution_upload_config: unknown
  points: unknown
}

async function refreshQuizQuestionSnapshotFromBank(
  qq: QuizQuestionRow,
  bank: BankRow,
): Promise<boolean> {
  const draft = convertBankQuestionToQuizQuestion(bank as Record<string, unknown>)
  const qType = draft.question_type.toLowerCase()
  const solutionConfig = serializeSolutionUploadConfigForSave(draft.solution_upload_config)

  if (qType === "multi_part") {
    const subquestionsJson =
      draft.subquestions != null ? JSON.stringify(draft.subquestions) : null
    await sql`
      UPDATE quiz_questions
      SET
        option_a = ${draft.option_a},
        option_b = ${draft.option_b},
        option_c = ${draft.option_c},
        option_d = ${draft.option_d},
        option_e = ${draft.option_e},
        correct_answer = ${draft.correct_answer},
        subquestions = ${subquestionsJson}::jsonb,
        solution_upload_config = ${solutionConfig},
        max_points = ${draft.max_points ?? null}
      WHERE id = ${qq.id}
    `
    return true
  }

  if (!OPTION_QUIZ_TYPES.has(qType)) return false

  const normalizedAnswer = normalizeQuizQuestionCorrectAnswerForSave({
    question_type: draft.question_type,
    correct_answer: draft.correct_answer,
    option_a: draft.option_a,
    option_b: draft.option_b,
    option_c: draft.option_c,
    option_d: draft.option_d,
    option_e: draft.option_e,
  })

  const unchanged =
    qq.option_a === (draft.option_a || null) &&
    qq.option_b === (draft.option_b || null) &&
    qq.option_c === (draft.option_c || null) &&
    qq.option_d === (draft.option_d || null) &&
    qq.option_e === (draft.option_e || null) &&
    qq.correct_answer === normalizedAnswer

  if (unchanged) return false

  await sql`
    UPDATE quiz_questions
    SET
      option_a = ${draft.option_a},
      option_b = ${draft.option_b},
      option_c = ${draft.option_c},
      option_d = ${draft.option_d},
      option_e = ${draft.option_e},
      correct_answer = ${normalizedAnswer}
    WHERE id = ${qq.id}
  `
  return true
}

async function normalizeOrphanQuizQuestionSnapshot(qq: QuizQuestionRow): Promise<boolean> {
  const qType = qq.question_type.toLowerCase()
  if (!OPTION_QUIZ_TYPES.has(qType)) return false

  const normalizedAnswer = normalizeQuizQuestionCorrectAnswerForSave(qq)
  if (normalizedAnswer === (qq.correct_answer ?? "")) return false

  await sql`
    UPDATE quiz_questions
    SET correct_answer = ${normalizedAnswer}
    WHERE id = ${qq.id}
  `
  return true
}

/** Re-normalize quiz snapshots after course exchange clone (destination course only). */
export async function persistNormalizedQuizQuestionsForQuiz(
  quizId: number,
  destinationCourseId: number,
): Promise<number> {
  const quizRows = (await sql`
    SELECT id
    FROM quizzes
    WHERE id = ${quizId}
      AND course_id = ${destinationCourseId}
      AND deleted_at IS NULL
    LIMIT 1
  `) as { id: number }[]
  if (quizRows.length === 0) return 0

  const qqRows = (await sql`
    SELECT
      id,
      bank_question_id,
      question_type,
      option_a,
      option_b,
      option_c,
      option_d,
      option_e,
      correct_answer
    FROM quiz_questions
    WHERE quiz_id = ${quizId}
    ORDER BY question_order, id
  `) as QuizQuestionRow[]

  if (qqRows.length === 0) return 0

  const bankIds = [
    ...new Set(
      qqRows
        .map((q) => q.bank_question_id)
        .filter((id): id is number => id != null),
    ),
  ]

  const bankById = new Map<number, BankRow>()
  if (bankIds.length > 0) {
    const bankRows = (await sql`
      SELECT
        id,
        question_text,
        question_type,
        options,
        correct_answer,
        question_media,
        subquestions,
        solution_upload_config,
        max_points AS points
      FROM question_bank
      WHERE id = ANY(${bankIds}::int[])
        AND course_id = ${destinationCourseId}
        AND deleted_at IS NULL
    `) as BankRow[]
    for (const bank of bankRows) bankById.set(bank.id, bank)
  }

  let updated = 0
  for (const qq of qqRows) {
    if (qq.bank_question_id != null) {
      const bank = bankById.get(qq.bank_question_id)
      if (bank && (await refreshQuizQuestionSnapshotFromBank(qq, bank))) {
        updated += 1
      }
      continue
    }
    if (await normalizeOrphanQuizQuestionSnapshot(qq)) updated += 1
  }

  return updated
}
