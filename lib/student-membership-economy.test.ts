import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  MEMBERSHIP_PLANS,
  LEGACY_STUDENT_SEMESTER_PRICE_CENTS,
  getStudentMembershipPlan,
} from "@/lib/membership-constants"
import {
  STUDENT_CORA_MONTHLY,
  CORA_CREDITS_PER_USD,
  CORA_LOW_BALANCE_FRACTION,
  CORA_CRITICAL_BALANCE_FRACTION,
  tokensToCoraCredits,
  isCoraLiteEligible,
} from "@/lib/cora/credits/economy"
import { STUDENT_CORA_PACKS } from "@/lib/cora/credits/packs"
import { listStudentPlanCards, formatSemesterPrice } from "@/lib/student-membership-catalog"

describe("student membership catalog", () => {
  it("prices Explorer and Trailblazer as semester one-time amounts", () => {
    assert.equal(getStudentMembershipPlan("Explorer").semesterPriceInCents, 1999)
    assert.equal(getStudentMembershipPlan("Trailblazer").semesterPriceInCents, 3999)
    assert.equal(getStudentMembershipPlan("Scholar").priceInCents, 0)
    assert.equal(LEGACY_STUDENT_SEMESTER_PRICE_CENTS.Explorer, 2499)
    assert.equal(LEGACY_STUDENT_SEMESTER_PRICE_CENTS.Trailblazer, 3999)
  })

  it("keeps monthly Cora allowances centralized", () => {
    assert.equal(STUDENT_CORA_MONTHLY.Scholar, 250)
    assert.equal(STUDENT_CORA_MONTHLY.Explorer, 3000)
    assert.equal(STUDENT_CORA_MONTHLY.Trailblazer, 7500)
    for (const plan of MEMBERSHIP_PLANS) {
      assert.equal(plan.features.aiTutor, STUDENT_CORA_MONTHLY[plan.id])
    }
  })

  it("does not advertise unlimited Cora", () => {
    const copy = MEMBERSHIP_PLANS.flatMap((p) => [
      p.description,
      ...p.highlights,
      ...p.secondaryBenefits,
    ]).join(" ")
    assert.equal(/unlimited cora/i.test(copy), false)
    assert.equal(/Unlock CodeBench with Explorer/i.test(copy), false)
  })

  it("does not paywall core CodeBench on Scholar", () => {
    const scholar = MEMBERSHIP_PLANS.find((p) => p.id === "Scholar")!
    assert.equal(scholar.features.codeBench, true)
    assert.equal(scholar.features.codeBenchCora, false)
    const copy = [scholar.description, ...scholar.highlights, ...scholar.secondaryBenefits].join(" ")
    assert.match(copy, /CodeBench/i)
  })

  it("exposes Cora-first card models from the same source of truth", () => {
    const cards = listStudentPlanCards()
    assert.equal(cards.length, 3)
    assert.equal(formatSemesterPrice(1999), "$19.99")
    assert.equal(cards.find((c) => c.id === "Trailblazer")?.popular, true)
    assert.equal(cards.find((c) => c.id === "Explorer")?.ctaLabel, "Get Explorer for $19.99")
    assert.equal(cards.find((c) => c.id === "Explorer")?.saveCents, 1000)
    assert.equal(cards.find((c) => c.id === "Trailblazer")?.listPriceInCents, 4999)
  })
})

describe("student Cora credit packs", () => {
  it("uses Study / Exam / Power pack pricing", () => {
    assert.deepEqual(
      STUDENT_CORA_PACKS.map((p) => [p.id, p.name, p.credits, p.priceInCents]),
      [
        ["student_1k", "Study Boost", 1000, 299],
        ["student_3k", "Exam Boost", 3000, 599],
        ["student_7_5k", "Power Pack", 7500, 1199],
      ],
    )
  })
})

describe("Cora economy", () => {
  it("pegs 1000 credits to $1 of provider cost", () => {
    assert.equal(CORA_CREDITS_PER_USD, 1000)
    assert.ok(tokensToCoraCredits({ model: "gpt-5.4-mini", inputTokens: 1000, outputTokens: 500 }) >= 5)
  })

  it("warns at 25% and 10%", () => {
    assert.equal(CORA_LOW_BALANCE_FRACTION, 0.25)
    assert.equal(CORA_CRITICAL_BALANCE_FRACTION, 0.1)
  })

  it("blocks expensive generation on Cora Lite", () => {
    assert.equal(isCoraLiteEligible("generate a quiz from lecture 4"), false)
    assert.equal(isCoraLiteEligible("what is the deadline for homework 3?"), true)
    assert.equal(isCoraLiteEligible("explain Kirchhoff's current law"), true)
  })
})
