/**
 * Run: npx tsx --test lib/exchange-content-persist-normalize.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { normalizeSamplePracticeRawForStorage } from "@/lib/exchange-content-persist-normalize"

describe("normalizeSamplePracticeRawForStorage", () => {
  it("flattens legacy subquestions wrapper to flat MCQ schema", () => {
    const raw = {
      enabled: true,
      questions: [
        {
          id: "q1",
          title: "Programs",
          question_type: "multi_part",
          question_text: "Which best defines a computer program?",
          subquestions: [
            {
              id: "a",
              type: "mcq",
              prompt: "Which best defines a computer program?",
              options: [
                { id: "A", text: "Hardware" },
                { id: "B", text: "Instructions" },
                { id: "C", text: "Network" },
                { id: "D", text: "Database" },
              ],
              correct_answer: "B",
            },
          ],
        },
      ],
    }

    const normalized = normalizeSamplePracticeRawForStorage(raw) as {
      questions: Array<{
        question_type: string
        question_text: string
        options: Array<{ id: string; text: string }>
        correct_answer: string
        subquestions?: unknown
      }>
    }

    assert.equal(normalized.questions.length, 1)
    const q = normalized.questions[0]
    assert.equal(q.question_type, "mcq")
    assert.equal(q.question_text, "Which best defines a computer program?")
    assert.equal(q.correct_answer, "B")
    assert.equal(q.options.length, 4)
    assert.equal(q.options[1].text, "Instructions")
    assert.equal(q.subquestions, undefined)
  })

  it("returns null for empty disabled config", () => {
    assert.equal(normalizeSamplePracticeRawForStorage({ enabled: false, questions: [] }), null)
  })

  it("infers enabled when questions exist but enabled flag is missing", () => {
    const raw = {
      questions: [
        {
          id: "q1",
          question_type: "mcq",
          question_text: "Test?",
          options: [
            { id: "A", text: "One" },
            { id: "B", text: "Two" },
          ],
          correct_answer: "A",
        },
      ],
    }
    const normalized = normalizeSamplePracticeRawForStorage(raw) as { enabled: boolean; questions: unknown[] }
    assert.equal(normalized.enabled, true)
    assert.equal(normalized.questions.length, 1)
  })
})
