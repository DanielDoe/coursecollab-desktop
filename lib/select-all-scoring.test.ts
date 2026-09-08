/**
 * Run: npx tsx --test lib/select-all-scoring.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  scoreSelectAllQuestion,
  selectAllAnswersMatch,
} from "./select-all-scoring"

const CORRECT = ["A", "B", "C"]
const MAX = 10

describe("scoreSelectAllQuestion", () => {
  it("awards full credit only on exact match", () => {
    const result = scoreSelectAllQuestion(["A", "B", "C"], CORRECT, MAX)
    assert.equal(result.isFullyCorrect, true)
    assert.equal(result.points, 10)
    assert.equal(result.fraction, 1)
    assert.equal(selectAllAnswersMatch(CORRECT, ["C", "A", "B"]), true)
  })

  it("awards partial credit when a correct option is missed", () => {
    const result = scoreSelectAllQuestion(["A", "B"], CORRECT, MAX)
    assert.equal(result.isFullyCorrect, false)
    assert.equal(result.points, 6.67)
    assert.equal(result.correctSelected, 2)
    assert.equal(result.incorrectSelected, 0)
  })

  it("deducts for a correct set plus an incorrect option", () => {
    const result = scoreSelectAllQuestion(["A", "B", "C", "D"], CORRECT, MAX)
    assert.equal(result.isFullyCorrect, false)
    assert.equal(result.points, 6.67)
    assert.equal(result.correctSelected, 3)
    assert.equal(result.incorrectSelected, 1)
  })

  it("does not award full credit when every option is selected", () => {
    const result = scoreSelectAllQuestion(["A", "B", "C", "D", "E"], CORRECT, MAX)
    assert.equal(result.isFullyCorrect, false)
    assert.equal(result.points, 3.33)
    assert.ok(result.points < MAX)
  })

  it("scores zero when no options are selected", () => {
    const result = scoreSelectAllQuestion([], CORRECT, MAX)
    assert.equal(result.isFullyCorrect, false)
    assert.equal(result.points, 0)
    assert.equal(result.correctSelected, 0)
  })

  it("scores zero when every selection is incorrect", () => {
    const result = scoreSelectAllQuestion(["D", "E"], CORRECT, MAX)
    assert.equal(result.isFullyCorrect, false)
    assert.equal(result.points, 0)
    assert.equal(result.incorrectSelected, 2)
  })

  it("clamps a net-negative raw score to 0", () => {
    const result = scoreSelectAllQuestion(["A", "D", "E"], CORRECT, MAX)
    assert.equal(result.points, 0)
    assert.equal(result.isFullyCorrect, false)
  })
})
