/**
 * Run: npx tsx --test lib/cora/credits/period-reset.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  creditPeriodAction,
  shouldPersistMembershipTier,
  shouldRefillIncludedCredits,
} from "./period-reset"

describe("creditPeriodAction", () => {
  it("refills only when the stored period key actually changes", () => {
    assert.equal(creditPeriodAction("2026-08", "2026-09"), "period_reset")
    assert.equal(creditPeriodAction("2026-spring", "2026-fall"), "period_reset")
    assert.equal(shouldRefillIncludedCredits("2026-08", "2026-08"), false)
    assert.equal(shouldRefillIncludedCredits("2026-08", "2026-09"), true)
  })

  it("stamps a missing period key without refilling a spent balance", () => {
    assert.equal(creditPeriodAction(null, "2026-08"), "stamp_period")
    assert.equal(creditPeriodAction("", "2026-08"), "stamp_period")
    assert.equal(shouldRefillIncludedCredits(null, "2026-08"), false)
  })

  it("does not treat a Scholar ↔ Trailblazer flap as a period reset", () => {
    assert.equal(creditPeriodAction("2026-08", "2026-08"), "keep")
    assert.equal(shouldPersistMembershipTier("Scholar", "Trailblazer"), true)
    assert.equal(shouldPersistMembershipTier("Trailblazer", "Trailblazer"), false)
    assert.equal(shouldPersistMembershipTier("Scholar", null), false)
  })
})
