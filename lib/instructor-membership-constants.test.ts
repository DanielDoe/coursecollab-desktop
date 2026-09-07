import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  INSTRUCTOR_MEMBERSHIP_PLANS,
  normalizeInstructorMembershipTier,
  isLegacyInstructorEnterpriseTier,
  getInstructorMembershipPlan,
} from "@/lib/instructor-membership-constants"
import {
  instructorPeriodAllocation,
  INSTRUCTOR_CORA_SEMESTER,
  INSTRUCTOR_CORA_ANNUAL,
  LEGACY_INSTRUCTOR_ENTERPRISE_CORA_SEMESTER,
  LEGACY_INSTRUCTOR_ENTERPRISE_CORA_ANNUAL,
} from "@/lib/cora/credits/economy"
import { instructorTierRank, resolveHighestInstructorTier } from "@/lib/instructor-membership"

describe("instructor Teams rename", () => {
  it("normalizes legacy Enterprise aliases to Teams", () => {
    assert.equal(normalizeInstructorMembershipTier("Enterprise"), "Teams")
    assert.equal(normalizeInstructorMembershipTier("enterprise"), "Teams")
    assert.equal(normalizeInstructorMembershipTier("instructor_enterprise"), "Teams")
    assert.equal(normalizeInstructorMembershipTier("Teams"), "Teams")
    assert.equal(isLegacyInstructorEnterpriseTier("Enterprise"), true)
    assert.equal(isLegacyInstructorEnterpriseTier("Teams"), false)
  })

  it("exposes public catalog as Free / Pro / Teams", () => {
    assert.deepEqual(
      INSTRUCTOR_MEMBERSHIP_PLANS.map((p) => p.id),
      ["Free", "Pro", "Teams"],
    )
    const teams = getInstructorMembershipPlan("Teams")
    assert.equal(teams.displayName, "Instructor Teams")
    assert.equal(teams.semesterPriceInCents, 19900)
    assert.equal(teams.annualPriceInCents, 49900)
    assert.equal(teams.features.teachingAssistantManagement, true)
    assert.equal(teams.features.multipleInstructors, true)
    assert.equal(teams.features.accreditationReportGeneration, false)
    assert.equal(teams.features.institutionalAssessmentReports, false)
    assert.equal(teams.features.crossCourseAnalytics, false)
    assert.equal(teams.features.coraCreditsPerPeriod, 15000)
  })

  it("ranks Teams above Pro and aliases Enterprise at write-time", () => {
    assert.equal(instructorTierRank("Teams") > instructorTierRank("Pro"), true)
    assert.equal(resolveHighestInstructorTier("Pro", "Teams"), "Teams")
    assert.equal(resolveHighestInstructorTier("Teams", "Pro"), "Teams")
  })

  it("grandfathers stored Enterprise Cora allocations", () => {
    assert.equal(INSTRUCTOR_CORA_SEMESTER.Teams, INSTRUCTOR_CORA_SEMESTER.Pro)
    assert.equal(INSTRUCTOR_CORA_ANNUAL.Teams, INSTRUCTOR_CORA_ANNUAL.Pro)
    assert.equal(instructorPeriodAllocation("Teams", "semester"), 15000)
    assert.equal(instructorPeriodAllocation("Teams", "annual"), 45000)
    assert.equal(instructorPeriodAllocation("Enterprise", "semester"), LEGACY_INSTRUCTOR_ENTERPRISE_CORA_SEMESTER)
    assert.equal(instructorPeriodAllocation("enterprise", "annual"), LEGACY_INSTRUCTOR_ENTERPRISE_CORA_ANNUAL)
  })
})
