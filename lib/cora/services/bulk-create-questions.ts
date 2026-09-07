/**
 * Shared question-bank bulk create — used by bulk-create route and Cora tools.
 * One INSERT … SELECT from jsonb_to_recordset so Neon HTTP stays atomic.
 */

import { sql } from "@/lib/db"
import { questionMediaToJsonString } from "@/lib/question-media"
import { solutionUploadConfigToJsonString } from "@/lib/solution-upload"
import { normalizeQuestionBankRowForStorage } from "@/lib/question-type-schema"
import type { DraftQuestionBankItem } from "@/lib/question-bank-ai-from-pdf-types"
import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"

const MAX_BATCH = 25

function normalizeDraft(row: Record<string, unknown>): DraftQuestionBankItem | null {
  const question_text = String(row.question_text ?? "").trim()
  const question_type = String(row.question_type ?? "").trim()
  if (!question_text || !question_type) return null

  return {
    draftId: String(row.draftId ?? ""),
    question_text,
    question_type: question_type as DraftQuestionBankItem["question_type"],
    difficulty: String(row.difficulty ?? "medium") as DraftQuestionBankItem["difficulty"],
    topic: String(row.topic ?? "").trim(),
    options: Array.isArray(row.options) ? row.options.map(String) : [],
    correct_answer: row.correct_answer as string | string[],
    hint: row.hint != null ? String(row.hint) : null,
    explanation: row.explanation != null ? String(row.explanation) : null,
    evaluation_mode: row.evaluation_mode === "manual" ? "manual" : "auto",
    answer_guidelines: Array.isArray(row.answer_guidelines) ? row.answer_guidelines.map(String) : [],
    sample_answer: row.sample_answer != null ? String(row.sample_answer) : null,
    subquestions: Array.isArray(row.subquestions) ? row.subquestions : null,
    source_note: row.source_note != null ? String(row.source_note) : null,
  }
}

export function questionBankInsertPayload(questions: unknown[]): Array<{
  question_text: string
  question_type: string
  difficulty: string
  topic: string | null
  options: string
  correct_answer: string
  hint: string | null
  evaluation_mode: string
  sample_answer: string | null
  answer_guidelines: string
  explanation: string | null
  question_media: string | null
  subquestions: string | null
  solution_upload_config: string | null
}> {
  const mediaJson = questionMediaToJsonString(null)
  const solutionJson = solutionUploadConfigToJsonString(null)
  const rows: ReturnType<typeof questionBankInsertPayload> = []
  for (const raw of questions) {
    const q = normalizeDraft(raw as Record<string, unknown>)
    if (!q) continue
    const normalized = normalizeQuestionBankRowForStorage({
      question_type: q.question_type,
      options: q.options,
      correct_answer: q.correct_answer,
    })
    rows.push({
      question_text: q.question_text,
      question_type: q.question_type,
      difficulty: q.difficulty,
      topic: q.topic || null,
      options: JSON.stringify(normalized.options),
      correct_answer: JSON.stringify(normalized.correct_answer ?? ""),
      hint: q.hint,
      evaluation_mode: q.evaluation_mode,
      sample_answer: q.sample_answer,
      answer_guidelines: JSON.stringify(q.answer_guidelines || []),
      explanation: q.explanation,
      question_media: mediaJson,
      subquestions: q.subquestions == null ? null : JSON.stringify(q.subquestions),
      solution_upload_config: solutionJson,
    })
  }
  return rows
}

export async function bulkCreateQuestionBankQuestions(input: {
  instructorId: number
  courseId: number
  questions: unknown[]
}): Promise<{ createdCount: number; questionIds: number[] }> {
  const allowed = await instructorCanAccessCourse(input.instructorId, input.courseId)
  if (!allowed) {
    throw new Error("Instructor cannot create questions for this course.")
  }

  if (!input.questions.length) {
    throw new Error("No questions to save.")
  }
  if (input.questions.length > MAX_BATCH) {
    throw new Error(`Max ${MAX_BATCH} questions per batch.`)
  }

  const payload = questionBankInsertPayload(input.questions)
  if (payload.length === 0) {
    throw new Error("No valid questions were saved.")
  }

  const result = (await sql`
    INSERT INTO question_bank (
      question_text,
      question_type,
      difficulty,
      topic,
      options,
      correct_answer,
      hint,
      evaluation_mode,
      sample_answer,
      answer_guidelines,
      explanation,
      course_id,
      question_media,
      subquestions,
      solution_upload_config,
      expected_answer
    )
    SELECT
      x.question_text,
      x.question_type,
      x.difficulty,
      x.topic,
      x.options,
      x.correct_answer,
      x.hint,
      x.evaluation_mode,
      x.sample_answer,
      x.answer_guidelines,
      x.explanation,
      ${input.courseId},
      x.question_media::jsonb,
      x.subquestions::jsonb,
      x.solution_upload_config::jsonb,
      NULL
    FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS x(
      question_text text,
      question_type text,
      difficulty text,
      topic text,
      options text,
      correct_answer text,
      hint text,
      evaluation_mode text,
      sample_answer text,
      answer_guidelines text,
      explanation text,
      question_media text,
      subquestions text,
      solution_upload_config text
    )
    RETURNING id
  `) as Array<{ id: number }>

  const questionIds = result.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0)
  if (questionIds.length === 0) {
    throw new Error("No valid questions were saved.")
  }

  return { createdCount: questionIds.length, questionIds }
}

export { MAX_BATCH as QUESTION_BANK_BULK_MAX, normalizeDraft as normalizeQuestionBankDraft }
