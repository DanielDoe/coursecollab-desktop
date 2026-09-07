import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  isEntitlementActive,
  pickHighestEntitlement,
  toFeatureAccessResult,
} from "@/lib/entitlements/merge"
import type { ResolvedEntitlement } from "@/lib/entitlements/types"
import { membershipMayEnhanceAttempts } from "@/lib/entitlements/assessment-attempts"

function ent(partial: Partial<ResolvedEntitlement>): ResolvedEntitlement {
  return {
    entitlementId: partial.entitlementId ?? "e1",
    scopeType: partial.scopeType ?? "user",
    entitlementType: partial.entitlementType ?? "personal_student_tier",
    entitlementSource: partial.entitlementSource ?? "personal_purchase",
    featureBundle: partial.featureBundle ?? "student_explorer",
    status: partial.status ?? "active",
    validUntil: partial.validUntil ?? null,
    ...partial,
  }
}

describe("entitlement merge", () => {
  it("keeps expired institution from overriding a valid personal purchase", () => {
    const highest = pickHighestEntitlement([
      ent({
        entitlementId: "inst",
        entitlementType: "institution_student_access",
        entitlementSource: "institution",
        featureBundle: "institution_student_access",
        validUntil: "2020-01-01T00:00:00.000Z",
      }),
      ent({
        entitlementId: "personal",
        entitlementType: "personal_student_tier",
        entitlementSource: "personal_purchase",
        featureBundle: "student_explorer",
        validUntil: "2099-12-20T00:00:00.000Z",
      }),
    ])
    assert.equal(highest?.entitlementId, "personal")
  })

  it("uses institution over a lower personal tier while both are active", () => {
    const result = toFeatureAccessResult(
      [
        ent({
          entitlementType: "institution_student_access",
          entitlementSource: "institution",
          featureBundle: "institution_student_access",
          institutionId: 7,
          licenseId: 3,
          metadata: { providedBy: "Prairie View A&M University" },
        }),
        ent({
          entitlementType: "personal_student_tier",
          featureBundle: "student_explorer",
        }),
      ],
      "Explorer",
    )
    assert.equal(result.allowed, true)
    assert.equal(result.source, "institution")
    assert.equal(result.personalTier, "Explorer")
    assert.equal(result.institutionalEntitlement, "institution_student_access")
    assert.equal(result.providedBy, "Prairie View A&M University")
  })

  it("ignores revoked rows", () => {
    assert.equal(
      isEntitlementActive(ent({ status: "revoked", featureBundle: "institution_student_access" })),
      false,
    )
  })
})

describe("assessment attempt lanes", () => {
  it("blocks graded membership perks under instructor_only", () => {
    assert.equal(membershipMayEnhanceAttempts("graded_assessment", false), false)
    assert.equal(membershipMayEnhanceAttempts("graded_assessment", true), true)
    assert.equal(membershipMayEnhanceAttempts("practice", false), true)
    assert.equal(membershipMayEnhanceAttempts("playground", false), true)
  })
})
