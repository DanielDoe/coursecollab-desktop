import { sql } from "@/lib/db"
import { normalizeAiCodeLanguage } from "@/lib/ai-code-languages"
import { normalizeQuizQuestionCorrectAnswerForSave } from "@/lib/question-bank-normalize"
import { serializeQuestionMediaAndCircuitSpec } from "@/lib/question-media-persist"
import { solutionUploadConfigToJsonString } from "@/lib/solution-upload"

export type QuizQuestionSyncRow = {
  id: number
  question_order: number
  bank_question_id: number | null
}

export type QuizQuestionSyncResult = {
  /** Full delete+reinsert was skipped because attempts exist; merge/update/insert used instead. */
  mergedBecauseAttempts: boolean
  syncedQuestions: QuizQuestionSyncRow[]
  insertedCount: number
  updatedCount: number
}

function subquestionsJson(q: Record<string, unknown>): string | null {
  if (q.subquestions == null) return null
  return typeof q.subquestions === "string" ? q.subquestions : JSON.stringify(q.subquestions)
}

function solutionJson(q: Record<string, unknown>): string | null {
  if (q.solution_upload_config == null) return null
  return solutionUploadConfigToJsonString(q.solution_upload_config)
}

/**
 * Persist quiz_questions for an assessment update.
 * - No attempts: replace all rows (stable for drafts).
 * - Has attempts: update existing by id, insert new rows, update order — never delete
 *   (answer rows reference question ids).
 */
export async function syncQuizQuestionsOnUpdate(
  quizId: number,
  questions: unknown,
): Promise<QuizQuestionSyncResult> {
  const list = Array.isArray(questions) ? (questions as Record<string, unknown>[]) : []

  const attemptRows = (await sql`
    SELECT COUNT(*)::int AS count FROM quiz_attempts WHERE quiz_id = ${quizId}
  `) as Array<{ count: number }>
  const hasAttempts = (attemptRows[0]?.count ?? 0) > 0

  const syncedQuestions: QuizQuestionSyncRow[] = []
  let insertedCount = 0
  let updatedCount = 0

  if (!hasAttempts) {
    await sql`DELETE FROM quiz_questions WHERE quiz_id = ${quizId}`

    for (let i = 0; i < list.length; i++) {
      const q = list[i]
      const row = await insertQuizQuestionRow(quizId, q, i + 1)
      syncedQuestions.push(row)
      insertedCount++
    }

    return {
      mergedBecauseAttempts: false,
      syncedQuestions,
      insertedCount,
      updatedCount,
    }
  }

  for (let i = 0; i < list.length; i++) {
    const q = list[i]
    const order = i + 1
    const qid = Number(q?.id)
    if (Number.isFinite(qid) && qid > 0) {
      await updateQuizQuestionRow(quizId, qid, q, order)
      syncedQuestions.push({
        id: qid,
        question_order: order,
        bank_question_id: q.bank_question_id != null ? Number(q.bank_question_id) : null,
      })
      updatedCount++
    } else {
      const row = await insertQuizQuestionRow(quizId, q, order)
      syncedQuestions.push(row)
      insertedCount++
    }
  }

  return {
    mergedBecauseAttempts: true,
    syncedQuestions,
    insertedCount,
    updatedCount,
  }
}

async function insertQuizQuestionRow(
  quizId: number,
  q: Record<string, unknown>,
  order: number,
): Promise<QuizQuestionSyncRow> {
  const perQlang = normalizeAiCodeLanguage(q?.ai_code_language as string | undefined)
  const { questionMediaJson, circuitSpecJson } = serializeQuestionMediaAndCircuitSpec(q)
  const maxPts = Number(q.max_points ?? q.points ?? 1)
  const bankId = q.bank_question_id != null ? Number(q.bank_question_id) : null

  const [inserted] = (await sql`
    INSERT INTO quiz_questions (
      quiz_id, question_text, option_a, option_b, option_c, option_d, option_e,
      correct_answer, question_order, time_limit, question_type, bank_question_id,
      anti_cheat_exempt, ai_code_language, circuit_spec, question_media,
      subquestions, solution_upload_config, points, max_points
    )
    VALUES (
      ${quizId}, ${q.question_text}, ${q.option_a}, ${q.option_b},
      ${q.option_c}, ${q.option_d}, ${q.option_e || null}, ${normalizeQuizQuestionCorrectAnswerForSave(q)}, ${order},
      ${q.time_limit || null}, ${q.question_type || "multiple_choice"}, ${bankId},
      ${q.anti_cheat_exempt === true},
      ${perQlang},
      ${circuitSpecJson === null ? null : circuitSpecJson}::jsonb,
      ${questionMediaJson === null ? null : questionMediaJson}::jsonb,
      ${subquestionsJson(q) === null ? null : subquestionsJson(q)}::jsonb,
      ${solutionJson(q) === null ? null : solutionJson(q)}::jsonb,
      ${maxPts}, ${maxPts}
    )
    RETURNING id, bank_question_id, question_order
  `) as Array<{ id: number; bank_question_id: number | null; question_order: number }>

  if (inserted?.bank_question_id) {
    await sql`
      INSERT INTO question_bank_usage (quiz_id, bank_question_id, question_id, used_at)
      VALUES (${quizId}, ${inserted.bank_question_id}, ${inserted.id}, NOW())
      ON CONFLICT DO NOTHING
    `
  }

  return {
    id: Number(inserted.id),
    question_order: Number(inserted.question_order ?? order),
    bank_question_id: inserted.bank_question_id != null ? Number(inserted.bank_question_id) : null,
  }
}

async function updateQuizQuestionRow(
  quizId: number,
  qid: number,
  q: Record<string, unknown>,
  order: number,
): Promise<void> {
  const perQlang = normalizeAiCodeLanguage(q?.ai_code_language as string | undefined)
  const { questionMediaJson, circuitSpecJson } = serializeQuestionMediaAndCircuitSpec(q)
  const maxPts = Number(q.max_points ?? q.points ?? 1)

  await sql`
    UPDATE quiz_questions
    SET
      question_text = ${q.question_text},
      option_a = ${q.option_a},
      option_b = ${q.option_b},
      option_c = ${q.option_c},
      option_d = ${q.option_d},
      option_e = ${q.option_e || null},
      correct_answer = ${normalizeQuizQuestionCorrectAnswerForSave(q)},
      question_type = ${q.question_type || "mcq"},
      time_limit = ${q.time_limit ?? null},
      question_order = ${order},
      anti_cheat_exempt = ${q.anti_cheat_exempt === true},
      ai_code_language = ${perQlang},
      circuit_spec = ${circuitSpecJson === null ? null : circuitSpecJson}::jsonb,
      question_media = ${questionMediaJson === null ? null : questionMediaJson}::jsonb,
      subquestions = ${subquestionsJson(q) === null ? null : subquestionsJson(q)}::jsonb,
      solution_upload_config = ${solutionJson(q) === null ? null : solutionJson(q)}::jsonb,
      points = ${maxPts},
      max_points = ${maxPts},
      bank_question_id = ${q.bank_question_id ?? null}
    WHERE id = ${qid} AND quiz_id = ${quizId}
  `
}
