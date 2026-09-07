/**
 * Run: npx tsx --test lib/assessment-take-auth.contract.test.ts
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

const AUTH = /requireBoundStudentCaller|requireCallerStudentDbId|requireAttemptOwnership|requireStudentIdParamMatchesCaller/

const ROUTES = [
  "app/api/student/mid-semesters/route.ts",
  "app/api/student/quiz-progress/route.ts",
  "app/api/quiz/log-violation/route.ts",
  "app/api/student/issues/route.ts",
  "app/api/student/issues/stats/route.ts",
  "app/api/student/save-answer/route.ts",
  "app/api/quiz/submit/route.ts",
  "app/api/student/start-quiz/route.ts",
] as const

describe("assessment take/list session bind", () => {
  for (const path of ROUTES) {
    it(`${path} requires a student session`, () => {
      const src = readFileSync(path, "utf8")
      assert.match(src, AUTH)
    })
  }

  it("start-quiz rejects expired single-sitting exams", () => {
    const src = readFileSync("app/api/student/start-quiz/route.ts", "utf8")
    assert.match(src, /isSingleSittingExam/)
    assert.match(src, /Assessment has expired/)
  })
})
