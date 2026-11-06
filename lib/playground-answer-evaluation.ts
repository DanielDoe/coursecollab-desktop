/**
 * Playground grading uses the same local question path as practice and quizzes:
 * format the bank row, build the verify payload, then verifyAnswerLocally.
 * Speed points stay on the playground scale (fast correct answers score higher).
 */
import type { PlaygroundScoringConfig } from "@/lib/playground-policy-settings"
import { computePlaygroundAnswerPoints } from "@/lib/playground-scoring"
import { canVerifyLocally, verifyAnswerLocally } from "@/lib/local-answer-verification"
import {
  bankFormattedRowToVerifyPayload,
  formatQuestionBankRowForRenderer,
} from "@/lib/resolve-quiz-question-from-bank"

export type PlaygroundQuestionGradeSource = {
  id: number
  question_type?: string | null
  question_text?: string | null
  options?: unknown
  correct_answer?: unknown
  hint?: unknown
  explanation?: unknown
  snapshot_question_type?: string | null
  snapshot_question_text?: string | null
  snapshot_options?: unknown
  snapshot_correct_answer?: unknown
}

export type PlaygroundAnswerEvaluation = {
  isCorrect: boolean
  /** Local verifier score, 0–100. Full credit is 100. */
  score: number
  points: number
  correctAnswer: string | null
  locallyVerified: boolean
}

function firstNonEmptyText(...values: unknown[]): string {
  for (const value of values) {
    if (value == null) continue
    const text = typeof value === "string" ? value.trim() : String(value).trim()
    if (text) return text
  }
  return ""
}

function hasOptionList(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0
}

/** Prefer the session snapshot, then the live question bank row. */
export function playgroundQuestionBankRowForEvaluation(
  source: PlaygroundQuestionGradeSource,
): Record<string, unknown> {
  const snapshotType = firstNonEmptyText(source.snapshot_question_type)
  const snapshotCorrect = firstNonEmptyText(source.snapshot_correct_answer)
  return {
    id: source.id,
    question_type: snapshotType || firstNonEmptyText(source.question_type) || "mcq",
    question_text: firstNonEmptyText(source.snapshot_question_text, source.question_text),
    options: hasOptionList(source.snapshot_options) ? source.snapshot_options : source.options,
    correct_answer: snapshotCorrect || source.correct_answer,
    hint: source.hint ?? null,
    explanation: source.explanation ?? null,
  }
}

export function evaluatePlaygroundAnswer(input: {
  question: PlaygroundQuestionGradeSource
  selectedAnswer: unknown
  responseTimeMs?: number | null
  scoring?: Partial<PlaygroundScoringConfig>
}): PlaygroundAnswerEvaluation {
  const row = playgroundQuestionBankRowForEvaluation(input.question)
  const formatted = formatQuestionBankRowForRenderer(row)
  const questionType = String(formatted?.question_type || row.question_type || "mcq")
  const correctAnswer =
    formatted?.correct_answer != null && String(formatted.correct_answer).trim()
      ? String(formatted.correct_answer)
      : null

  if (!formatted || !canVerifyLocally(questionType)) {
    return {
      isCorrect: false,
      score: 0,
      points: 0,
      correctAnswer,
      locallyVerified: false,
    }
  }

  const questionData = bankFormattedRowToVerifyPayload(formatted)
  const result = verifyAnswerLocally(questionType, input.selectedAnswer, questionData)
  if (result.requiresAI) {
    return {
      isCorrect: false,
      score: 0,
      points: 0,
      correctAnswer,
      locallyVerified: false,
    }
  }

  const isCorrect = result.isCorrect
  return {
    isCorrect,
    score: result.score,
    points: computePlaygroundAnswerPoints(isCorrect, input.responseTimeMs, input.scoring),
    correctAnswer,
    locallyVerified: true,
  }
}
