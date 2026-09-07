import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  INSTITUTION_PLANS,
  INSTITUTION_PRICING_VERSION,
  getInstitutionPlan,
  institutionPlanAllowsSelfService,
  institutionPlanHasFeature,
  publicInstitutionPriceLabel,
} from "@/lib/institution-plans"
import {
  applyInstitutionDiscount,
  calculateContractValues,
  calculateRetailEquivalent,
  catalogPricingAnalysis,
  effectiveAnnualPricePerStudentCents,
  snapshotPlanCommercialTerms,
} from "@/lib/institutional-pricing"
import { institutionLearnerIdentityKey, isExcludedInstitutionLearner } from "@/lib/institutions/active-learner-definition"
import { coraUsageAlerts } from "@/lib/institutions/cora-alerts"

describe("institutional plan catalog v2", () => {
  it("uses revised list prices and capacities", () => {
    assert.equal(getInstitutionPlan("course_pilot")?.annualListPriceCents, 950_000)
    assert.equal(getInstitutionPlan("course_pilot")?.studentCapacity, 125)
    assert.equal(getInstitutionPlan("course_pilot")?.instructorCapacity, 3)
    assert.equal(getInstitutionPlan("program")?.annualListPriceCents, 1_850_000)
    assert.equal(getInstitutionPlan("program")?.studentCapacity, 250)
    assert.equal(getInstitutionPlan("department")?.annualListPriceCents, 2_950_000)
    assert.equal(getInstitutionPlan("department")?.studentCapacity, 500)
    assert.equal(getInstitutionPlan("department_plus")?.annualListPriceCents, 4_950_000)
    assert.equal(getInstitutionPlan("college")?.annualListPriceCents, 8_950_000)
    assert.equal(getInstitutionPlan("college")?.quoteOnly, true)
    assert.equal(getInstitutionPlan("college_plus")?.annualListPriceCents, 14_950_000)
    assert.equal(getInstitutionPlan("university_enterprise")?.annualListPriceCents, null)
    assert.equal(INSTITUTION_PLANS.filter((p) => p.active).length, 7)
    assert.equal(INSTITUTION_PRICING_VERSION, 2)
  })

  it("aliases legacy enterprise to university_enterprise", () => {
    const enterprise = getInstitutionPlan("enterprise")
    assert.equal(enterprise?.planKey, "university_enterprise")
    assert.equal(enterprise?.selfServiceEligible, false)
    assert.equal(enterprise?.quoteOnly, true)
    assert.equal(institutionPlanAllowsSelfService("enterprise"), false)
    assert.equal(institutionPlanHasFeature("enterprise", "sso"), true)
  })

  it("allows Stripe self-service only for course_pilot and program", () => {
    assert.equal(institutionPlanAllowsSelfService("course_pilot"), true)
    assert.equal(institutionPlanAllowsSelfService("program"), true)
    assert.equal(institutionPlanAllowsSelfService("department"), false)
    assert.equal(institutionPlanAllowsSelfService("college"), false)
    assert.equal(institutionPlanAllowsSelfService("college_plus"), false)
  })

  it("does not put SSO on program; keeps teaching tools on Course Pilot", () => {
    assert.equal(institutionPlanHasFeature("program", "practice_hub"), true)
    assert.equal(institutionPlanHasFeature("program", "sso"), false)
    assert.equal(institutionPlanHasFeature("course_pilot", "practice_hub"), true)
    assert.equal(institutionPlanHasFeature("course_pilot", "codebench"), true)
  })

  it("formats customer-facing prices from catalog cents", () => {
    assert.equal(publicInstitutionPriceLabel(getInstitutionPlan("course_pilot")!), "Starting from $9,500 / year")
    assert.equal(publicInstitutionPriceLabel(getInstitutionPlan("program")!), "Starting from $18,500 / year")
    assert.equal(publicInstitutionPriceLabel(getInstitutionPlan("department")!), "Starting from $29,500 / year")
    assert.equal(publicInstitutionPriceLabel(getInstitutionPlan("department_plus")!), "Contact us for a quote")
    assert.equal(publicInstitutionPriceLabel(getInstitutionPlan("college")!), "Contact us for a quote")
    assert.equal(publicInstitutionPriceLabel(getInstitutionPlan("college_plus")!), "Contact us for a quote")
    assert.equal(publicInstitutionPriceLabel(getInstitutionPlan("university_enterprise")!), "Custom")
  })

  it("lists perks for every catalog plan", () => {
    for (const plan of INSTITUTION_PLANS) {
      assert.ok(plan.includedPerks.length >= 8, plan.planKey)
    }
    assert.ok(getInstitutionPlan("course_pilot")?.includedPerks.includes("Practice Hub"))
  })
})

