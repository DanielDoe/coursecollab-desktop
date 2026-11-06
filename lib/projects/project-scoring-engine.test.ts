import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { computeProjectScoreBreakdown } from "@/lib/projects/project-scoring-engine"
import { legacyProjectGradingConfig } from "@/lib/projects/project-grading-config"

describe("computeProjectScoreBreakdown", () => {
  it("legacy peer + instructor totals match stored caps", () => {
    const breakdown = computeProjectScoreBreakdown(null, {
      student_points: 24,
      instructor_points: 16,
    })
    assert.equal(breakdown.legacy, true)
    assert.equal(breakdown.total_earned, 40)
    assert.equal(breakdown.max_points, 50)
  })

  it("instructor-only mode uses full weight", () => {
    const config = {
      ...legacyProjectGradingConfig(),
      grading_mode: "INSTRUCTOR_ONLY" as const,
      grading_components: [{ key: "instructor" as const, label: "Instructor", weight_percent: 100, enabled: true }],
      max_points: 100,
    }
    const breakdown = computeProjectScoreBreakdown(config, { instructor_points: 80 })
    assert.equal(breakdown.total_earned, 80)
    assert.equal(breakdown.max_points, 100)
  })
})
