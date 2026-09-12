/**
 * Run: npx tsx --test lib/classroom-points-award-instructor.contract.test.ts
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, "..")

function readRel(rel: string) {
  return readFileSync(join(repo, rel), "utf8")
}

const STUDENT_AWARD_PATHS = [
  "app/api/classroom-points/submit-code/route.ts",
  "app/api/classroom-points/submit-solution/route.ts",
  "app/api/codebench/submit/route.ts",
  "app/api/codebench/daily-challenge/submit/route.ts",
  "app/api/codebench/practice/submit/route.ts",
  "lib/cora/services/student-capability-writes-course.ts",
] as const

const FIRST_INSTRUCTOR_FALLBACK = /SELECT\s+id\s+FROM\s+instructors(?:\s+ORDER\s+BY\s+id(?:\s+ASC)?)?\s+LIMIT\s+1/i
const HARDCODED_INSTRUCTOR_ONE = /(?:instructorResult\[0\]\?\.id|\.created_by)\s*(?:\?\?|\|\|)\s*1\b/

describe("Classroom award instructor contract", () => {
  it("never falls back to the first instructors row or id 1", () => {
    const helper = readRel("lib/classroom-points-award-instructor.ts")
    assert.match(helper, /resolveClassroomAwardInstructorId/)
    assert.doesNotMatch(helper, /sql`[\s\S]*FROM instructors/)
    assert.doesNotMatch(helper, /return 1\b/)
    assert.match(helper, /ClassroomAwardInstructorError/)
  })

  it("student submit paths resolve the course instructor", () => {
    for (const rel of STUDENT_AWARD_PATHS) {
      const src = readRel(rel)
      assert.match(
        src,
        /resolveClassroomAwardInstructorId/,
        `${rel} must use resolveClassroomAwardInstructorId`,
      )
      assert.doesNotMatch(
        src,
        FIRST_INSTRUCTOR_FALLBACK,
        `${rel} must not pick the first instructors row`,
      )
      assert.doesNotMatch(
        src,
        HARDCODED_INSTRUCTOR_ONE,
        `${rel} must not default awarded_by to instructor 1`,
      )
    }
  })

  it("trade transfers refuse a first-instructor fallback", () => {
    const src = readRel("lib/trade-center-peer-transfer.ts")
    assert.doesNotMatch(src, FIRST_INSTRUCTOR_FALLBACK)
    assert.match(src, /throw new Error/)
  })
})
