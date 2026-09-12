import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { retakeBlockedForMissingMembership } from "./retake-access-policy"

describe("retakeBlockedForMissingMembership", () => {
  it("does not upgrade-gate instructor-only courses, even for Scholar", () => {
    assert.equal(retakeBlockedForMissingMembership(false, false), false)
  })

  it("lets Explorer / Trailblazer / donation through when membership perks are on", () => {
    assert.equal(retakeBlockedForMissingMembership(true, true), false)
  })

  it("upgrade-gates Scholar when the course uses membership assessment perks", () => {
    assert.equal(retakeBlockedForMissingMembership(true, false), true)
  })
})