describe("retail equivalent calculator", () => {
  it("matches the 100 Trailblazer + 1 Pro × 2 semesters example", () => {
    const result = calculateRetailEquivalent({
      studentCount: 100,
      instructorCount: 1,
      semesters: 2,
      studentTier: "Trailblazer",
      instructorTier: "Pro",
    })
    assert.equal(result.studentRetailCents, 799_800)
    assert.equal(result.instructorRetailCents, 19_800)
    assert.equal(result.totalRetailCents, 819_600)
  })

  it("matches Course Pilot 125 students + 3 Pro × 2 semesters as analysis only", () => {
    const result = calculateRetailEquivalent({
      studentCount: 125,
      instructorCount: 3,
      semesters: 2,
      studentTier: "Trailblazer",
      instructorTier: "Pro",
    })
    assert.equal(result.totalRetailCents, 1_059_150)
  })
})

describe("volume discount curve", () => {
  it("computes effective annual price per max student from catalog", () => {
    assert.equal(effectiveAnnualPricePerStudentCents(getInstitutionPlan("course_pilot")!), 7_600)
    assert.equal(effectiveAnnualPricePerStudentCents(getInstitutionPlan("program")!), 7_400)
    assert.equal(effectiveAnnualPricePerStudentCents(getInstitutionPlan("department")!), 5_900)
    assert.equal(effectiveAnnualPricePerStudentCents(getInstitutionPlan("department_plus")!), 4_950)
    assert.equal(effectiveAnnualPricePerStudentCents(getInstitutionPlan("college")!), 3_580)
    assert.equal(effectiveAnnualPricePerStudentCents(getInstitutionPlan("college_plus")!), 2_990)
    assert.equal(effectiveAnnualPricePerStudentCents(getInstitutionPlan("university_enterprise")!), null)
  })

  it("does not bake assumed instructor counts into catalog economics", () => {
    for (const row of catalogPricingAnalysis()) {
      assert.equal("assumedInstructors" in row, false)
    }
  })
})

describe("discounts and contract snapshots", () => {
  it("applies founding-partner 10% on Program list server-side", () => {
    const priced = applyInstitutionDiscount({
      listPriceCents: 1_850_000,
      discountType: "percentage",
      discountValue: 10,
    })
    assert.equal(priced.negotiatedPriceCents, 1_665_000)
    assert.equal(priced.discountCents, 185_000)
  })

  it("treats prepaid annual Program as ACV/ARR not monthly revenue", () => {
    const values = calculateContractValues({ negotiatedPriceCents: 1_850_000, contractTermMonths: 12 })
    assert.equal(values.cashCollectedCents, 1_850_000)
    assert.equal(values.annualContractValueCents, 1_850_000)
    assert.equal(values.arrContributionCents, 1_850_000)
    assert.equal(values.mrrEquivalentCents, 154_167)
  })

  it("snapshots commercial terms at current pricing version", () => {
    const snap = snapshotPlanCommercialTerms("program")
    assert.equal(snap.pricingVersion, 2)
    assert.equal(snap.listPriceCents, 1_850_000)
    assert.equal(snap.negotiatedPriceCents, 1_850_000)
    assert.equal(snap.billingPeriod, "annual")
  })
})

describe("active learners", () => {
  it("collapses the same email across courses into one identity", () => {
    assert.equal(
      institutionLearnerIdentityKey({ email: "Ada@University.edu", studentId: 1 }),
      institutionLearnerIdentityKey({ email: "ada@university.edu", studentId: 99 }),
    )
  })

  it("excludes deleted and demo accounts", () => {
    assert.equal(isExcludedInstitutionLearner({ deletedAt: "2026-01-01", studentId: 1 } as never), true)
    assert.equal(isExcludedInstitutionLearner({ email: "demo-p01@school.edu" }), true)
    assert.equal(isExcludedInstitutionLearner({ email: "student@university.edu" }), false)
  })
})

describe("cora alerts", () => {
  it("triggers 70/85/95/100 percent thresholds with integer math", () => {
    const alerts = coraUsageAlerts(1000, 850)
    assert.deepEqual(
      alerts.filter((a) => a.triggered).map((a) => a.threshold),
      [70, 85],
    )
  })
})
