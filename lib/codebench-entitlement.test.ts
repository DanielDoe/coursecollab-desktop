import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { MEMBERSHIP_PLANS } from "@/lib/membership-constants"
import {
  studentTierHasCodeBenchAccess,
  studentTierHasCodeBenchCoraAccess,
} from "@/lib/codebench-entitlement-client"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..")

function readSrc(rel: string) {
  return readFileSync(join(repo, rel), "utf8")
}

describe("student CodeBench entitlement", () => {
  it("grants core CodeBench to Scholar, Explorer, and Trailblazer", () => {
    assert.equal(studentTierHasCodeBenchAccess("Scholar"), true)
    assert.equal(studentTierHasCodeBenchAccess("Explorer"), true)
    assert.equal(studentTierHasCodeBenchAccess("Trailblazer"), true)
    assert.equal(studentTierHasCodeBenchAccess(null), true)
  })

  it("gates CodeBench Cora to Explorer, Trailblazer, and institutional equivalents", () => {
    assert.equal(studentTierHasCodeBenchCoraAccess("Scholar"), false)
    assert.equal(studentTierHasCodeBenchCoraAccess("Explorer"), true)
    assert.equal(studentTierHasCodeBenchCoraAccess("Trailblazer"), true)
    assert.equal(studentTierHasCodeBenchCoraAccess(null), false)
  })

  it("keeps plan features as the catalog source of truth", () => {
    assert.equal(MEMBERSHIP_PLANS.find((p) => p.id === "Scholar")?.features.codeBench, true)
    assert.equal(MEMBERSHIP_PLANS.find((p) => p.id === "Scholar")?.features.codeBenchCora, false)
    assert.equal(MEMBERSHIP_PLANS.find((p) => p.id === "Explorer")?.features.codeBench, true)
    assert.equal(MEMBERSHIP_PLANS.find((p) => p.id === "Explorer")?.features.codeBenchCora, true)
    assert.equal(MEMBERSHIP_PLANS.find((p) => p.id === "Trailblazer")?.features.codeBench, true)
    assert.equal(MEMBERSHIP_PLANS.find((p) => p.id === "Trailblazer")?.features.codeBenchCora, true)
  })

  it("does not lock the student sidebar CodeBench item behind Trailblazer", () => {
    const src = readSrc("components/student/dashboard-v2/Sidebar.tsx")
    assert.match(src, /id: "codebench"/)
    assert.doesNotMatch(src, /id: "codebench"[\s\S]{0,160}minTier: "Trailblazer"/)
    assert.doesNotMatch(src, /id: "codebench"[\s\S]{0,160}minTier: "Explorer"/)
  })

  it("keeps dedicated CodeBench Cora APIs on requireCodebenchCoraStudent", () => {
    const coraRoutes = [
      "app/api/explain/route.ts",
      "app/api/debug/route.ts",
      "app/api/improve/route.ts",
      "app/api/pseudocode/route.ts",
      "app/api/codebench/replay/route.ts",
      "app/api/codebench/analyze/route.ts",
      "app/api/codebench/style-review/route.ts",
      "app/api/codebench/evaluate/route.ts",
      "app/api/codebench/what-if/route.ts",
    ]
    for (const rel of coraRoutes) {
      assert.match(readSrc(rel), /requireCodebenchCoraStudent/, rel)
    }
  })

  it("keeps core CodeBench APIs free of Cora membership auth", () => {
    const coreRoutes = [
      "app/api/compile/route.ts",
      "app/api/codebench/live-sessions/route.ts",
      "app/api/codebench/daily-challenge/route.ts",
      "app/api/codebench/daily-challenge/submit/route.ts",
      "app/api/codebench/leaderboard/route.ts",
      "app/api/codebench/streak/route.ts",
    ]
    for (const rel of coreRoutes) {
      const src = readSrc(rel)
      assert.match(src, /requireCodebenchStudent/, rel)
      assert.doesNotMatch(src, /requireCodebenchCoraStudent/, rel)
    }
  })
})
