/**
 * Institution Cora metering is capped — never unlimited.
 * Run: npx tsx --test lib/institutions/cora-spend.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  institutionDebitApplied,
  shouldSkipPersonalCoraDeduct,
  studentSpendableCredits,
} from "./cora-spend"

describe("institution Cora spend policy", () => {
  it("does not treat a no-op UPDATE as institution paid", () => {
    assert.equal(institutionDebitApplied(0), false)
    assert.equal(institutionDebitApplied(1), true)
  })

  it("never skips the student monthly ledger when institution cover applies", () => {
    assert.equal(shouldSkipPersonalCoraDeduct(true), false)
    assert.equal(shouldSkipPersonalCoraDeduct(false), false)
  })

  it("uses the personal monthly cap when the campus pool is huge", () => {
    assert.equal(
      studentSpendableCredits(7500, { included: 250_000, used: 10, remaining: 249_990 }),
      7500,
    )
  })

  it("caps spendable credits when the campus pool is the tighter limit", () => {
    assert.equal(
      studentSpendableCredits(7500, { included: 250_000, used: 249_980, remaining: 20 }),
      20,
    )
  })

  it("does not zero out personal credits when no pool or empty allowance is configured", () => {
    assert.equal(studentSpendableCredits(7500, null), 7500)
    assert.equal(studentSpendableCredits(7500, { included: 0, used: 0, remaining: 0 }), 7500)
  })
})
