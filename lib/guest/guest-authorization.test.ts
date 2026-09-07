/**
 * Guest authorization + lifetime product tests (no DB).
 * Run: npx tsx --test lib/guest/guest-authorization.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { guestHasCapability, capabilitiesForGuestPlan, GUEST_FREE_CAPABILITIES } from "./capabilities"
import { isDeniedGuestCoraIntent, GUEST_CORA_DENIED_PREFIXES, guestCoraToolsForCapabilities } from "../cora/agent/guest-clearances"
import { getGuestAccessPlan, GUEST_CORA_CREDIT_PACKS, listGuestAccessPlans } from "./membership-config"
import { CAREER_MEMBER_FREE_PLAN } from "./display"
import { studentCanDownloadPdf } from "../recommendation-delivery"
import { guestCoraChatAllowed } from "./cora-usage"

describe("guest capabilities", () => {
  it("Career Member Free always includes free recommendation access", () => {
    const caps = capabilitiesForGuestPlan("guest_free")
    assert.equal(guestHasCapability(caps, "recommendations.request"), true)
    assert.equal(guestHasCapability(caps, "career.cora"), false)
  })

  it("Cora Career adds premium without removing free recs", () => {
    const caps = capabilitiesForGuestPlan("cora_career")
    for (const c of GUEST_FREE_CAPABILITIES) {
      assert.equal(guestHasCapability(caps, c), true)
    }
    assert.equal(guestHasCapability(caps, "career.cora"), true)
  })

  it("Essentials unlocks core career tools", () => {
    const caps = capabilitiesForGuestPlan("cora_career_essentials")
    assert.equal(guestHasCapability(caps, "career.cora"), true)
    assert.equal(guestHasCapability(caps, "career.interview"), false)
  })

  it("Lifetime adds interview prep", () => {
    const caps = capabilitiesForGuestPlan("cora_career")
    assert.equal(guestHasCapability(caps, "career.interview"), true)
  })
})

describe("guest product config", () => {
  it("three tiers: free, essentials, lifetime", () => {
    assert.equal(getGuestAccessPlan("guest_free").coraCreditsIncluded, 50)
    assert.equal(getGuestAccessPlan("cora_career_essentials").priceUsd, 19.99)
    assert.equal(getGuestAccessPlan("cora_career_essentials").coraCreditsIncluded, 2000)
    assert.equal(getGuestAccessPlan("cora_career").priceUsd, 39.99)
    assert.equal(getGuestAccessPlan("cora_career").coraCreditsIncluded, 5000)
    assert.equal(listGuestAccessPlans().length, 3)
    assert.equal(getGuestAccessPlan("guest_free").displayName, CAREER_MEMBER_FREE_PLAN)
  })

  it("guest credit packs are conservative vs student packs", () => {
    assert.equal(GUEST_CORA_CREDIT_PACKS.length, 4)
    assert.equal(GUEST_CORA_CREDIT_PACKS.find((p) => p.id === "application_pack")?.credits, 600)
    assert.equal(GUEST_CORA_CREDIT_PACKS.find((p) => p.id === "power_pack")?.credits, 2750)
    assert.equal(GUEST_CORA_CREDIT_PACKS.find((p) => p.id === "application_pack")?.popular, true)
  })
})

describe("guest Cora guardrails", () => {
  it("blocks grades and student letter generation", () => {
    assert.equal(isDeniedGuestCoraIntent("Show me my quiz grades"), true)
    assert.equal(isDeniedGuestCoraIntent("Help me prepare for a software engineering interview"), false)
    assert.ok(GUEST_CORA_DENIED_PREFIXES.includes("admin."))
  })

  it("maps capabilities to guest tools", () => {
    const freeTools = guestCoraToolsForCapabilities(GUEST_FREE_CAPABILITIES)
    assert.ok(freeTools.includes("generate_guest_recommendation_brief"))
    const careerTools = guestCoraToolsForCapabilities(capabilitiesForGuestPlan("cora_career"))
    assert.ok(careerTools.includes("prepare_guest_interview"))
  })

  it("allows free brief chat without career", () => {
    const access = guestCoraChatAllowed({
      capabilities: GUEST_FREE_CAPABILITIES,
      message: "Help me prepare my recommendation brief for graduate school",
    })
    assert.equal(access.allowed, true)
    assert.equal(access.creditFree, true)
  })
})

describe("delivery privacy", () => {
  it("withholds PDF for confidential modes", () => {
    assert.equal(studentCanDownloadPdf("confidential", "finalized"), false)
    assert.equal(studentCanDownloadPdf("student_download", "finalized"), true)
  })
})
