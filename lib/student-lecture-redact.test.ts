/**
 * Run: npx tsx --test lib/student-lecture-redact.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { redactStudentLectureRecord } from "@/lib/student-lecture-redact"

describe("student lecture redaction", () => {
  it("strips sample-practice correct_answer and explanations", () => {
    const redacted = redactStudentLectureRecord({
      id: 98,
      sample_practice: {
        enabled: true,
        questions: [
          {
            id: "q1",
            title: "Ohm",
            question_text: "Find I",
            subquestions: [
              {
                id: "a",
                type: "mcq",
                prompt: "Current?",
                options: ["A", "B"],
                correct_answer: "B",
                explanation: "Use Ohm's law",
              },
            ],
          },
        ],
      },
    })
    const json = JSON.stringify(redacted)
    assert.equal(json.includes("correct_answer"), false)
    assert.equal(json.includes("Use Ohm's law"), false)
  })
})
