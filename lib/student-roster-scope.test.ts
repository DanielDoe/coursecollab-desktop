/**
 * Run: npx tsx --test lib/student-roster-scope.test.ts
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import {
  rosterClientMatchesEnrollment,
  rosterLookupFromEnrollment,
} from "@/lib/student-roster-scope"

const here = dirname(fileURLToPath(import.meta.url))

describe("student roster enrollment bind", () => {
  it("rejects a client section from another class", () => {
    assert.equal(
      rosterClientMatchesEnrollment(
        { section: "ELEG1304P01", sessionCode: "ELEG1304P01", courseId: 15 },
        { section: "ECE2202", courseId: "16" },
      ),
      false,
    )
  })

  it("rejects a client courseId that is not the caller's course", () => {
    assert.equal(
      rosterClientMatchesEnrollment(
        { section: "ECE2202", sessionCode: "ECE2202", courseId: 16 },
        { section: "ECE2202", courseId: "15" },
      ),
      false,
    )
  })

  it("accepts the caller's own section and course", () => {
    assert.equal(
      rosterClientMatchesEnrollment(
        { section: "ECE2202", sessionCode: "ECE2202", courseId: 16 },
        { section: "ECE2202", courseId: "16" },
      ),
      true,
    )
  })

  it("looks up classmates from enrollment, not the client courseId", () => {
    const lookup = rosterLookupFromEnrollment({
      section: "ELEG1304P01",
      sessionCode: "ELEG1304P01",
      courseId: 15,
    })
    assert.equal(lookup.courseId, 15)
    assert.equal(lookup.section, "ELEG1304P01")
  })

  it("locks the roster route behind the caller session", () => {
    const source = readFileSync(join(here, "../app/api/student/roster/route.ts"), "utf8")
    assert.match(source, /requireCallerStudentDbId/)
    assert.match(source, /rosterClientMatchesEnrollment/)
    assert.match(source, /rosterLookupFromEnrollment/)
  })
})
