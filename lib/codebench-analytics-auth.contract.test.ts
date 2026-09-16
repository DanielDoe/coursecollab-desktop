/**
 * Run: npx tsx --test lib/codebench-analytics-auth.contract.test.ts
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, "..")

const ANALYTICS_ROUTES = [
  "app/api/codebench/badges/route.ts",
  "app/api/codebench/streak/route.ts",
  "app/api/codebench/leaderboard/route.ts",
  "app/api/codebench/submissions/route.ts",
  "app/api/codebench/daily-challenge/route.ts",
  "app/api/codebench/analyze/route.ts",
  "app/api/codebench/learning-plan/route.ts",
  "app/api/codebench/analytics/route.ts",
] as const

function readRoute(rel: string) {
  return readFileSync(join(repo, rel), "utf8")
}

describe("CodeBench analytics auth contract", () => {
  for (const rel of ANALYTICS_ROUTES) {
    it(`${rel} binds the caller session before SQL`, () => {
      const src = readRoute(rel)
      assert.match(src, /requireCodebenchStudent|requireCodebenchCoraStudent|requireBoundStudentCaller/)
      assert.doesNotMatch(src, /getEffectiveMembershipTier\(parseInt\(studentId\)\)/)
    })
  }

  it("submissions exposes code, not only solution alias", () => {
    const src = readRoute("app/api/codebench/submissions/route.ts")
    assert.match(src, /requireCodebenchStudent|requireCodebenchCoraStudent|requireBoundStudentCaller/)
    assert.doesNotMatch(src, /code as solution/)
    assert.match(src, /^\s+code,?$/m)
  })

  it("leaderboard drops roster student_code and scopes to caller course", () => {
    const src = readRoute("app/api/codebench/leaderboard/route.ts")
    assert.doesNotMatch(src, /student_code/)
    assert.match(src, /s\.course_id|sess\.course_id/)
  })

  it("analyze and learning-plan do not fabricate scores on parse failure", () => {
    const analyze = readRoute("app/api/codebench/analyze/route.ts")
    const plan = readRoute("app/api/codebench/learning-plan/route.ts")
    assert.match(analyze, /status:\s*502/)
    assert.doesNotMatch(analyze, /proficiencyScore:\s*50/)
    assert.match(plan, /status:\s*502/)
    assert.doesNotMatch(plan, /study_time_minutes:\s*45/)
  })
})
