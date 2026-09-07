/**
 * Bridge sample-practice flat schema → quiz taker / question bank renderer + verify pipeline.
 */

import type { LectureSamplePracticeQuestion } from "@/lib/lecture-sample-practice"
import { parseSamplePracticeStudentAnswer } from "@/lib/lecture-sample-practice"
import {
  practiceAnswerReviewForEvaluateResponse,
  type PracticeAnswerReview,
} from "@/lib/practice-answer-review"
import {
  bankFormattedRowToVerifyPayload,
  formatQuestionBankRowForRenderer,
  type FormattedQuestionBankRow,
} from "@/lib/quiz-question-bank-format"

function samplePracticeNumericId(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  return Math.abs(hash) || 1
}

/** Bank-row shape consumed by formatQuestionBankRowForRenderer / verifyAnswerLocally. */
export function samplePracticeQuestionToBankRow(
  question: LectureSamplePracticeQuestion,
): Record<string, unknown> {
  const type = question.question_type
  return {
    id: samplePracticeNumericId(question.id),
    question_text: question.question_text,
    question_type: type,
    options: question.options,
    correct_answer:
      type === "select_all"
        ? (question.correct_answers ?? [])
        : (question.correct_answer ?? ""),
    topic: question.topic ?? null,
    difficulty: question.difficulty ?? null,
    question_media: question.question_media ?? null,
  }
}

export function samplePracticeQuestionToRendererRow(
  question: LectureSamplePracticeQuestion,
): FormattedQuestionBankRow | null {
  return formatQuestionBankRowForRenderer(samplePracticeQuestionToBankRow(question))
}

export function samplePracticeQuestionToVerifyPayload(question: LectureSamplePracticeQuestion) {
  const formatted = samplePracticeQuestionToRendererRow(question)
  if (!formatted) {
    throw new Error("Invalid sample practice question")
  }
  return bankFormattedRowToVerifyPayload(formatted)
}

export function samplePracticeAnswerReview(input: {
  question: LectureSamplePracticeQuestion
  studentAnswer: string | string[]
  isCorrect: boolean
  correctTexts?: string[]
}): PracticeAnswerReview | null {
  const formatted = samplePracticeQuestionToRendererRow(input.question)
  if (!formatted) return null
  return practiceAnswerReviewForEvaluateResponse({
    question: formatted,
    studentAnswer: input.studentAnswer,
    isCorrect: input.isCorrect,
    correctTexts: input.correctTexts,
  })
}

export function samplePracticeRestoreSelection(
  question: LectureSamplePracticeQuestion,
  raw: unknown,
): { selectedAnswer: string; selectedMultiAnswers: string[] } {
  const parsed = parseSamplePracticeStudentAnswer(raw)
  if (question.question_type === "select_all") {
    const letters = Array.isArray(parsed)
      ? parsed.map((entry) => String(entry).trim().toUpperCase()).filter(Boolean)
      : typeof parsed === "string" && parsed.trim()
        ? [parsed.trim().toUpperCase()]
        : []
    return { selectedAnswer: "", selectedMultiAnswers: letters }
  }
  const letter = Array.isArray(parsed) ? parsed[0] : parsed
  return {
    selectedAnswer: String(letter ?? "").trim().toUpperCase(),
    selectedMultiAnswers: [],
  }
}

export function samplePracticeSubmitAnswer(
  question: LectureSamplePracticeQuestion,
  selectedAnswer: string,
  selectedMultiAnswers: string[],
): string | string[] {
  return question.question_type === "select_all" ? selectedMultiAnswers : selectedAnswer
}

export function samplePracticeHasSelection(
  question: LectureSamplePracticeQuestion,
  selectedAnswer: string,
  selectedMultiAnswers: string[],
): boolean {
  if (question.question_type === "select_all") {
    return selectedMultiAnswers.length > 0
  }
  return selectedAnswer.trim().length > 0
}
