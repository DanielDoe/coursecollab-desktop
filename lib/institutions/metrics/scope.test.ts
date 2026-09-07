import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  buildComparison,
  formatWeekLabel,
  licenseUtilizationStatus,
  parsePgDateOnly,
  resolveDateRange,
} from "@/lib/institutions/metrics/scope"
import { workflowMinutesSaved } from "@/lib/institutions/metrics/queries"

describe("institution metrics scope", () => {
  it("builds comparison labels", () => {
    assert.equal(buildComparison(10, 0).changeLabel, "new")
    assert.equal(buildComparison(11, 10).changePercent, 10)
    assert.equal(buildComparison(9, 10).changeLabel, "down")
  })

  it("resolves last 30 days preset", () => {
    const range = resolveDateRange({ preset: "last_30_days", to: "2026-08-26" })
    assert.equal(range.from, "2026-07-28")
    assert.equal(range.to, "2026-08-26")
  })

  it("normalizes postgres week dates for chart labels", () => {
    assert.equal(parsePgDateOnly(new Date("2026-04-28T00:00:00.000Z")), "2026-04-28")
    assert.equal(parsePgDateOnly("2026-04-28"), "2026-04-28")
    assert.equal(formatWeekLabel("2026-04-28"), "Apr 28")
  })

  it("maps license utilization thresholds", () => {
    assert.equal(licenseUtilizationStatus(65).status, "normal")
    assert.equal(licenseUtilizationStatus(88).status, "approaching")
    assert.equal(licenseUtilizationStatus(96).status, "capacity_warning")
  })
})

describe("workflowAssistanceProxy", () => {
  it("maps product workflows to coarse proxies", async () => {
    const { workflowAssistanceProxy } = await import("@/lib/institutions/metrics/phase2")
    assert.equal(workflowAssistanceProxy("cora_agent"), "Conversation")
    assert.equal(workflowAssistanceProxy("auto_grading"), "Assessment feedback")
    assert.equal(workflowAssistanceProxy("unknown_xyz"), "Other")
  })
})

describe("phase3 policy labels", () => {
  it("pretty-prints AI policy tags", async () => {
    const { policyLabel } = await import("@/lib/institutions/metrics/phase3")
    assert.equal(policyLabel("AI_RESTRICTED"), "AI restricted")
    assert.equal(policyLabel("independent_check"), "Independent check")
  })
})

describe("workflowMinutesSaved", () => {
  it("maps grading workflows", () => {
    assert.equal(workflowMinutesSaved("auto_grading"), 3)
    assert.equal(workflowMinutesSaved("unknown"), 7)
  })
})

describe("research descriptive stats", () => {
  it("suppresses stats below the cell minimum", async () => {
    const { descriptiveStats, groupContrast } = await import("@/lib/institutions/research/stats")
    const small = descriptiveStats([1, 2, 3])
    assert.equal(small.insufficient, true)
    assert.equal(small.mean, null)
    const a = Array.from({ length: 10 }, (_, i) => 70 + i)
    const b = Array.from({ length: 10 }, (_, i) => 50 + i)
    const A = descriptiveStats(a)
    assert.equal(A.insufficient, false)
    assert.equal(A.n, 10)
    const c = groupContrast(a, b)
    assert.equal(c.available, true)
    assert.ok((c.meanDiff ?? 0) > 0)
    assert.match(c.note, /not a causal estimate/i)
  })

  it("escapes CSV fields", async () => {
    const { toCsv } = await import("@/lib/institutions/research/stats")
    const csv = toCsv(["name", "note"], [["A, B", 'say "hi"']])
    assert.equal(csv.split("\n")[1], '"A, B","say ""hi"""')
  })
})

describe("phase5 pathway and windows", () => {
  it("formats paths and buckets delay", async () => {
    const { formatPathway, windowForDays } = await import("@/lib/institutions/metrics/phase5")
    assert.equal(formatPathway(["practice", "cora", "assessment"]), "practice → cora → assessment")
    assert.equal(windowForDays(3)?.key, "d0_7")
    assert.equal(windowForDays(14)?.key, "d8_14")
    assert.equal(windowForDays(30)?.key, "d29_60")
    assert.equal(windowForDays(90), null)
  })
})

describe("end-goal questions", () => {
  it("lists all 17 mission questions", async () => {
    const { END_GOAL_QUESTIONS } = await import("@/lib/institutions/research/end-goal-questions")
    assert.equal(END_GOAL_QUESTIONS.length, 17)
    assert.ok(END_GOAL_QUESTIONS.some((q) => /persist when AI is removed/i.test(q.question)))
    assert.ok(END_GOAL_QUESTIONS.some((q) => /export for rigorous statistical analysis/i.test(q.question)))
  })
})
