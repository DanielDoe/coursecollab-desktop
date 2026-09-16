/**
 * Run: npx tsx --test lib/retake-utils-remaining.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"

/** Mirrors canRetakeAssessment regular-path retake remaining math. */
function retakesRemaining(effectiveLimit: number, completedAttempts: number): number {
  const retakesAllowed = Math.max(0, effectiveLimit)
  const retakesUsed = Math.max(0, completedAttempts - 1)
  return Math.max(0, retakesAllowed - retakesUsed)
}

function canStillAttempt(effectiveLimit: number, completedAttempts: number): boolean {
  const total = effectiveLimit + 1
  return completedAttempts < total
}

describe("retake remaining (membership overwrite of quiz limit 0)", () => {
  it("shows 0 retakes before first attempt when quiz+membership grant none", () => {
    assert.equal(retakesRemaining(0, 0), 0)
    assert.equal(canStillAttempt(0, 0), true)
  })

  it("shows Explorer 1 retake before and after first submit", () => {
    assert.equal(retakesRemaining(1, 0), 1)
    assert.equal(retakesRemaining(1, 1), 1)
    assert.equal(retakesRemaining(1, 2), 0)
    assert.equal(canStillAttempt(1, 2), false)
  })

  it("shows Trailblazer 2 retakes", () => {
    assert.equal(retakesRemaining(2, 0), 2)
    assert.equal(retakesRemaining(2, 1), 2)
    assert.equal(retakesRemaining(2, 2), 1)
    assert.equal(retakesRemaining(2, 3), 0)
  })
})
