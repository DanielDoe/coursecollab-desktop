/**
 * Run: npx tsx --test lib/playground-answer-evaluation.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { verifyAnswerLocally } from "./local-answer-verification"
import {
  bankFormattedRowToVerifyPayload,
  formatQuestionBankRowForRenderer,
} from "./quiz-question-bank-format"
import { computePlaygroundAnswerPoints } from "./playground-scoring"
import {
  evaluatePlaygroundAnswer,
  playgroundQuestionBankRowForEvaluation,
  type PlaygroundQuestionGradeSource,
} from "./playground-answer-evaluation"

function grade(question: PlaygroundQuestionGradeSource, selectedAnswer: unknown, responseTimeMs = 0) {
  return evaluatePlaygroundAnswer({ question, selectedAnswer, responseTimeMs })
}

function sameAsPractice(question: PlaygroundQuestionGradeSource, selectedAnswer: unknown) {
  const row = playgroundQuestionBankRowForEvaluation(question)
  const formatted = formatQuestionBankRowForRenderer(row)
  assert.ok(formatted)
  const direct = verifyAnswerLocally(
    String(formatted.question_type),
    selectedAnswer,
    bankFormattedRowToVerifyPayload(formatted),
  )
  const playground = grade(question, selectedAnswer, 1200)
  assert.equal(playground.isCorrect, direct.isCorrect)
  assert.equal(playground.score, direct.score)
  assert.equal(playground.correctAnswer, String(formatted.correct_answer))
  assert.equal(playground.locallyVerified, !direct.requiresAI)
  assert.equal(
    playground.points,
    computePlaygroundAnswerPoints(direct.isCorrect, 1200),
  )
}

describe("evaluatePlaygroundAnswer", () => {
  const mcq: PlaygroundQuestionGradeSource = {
    id: 41,
    question_type: "mcq",
    question_text: "Which option is blue?",
    options: ["red", "blue", "green"],
    correct_answer: "blue",
  }

  it("matches practice local verification for a letter, option text, and a wrong choice", () => {
    sameAsPractice(mcq, "B")
    sameAsPractice(mcq, "blue")
    sameAsPractice(mcq, "A")
  })

  it("normalizes an index key the same way quizzes do", () => {
    sameAsPractice({ ...mcq, correct_answer: 1 }, "B")
    sameAsPractice({ ...mcq, correct_answer: "1" }, "B")
  })

  it("grades true/false through the shared letter key", () => {
    const tf: PlaygroundQuestionGradeSource = {
      id: 7,
      question_type: "true_false",
      options: ["True", "False"],
      correct_answer: "True",
    }
    sameAsPractice(tf, "A")
    sameAsPractice(tf, "True")
    sameAsPractice(tf, "B")
  })

  it("prefers the session snapshot over a later bank edit", () => {
    const edited: PlaygroundQuestionGradeSource = {
      ...mcq,
      correct_answer: "red",
      options: ["red", "blue", "green"],
      snapshot_options: ["red", "blue", "green"],
      snapshot_correct_answer: "green",
      snapshot_question_type: "mcq",
    }
    const result = grade(edited, "C")
    assert.equal(result.isCorrect, true)
    assert.equal(result.correctAnswer, "C")
    assert.equal(grade(edited, "A").isCorrect, false)
  })

  it("awards more points for a faster correct answer and none for a miss", () => {
    const fast = grade(mcq, "B", 500)
    const slow = grade(mcq, "B", 10000)
    const miss = grade(mcq, "A", 100)
    assert.equal(fast.points, 5)
    assert.equal(slow.points, 3)
    assert.ok(fast.points > slow.points)
    assert.equal(miss.isCorrect, false)
    assert.equal(miss.points, 0)
  })

  it("uses the course speed window when one is provided", () => {
    const result = evaluatePlaygroundAnswer({
      question: mcq,
      selectedAnswer: "B",
      responseTimeMs: 5000,
      scoring: { pointsMax: 10, pointsMin: 4, speedWindowMs: 5000 },
    })
    assert.equal(result.points, 4)
  })
})
