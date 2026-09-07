/**
 * Shared Rendering Logic
 * 
 * Provides utilities for question randomization and rendering
 * that work across all assessment types.
 */

import { sql } from "@/lib/db"
import {
  hasActiveQuestionMedia,
  resolveQuestionMedia,
} from "@/lib/question-media"
import { resolveQuizQuestionFromBank } from "@/lib/resolve-quiz-question-from-bank"
import { getAssessmentConfig, type AssessmentType } from "./db"

/**
 * Randomize question order
 */
export function randomizeQuestions<T>(questions: T[]): T[] {
  const shuffled = [...questions]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Randomize option order for MCQ questions
 */
export function randomizeOptions(question: any): any {
  if (!question.option_a && !question.option_b) {
    return question // No options to randomize
  }

  const options = [
    { key: 'A', value: question.option_a },
    { key: 'B', value: question.option_b },
    { key: 'C', value: question.option_c },
    { key: 'D', value: question.option_d },
    { key: 'E', value: question.option_e }
  ].filter(opt => opt.value) // Remove empty options

  const shuffled = randomizeQuestions(options)
  const slotKeys = ['A', 'B', 'C', 'D', 'E']

  // The option that was at `correctKey` moves to whatever slot it lands in after
  // the shuffle, so the new key is its INDEX IN THE SHUFFLED list — not the old
  // key of whoever took its former position.
  const correctKey = question.correct_answer?.toUpperCase()
  const shuffledIndex = shuffled.findIndex(opt => opt.key === correctKey)
  const newCorrectKey = shuffledIndex === -1 ? correctKey : slotKeys[shuffledIndex]

  return {
    ...question,
    option_a: shuffled[0]?.value || null,
    option_b: shuffled[1]?.value || null,
    option_c: shuffled[2]?.value || null,
    option_d: shuffled[3]?.value || null,
    option_e: shuffled[4]?.value || null,
    correct_answer: newCorrectKey,
    original_correct_answer: correctKey // Keep original for grading
  }
}

/**
 * Prepare questions for rendering
 * Handles randomization based on assessment settings
 */
export async function prepareQuestionsForRendering(
  assessmentType: AssessmentType,
  assessmentId: number,
  options: {
    randomizeQuestions?: boolean
    randomizeOptions?: boolean
    studentId?: number
  } = {}
): Promise<any[]> {
  const config = getAssessmentConfig(assessmentType)
  const { randomizeQuestions: shouldRandomize, randomizeOptions: shouldRandomizeOpts } = options

  // Fetch questions
  let questions = await sql`
    SELECT * FROM ${sql.unsafe(config.questionsTable)}
    WHERE ${sql.unsafe(config.idColumn)} = ${assessmentId}
    ORDER BY question_order ASC
  `

  // Randomize question order if enabled
  if (shouldRandomize) {
    questions = randomizeQuestions(questions)
  }

  // Randomize options if enabled
  if (shouldRandomizeOpts) {
    questions = questions.map(q => {
      // Only randomize MCQ and true/false questions
      if (['mcq', 'true_false'].includes(q.question_type?.toLowerCase())) {
        return randomizeOptions(q)
      }
      return q
    })
  }

  return questions
}

/**
 * Format question for QuestionRenderer component
 */
/**
 * Shapes a question for the client.
 *
 * SECURITY: `correct_answer` is withheld by default. Both take routes
 * (`/api/quiz/take/[id]` and `/api/[assessmentType]/take/[id]`) send this
 * payload to the student BEFORE they answer, so including the key made the
 * take URL an answer key — `GET /api/quiz/take/42?studentId=123` returned
 * every correct answer up front. Grading happens server-side in
 * `/api/{type}/submit`, so no student-facing surface needs it.
 *
 * Pass `{ includeAnswerKey: true }` ONLY from post-submission review/results
 * paths, where revealing the key is the point.
 */
export function formatQuestionForRenderer(
  question: any,
  options?: { includeAnswerKey?: boolean },
): any {
  if (!question || !question.id) {
    console.error('[formatQuestionForRenderer] Invalid question:', question)
    return null
  }
  
  try {
    const resolved = resolveQuizQuestionFromBank(question)
    const formatted = {
      id: resolved.id,
      question_text: resolved.question_text,
      question_type: resolved.question_type || 'mcq',
      option_a: resolved.option_a,
      option_b: resolved.option_b,
      option_c: resolved.option_c,
      option_d: resolved.option_d,
      option_e: resolved.option_e,
      ...(options?.includeAnswerKey ? { correct_answer: resolved.correct_answer } : {}),
      time_limit: resolved.time_limit,
      points: resolved.points || 1,
      max_points: resolved.max_points || resolved.points || 1,
      hint: resolved.hint,
      hint_penalty: resolved.hint_penalty || 0,
      requires_code: resolved.requires_code || false,
      anti_cheat_exempt: resolved.anti_cheat_exempt || false,
      circuit_spec: resolved.circuit_spec ?? null,
      question_media: (() => {
        const media = resolveQuestionMedia(resolved)
        return hasActiveQuestionMedia(media) ? media : resolved.question_media ?? null
      })(),
      subquestions: resolved.subquestions ?? null,
      solution_upload_config: resolved.solution_upload_config ?? null,
    }
    
    return formatted
  } catch (error) {
    console.error('[formatQuestionForRenderer] Error formatting question:', error, question)
    return null
  }
}

