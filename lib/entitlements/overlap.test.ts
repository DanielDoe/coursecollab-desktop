import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { pickHighestEntitlement } from "@/lib/entitlements/merge"
import type { ResolvedEntitlement } from "@/lib/entitlements/types"
import { membershipMayEnhanceAttempts } from "@/lib/entitlements/assessment-attempts"

function ent(partial: Partial<ResolvedEntitlement>): ResolvedEntitlement {
  return {
    entitlementId: "x",
    scopeType: "user",
    entitlementType: "personal_student_tier",
    entitlementSource: "personal_purchase",
    featureBundle: "student_scholar",
    status: "active",
    ...partial,
  }
}

describe("entitlement overlap", () => {
  it("keeps personal Explorer when institution expires", () => {
    const highest = pickHighestEntitlement([
      ent({
        entitlementId: "inst",
        entitlementType: "institution_student_access",
        entitlementSource: "institution",
        featureBundle: "institution_student_access",
        status: "expired",
      }),
      ent({
        entitlementId: "personal",
        featureBundle: "student_explorer",
        validUntil: "2099-12-20T00:00:00.000Z",
      }),
    ])
    assert.equal(highest?.entitlementId, "personal")
  })

  it("uses valid institution when personal Explorer is expired", () => {
    const highest = pickHighestEntitlement([
      ent({
        entitlementId: "inst",
        entitlementType: "institution_student_access",
        entitlementSource: "institution",
        featureBundle: "institution_student_access",
      }),
      ent({
        entitlementId: "personal",
        featureBundle: "student_explorer",
        status: "expired",
      }),
    ])
    assert.equal(highest?.entitlementId, "inst")
  })

  it("lets trial coexist without deleting personal rows", () => {
    const rows = [
      ent({ entitlementId: "personal", featureBundle: "student_explorer" }),
      ent({
        entitlementId: "trial",
        entitlementType: "trial_trailblazer",
        entitlementSource: "trial",
        featureBundle: "student_trailblazer",
      }),
    ]
    assert.equal(pickHighestEntitlement(rows)?.entitlementId, "trial")
    assert.equal(rows.some((r) => r.entitlementId === "personal"), true)
  })
})

describe("graded attempts vs membership", () => {
  it("never lets paid or institutional access auto-grant graded extra attempts", () => {
    assert.equal(membershipMayEnhanceAttempts("graded_assessment", false), false)
  })
})
