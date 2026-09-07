/**
 * Run: npx tsx --test lib/cora/models/verification.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isExamVerificationContext,
  parseCoraVerifierPayload,
  shouldVerifyTask,
  verificationContextFromMessage,
} from "@/lib/cora/models/verification"

describe("shouldVerifyTask", () => {
  it("always verifies exam / final / assessment_exam even when the flag is off", () => {
    assert.equal(
      shouldVerifyTask({
        userRole: "instructor",
        portal: "faculty",
        message: "Write a midterm",
        assessmentContext: "exam",
        coraLiteMode: false,
      }),
      true,
    )
    assert.equal(
      shouldVerifyTask({
        userRole: "instructor",
        portal: "faculty",
        message: "final exam bank",
        taskCategory: "assessment_exam",
        coraLiteMode: false,
      }),
      true,
    )
    assert.equal(isExamVerificationContext(verificationContextFromMessage({
      userRole: "instructor",
      portal: "faculty",
      message: "Create a 20 question midterm on KCL",
    })), true)
  })

  it("never verifies in Lite", () => {
    assert.equal(
      shouldVerifyTask({
        userRole: "instructor",
        portal: "faculty",
        message: "final exam",
        assessmentContext: "final",
        coraLiteMode: true,
      }),
      false,
    )
  })
})

describe("parseCoraVerifierPayload", () => {
  it("accepts a clean ok payload", () => {
    const parsed = parseCoraVerifierPayload('{"ok":true,"issues":[]}')
    assert.equal(parsed.ok, true)
    assert.deepEqual(parsed.issues, [])
  })

  it("rejects disagreement and keeps repaired drafts", () => {
    const parsed = parseCoraVerifierPayload(
      '{"ok":false,"issues":["key mismatch"],"repairedDrafts":[{"question_text":"fixed"}]}',
    )
    assert.equal(parsed.ok, false)
    assert.equal(parsed.issues[0], "key mismatch")
    assert.ok(parsed.repairedDraftsJson?.includes("fixed"))
  })

  it("fails closed on garbage", () => {
    const parsed = parseCoraVerifierPayload("not json")
    assert.equal(parsed.ok, false)
    assert.ok(parsed.issues.length > 0)
  })
})
