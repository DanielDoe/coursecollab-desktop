/**
 * Run: npx tsx --test lib/classroom-points-student-question-config.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  redactClassroomPointsStudentQuestionConfig,
  redactClassroomPointsStudentSubmission,
} from "@/lib/classroom-points-student-question-config"

describe("classroom points student question_config redact", () => {
  it("strips expected_answer and answer-key aliases, keeps question_text", () => {
    const redacted = redactClassroomPointsStudentQuestionConfig({
      question_text: "Find Z_L for maximum power transfer.",
      question_type: "circuit_submission",
      question_media: { media_enabled: false },
      solution_upload_config: { require_solution_upload: true },
      points_hint: 2.5,
      expected_answer: "Z_L = 1.33 − j4.00 kΩ … P_max = 4.18 mW",
      solution: "full worked solution",
      reference_answer: "reference",
      answer_key: "key",
    }) as Record<string, unknown>

    assert.equal(redacted.question_text, "Find Z_L for maximum power transfer.")
    assert.equal(redacted.question_type, "circuit_submission")
    assert.equal(redacted.points_hint, 2.5)
    assert.deepEqual(redacted.question_media, { media_enabled: false })
    assert.deepEqual(redacted.solution_upload_config, { require_solution_upload: true })
    assert.equal("expected_answer" in redacted, false)
    assert.equal("solution" in redacted, false)
    assert.equal("reference_answer" in redacted, false)
    assert.equal("answer_key" in redacted, false)
  })

  it("redacts a JSON string question_config", () => {
    const redacted = redactClassroomPointsStudentQuestionConfig(
      JSON.stringify({
        question_text: "Show your work",
        expected_answer: "42",
      }),
    ) as Record<string, unknown>
    assert.equal(redacted.question_text, "Show your work")
    assert.equal("expected_answer" in redacted, false)
  })

  it("redacts question_config on a submission row", () => {
    const row = redactClassroomPointsStudentSubmission({
      id: 167,
      title: "Max power",
      question_config: {
        question_text: "Find Z_L",
        expected_answer: "secret",
      },
    })
    assert.equal(row.id, 167)
    assert.equal((row.question_config as { question_text: string }).question_text, "Find Z_L")
    assert.equal(
      (row.question_config as { expected_answer?: string }).expected_answer,
      undefined,
    )
  })
})
