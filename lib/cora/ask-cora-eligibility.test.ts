/**
 * Run: npx tsx --test lib/cora/ask-cora-eligibility.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { canStudentAskCora } from "./ask-cora-eligibility"

describe("canStudentAskCora", () => {
  it("blocks objective / autograded types", () => {
    for (const type of ["mcq", "true_false", "select_all", "multi_select", "fill_blank", "trace_output"]) {
      assert.equal(canStudentAskCora(type), false, type)
    }
  })

  it("allows written / constructed types", () => {
    for (const type of ["code_write", "code_write_plot", "circuit_submission", "debug_code", "code_explain"]) {
      assert.equal(canStudentAskCora(type), true, type)
    }
  })

  it("allows multi_part only when a written sub-question exists", () => {
    assert.equal(canStudentAskCora("multi_part"), false)
    assert.equal(canStudentAskCora("multi_part", { subquestionTypes: ["mcq", "true_false"] }), false)
    assert.equal(canStudentAskCora("multi_part", { subquestionTypes: ["mcq", "circuit_submission"] }), true)
  })
})
