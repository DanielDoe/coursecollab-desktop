/**
 * Run: npx tsx --test lib/cora/ai/credit-reconcile.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  combinePeriodUsage,
  pickCanonicalIncluded,
  pickCanonicalLifetime,
  pickCanonicalPurchased,
} from "./credit-reconcile"

describe("combinePeriodUsage", () => {
  it("takes the most complete usage signal", () => {
    assert.equal(combinePeriodUsage([0, 16, 5, null]), 16)
    assert.equal(combinePeriodUsage([undefined, -4]), 0)
  })
})

describe("pickCanonicalIncluded", () => {
  it("writes a full allotment down to recorded period usage", () => {
    assert.equal(
      pickCanonicalIncluded({
        allocation: 7500,
        includedBalance: 7500,
        periodUsed: 16,
      }),
      7484,
    )
  })

  it("keeps a already-deducted pot when usage events are missing", () => {
    assert.equal(
      pickCanonicalIncluded({
        allocation: 7500,
        includedBalance: 7484,
        periodUsed: 0,
      }),
      7484,
    )
  })

  it("applies a lower same-period legacy remaining", () => {
    assert.equal(
      pickCanonicalIncluded({
        allocation: 7500,
        includedBalance: 7500,
        periodUsed: 0,
        legacyIncluded: 7484,
        legacyPeriodMatches: true,
      }),
      7484,
    )
  })

  it("ignores a stale higher legacy row from another period", () => {
    assert.equal(
      pickCanonicalIncluded({
        allocation: 7500,
        includedBalance: 7484,
        periodUsed: 16,
        legacyIncluded: 7500,
        legacyPeriodMatches: false,
      }),
      7484,
    )
  })

  it("never refills a spent pot", () => {
    assert.equal(
      pickCanonicalIncluded({
        allocation: 7500,
        includedBalance: 100,
        periodUsed: 0,
      }),
      100,
    )
  })
})

describe("pickCanonicalPurchased", () => {
  it("keeps pack purchases that only landed on one ledger", () => {
    assert.equal(pickCanonicalPurchased(0, 2000), 2000)
    assert.equal(pickCanonicalPurchased(2000, 0), 2000)
  })
})

describe("pickCanonicalLifetime", () => {
  it("uses the higher observed lifetime", () => {
    assert.equal(pickCanonicalLifetime(0, 16), 16)
    assert.equal(pickCanonicalLifetime(16, 5), 16)
  })
})
