/**
 * Run: npx tsx --test lib/cora/models/escalation.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { nextCoraEscalation } from "@/lib/cora/models/escalation"
import { shouldFallbackProvider } from "@/lib/cora/models/fallback"
import { routeCoraModel } from "@/lib/cora/models/router"
import { shouldVerifyTask } from "@/lib/cora/models/verification"

describe("escalation", () => {
  it("escalates standard → reasoning on schema failure", () => {
    const current = routeCoraModel({
      userRole: "instructor",
      portal: "faculty",
      message: "Create 5 practice questions",
      requiresTools: true,
    })
    const next = nextCoraEscalation({
      current,
      signal: "schema_validation_failed",
      escalationsUsed: 0,
    })
    assert.ok(next)
    assert.equal(next!.profile, "reasoning")
  })

  it("stops after max escalations", () => {
    const next = nextCoraEscalation({
      current: "reasoning",
      signal: "verifier_rejected",
      escalationsUsed: 2,
    })
    assert.equal(next, null)
  })

  it("ignores model self-reported confidence", () => {
    const next = nextCoraEscalation({
      current: "standard",
      signal: "I am not confident",
      escalationsUsed: 0,
    })
    assert.equal(next, null)
  })

  it("does not escalate in Lite", () => {
    const next = nextCoraEscalation({
      current: "lite",
      signal: "schema_validation_failed",
      escalationsUsed: 0,
      liteMode: true,
    })
    assert.equal(next, null)
  })
})

describe("fallback vs application outcomes", () => {
  it("fallbacks on timeout and rate limit", () => {
    assert.equal(shouldFallbackProvider({ errorCode: "timeout" }), true)
    assert.equal(shouldFallbackProvider({ errorCode: "429" }), true)
  })

  it("does not fallback on permission or credits", () => {
    assert.equal(shouldFallbackProvider({ errorCode: "permission_denied" }), false)
    assert.equal(shouldFallbackProvider({ errorCode: "INSUFFICIENT_CORA_CREDITS" }), false)
  })

  it("does not fallback twice", () => {
    assert.equal(shouldFallbackProvider({ errorCode: "timeout", fallbackAlreadyUsed: true }), false)
  })
})

describe("verification", () => {
  it("does not verify routine chat", () => {
    assert.equal(
      shouldVerifyTask({
        userRole: "student",
        portal: "student",
        message: "What is Ohm's law?",
      }),
      false,
    )
  })
})
