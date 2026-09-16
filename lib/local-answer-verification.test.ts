/**
 * Run: npx tsx --test lib/local-answer-verification.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { verifyAnswerLocally } from "./local-answer-verification"
import { normalizeQuizRowForEvaluation } from "./question-bank-normalize"

const tfOptions = {
  A: "True",
  B: "False",
  C: null,
  D: null,
  E: null,
}

describe("local answer verification", () => {
  it("grades true/false when correct_answer is True text and student selects A", () => {
    const result = verifyAnswerLocally("true_false", "A", {
      correctAnswer: "True",
      options: tfOptions,
    })
    assert.equal(result.isCorrect, true)
  })

  it("grades MCQ when correct_answer is option text and student selects letter", () => {
    const result = verifyAnswerLocally("mcq", "B", {
      correctAnswer: "6.0 kVA",
      options: {
        A: "4.5 kVA",
        B: "6.0 kVA",
        C: "8.0 kVA",
        D: null,
        E: null,
      },
    })
    assert.equal(result.isCorrect, true)
  })

  it("grades MCQ when correct_answer is numeric index", () => {
    const result = verifyAnswerLocally("mcq", "C", {
      correctAnswer: 2,
      options: {
        A: "First",
        B: "Second",
        C: "Third",
        D: null,
        E: null,
      },
    })
    assert.equal(result.isCorrect, true)
  })

  it("grades select_all when student answer is a JSON string", () => {
    const result = verifyAnswerLocally("select_all", '["B","D"]', {
      correctAnswer: '["B","D"]',
      options: {
        A: "960 W",
        B: "Formula B",
        C: "1200 W",
        D: "720 W",
        E: "Formula E",
      },
    })
    assert.equal(result.isCorrect, true)
  })

  it("grades select_all when correct_answer is comma-separated letters", () => {
    const result = verifyAnswerLocally("select_all", ["A", "D"], {
      correctAnswer: "A,D",
      options: {
        A: "960 W",
        B: "Formula B",
        C: "1200 W",
        D: "720 W",
        E: null,
      },
    })
    assert.equal(result.isCorrect, true)
  })

  it("grades select_all A+B correct when key includes missing option F", () => {
    const options = {
      A: "960 W",
      B: "P = V_rms I_rms cos(36.87°) = 120 × 10 × cos(36.87°)",
      C: "1200 W",
      D: "720 W",
      E: "P = 120 × 10 × sin(36.87°)",
    }
    const result = verifyAnswerLocally("select_all", ["A", "B"], {
      correctAnswer: '["A","B","F"]',
      options,
    })
    assert.equal(result.isCorrect, true)
    assert.equal(result.score, 100)
  })

  it("awards select_all partial credit when student misses one correct option", () => {
    const result = verifyAnswerLocally("select_all", ["A", "B"], {
      correctAnswer: '["A","B","C"]',
      options: {
        A: "960 W",
        B: "Formula B",
        C: "1200 W",
        D: "720 W",
        E: null,
      },
    })
    assert.equal(result.isCorrect, false)
    assert.ok(result.score > 0 && result.score < 100)
  })

  it("does not award select_all full credit when every option is selected", () => {
    const result = verifyAnswerLocally("select_all", ["A", "B", "C", "D", "E"], {
      correctAnswer: '["A","B","C"]',
      options: {
        A: "960 W",
        B: "Formula B",
        C: "1200 W",
        D: "720 W",
        E: "Wrong formula",
      },
    })
    assert.equal(result.isCorrect, false)
    assert.equal(result.score, 33.33)
  })

  it("grades select_all zero when student selects only incorrect options", () => {
    const result = verifyAnswerLocally("select_all", ["D", "E"], {
      correctAnswer: '["A","B"]',
      options: {
        A: "960 W",
        B: "Formula B",
        C: "1200 W",
        D: "720 W",
        E: "Wrong formula",
      },
    })
    assert.equal(result.isCorrect, false)
    assert.equal(result.score, 0)
  })
})

describe("normalizeQuizRowForEvaluation", () => {
  it("normalizes quiz-native true/false keys stored as True/False text", () => {
    const row = normalizeQuizRowForEvaluation({
      question_type: "true_false",
      correct_answer: "True",
      option_a: "True",
      option_b: "False",
    })
    assert.equal(row.correct_answer, "A")
  })

  it("drops select_all letters that have no option column on the quiz copy", () => {
    const row = normalizeQuizRowForEvaluation({
      question_type: "select_all",
      correct_answer: '["A","B","F"]',
      option_a: "960 W",
      option_b: "Formula B",
      option_c: "1200 W",
      option_d: "720 W",
      option_e: "Wrong",
    })
    assert.equal(row.correct_answer, '["A","B"]')
  })
})
