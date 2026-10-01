import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { tradeCenterAssessmentBenefitsAllowed } from "./assessment-privilege-governance-shared"

describe("trade center assessment redemptions", () => {
  it("lets students trade points when membership perks are on, without requiring a membership", () => {
    assert.equal(tradeCenterAssessmentBenefitsAllowed("membership_enabled"), true)
    assert.equal(tradeCenterAssessmentBenefitsAllowed("hybrid"), true)
  })

  it("stays off when the instructor controls assessments only", () => {
    assert.equal(tradeCenterAssessmentBenefitsAllowed("instructor_only"), false)
  })
})
