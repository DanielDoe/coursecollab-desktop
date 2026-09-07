/**
 * Run: npx tsx --test lib/course-exchange-auth.contract.test.ts
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import path from "node:path"

const ROOT = path.join(process.cwd())

const ROUTES = [
  "app/api/instructor/course-exchange/discover/route.ts",
  "app/api/instructor/course-exchange/sharing-settings/route.ts",
  "app/api/instructor/course-exchange/requests/route.ts",
  "app/api/instructor/course-exchange/requests/[id]/approve/route.ts",
  "app/api/instructor/course-exchange/requests/[id]/reject/route.ts",
  "app/api/instructor/course-exchange/requests/[id]/execute-copy/route.ts",
  "app/api/instructor/course-exchange/shared-with-me/route.ts",
  "app/api/instructor/course-exchange/my-shared/route.ts",
  "app/api/instructor/course-exchange/access-log/route.ts",
  "app/api/instructor/course-exchange/summary/route.ts",
]

describe("course-exchange API auth binding", () => {
  for (const file of ROUTES) {
    it(`${file} requires instructor session or course scope`, () => {
      const source = readFileSync(path.join(ROOT, file), "utf8")
      assert.match(
        source,
        /requireInstructorSession|requireInstructorCourse/,
        `${file} must bind to server-side instructor auth`,
      )
    })
  }

  it("execute-copy resolves modules from service not client", () => {
    const source = readFileSync(
      path.join(ROOT, "app/api/instructor/course-exchange/requests/[id]/execute-copy/route.ts"),
      "utf8",
    )
    assert.match(source, /executeApprovedCourseCopy/)
    assert.doesNotMatch(source, /approvedModules|approved_modules.*body/)
  })
})
