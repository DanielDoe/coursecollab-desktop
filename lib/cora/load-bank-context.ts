import { sql } from "@/lib/db"
import { attachMediaToProblem } from "@/lib/cora/attach-question-media"
import type { CoraProblemContext } from "@/lib/cora/types"

type BankRow = {
  question_text: string
  question_type: string
  expected_answer: string | null
  hint: string | null
  explanation: string | null
  topic: string | null
  question_media: unknown
}

/** Enrich walkthrough context from question_bank when IDs are available. */
export async function enrichCoraContextFromBank(
  problem: CoraProblemContext,
): Promise<CoraProblemContext> {
  if (!problem.bankQuestionId) return problem

  const rows = (await sql`
    SELECT question_text, question_type, expected_answer, hint, explanation, topic,
           question_media
    FROM question_bank
    WHERE id = ${problem.bankQuestionId}
      AND deleted_at IS NULL
    LIMIT 1
  `) as BankRow[]

  if (!rows.length) return problem
  const row = rows[0]

  const explanationSteps =
    problem.referenceSteps && problem.referenceSteps.length > 0
      ? problem.referenceSteps
      : row.explanation
        ? row.explanation.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean)
        : undefined

  let enriched: CoraProblemContext = {
    ...problem,
    questionText: problem.questionText || row.question_text,
    questionType: problem.questionType || row.question_type,
    expectedAnswer: problem.expectedAnswer ?? row.expected_answer,
    hint: problem.hint ?? row.hint,
    explanation: problem.explanation ?? row.explanation,
    topic: problem.topic ?? row.topic,
    referenceSteps: explanationSteps,
  }

  enriched = attachMediaToProblem(enriched, {
    question_media: row.question_media,
  })

  return enriched
}

/** Load quiz question media + bank link for server-side enrichment. */
export async function enrichCoraContextFromQuizQuestion(
  problem: CoraProblemContext,
): Promise<CoraProblemContext> {
  if (!problem.questionId || !problem.quizId) return problem

  const rows = (await sql`
    SELECT bank_question_id, question_media
    FROM quiz_questions
    WHERE id = ${Number(problem.questionId)}
      AND quiz_id = ${Number(problem.quizId)}
    LIMIT 1
  `) as { bank_question_id: number | null; question_media: unknown }[]

  if (!rows.length) return problem
  const row = rows[0]

  let enriched = attachMediaToProblem(problem, {
    question_media: row.question_media,
  })

  const bankId = enriched.bankQuestionId ?? row.bank_question_id
  if (bankId) {
    enriched = await enrichCoraContextFromBank({ ...enriched, bankQuestionId: bankId })
  }

  return enriched
}
