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
})
