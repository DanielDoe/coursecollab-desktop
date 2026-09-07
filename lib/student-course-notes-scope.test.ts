/**
 * Run: npx tsx --test lib/student-course-notes-scope.test.ts
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { publishedCourseNotesLookupFromEnrollment } from "@/lib/student-course-notes-scope"

const here = dirname(fileURLToPath(import.meta.url))

describe("published course notes enrollment bind", () => {
  it("ignores client courseId and session", () => {
    const lookup = publishedCourseNotesLookupFromEnrollment(
      { courseId: 15, session: "ELEG1304P01" },
      { courseId: "16", session: "ECE2202" },
    )
    assert.equal(lookup.courseId, 15)
    assert.equal(lookup.session, "ELEG1304P01")
  })

  it("uses enrollment when the client omits course params", () => {
    const lookup = publishedCourseNotesLookupFromEnrollment(
      { courseId: 16, session: "ECE2202" },
      { courseId: null, session: null },
    )
    assert.equal(lookup.courseId, 16)
    assert.equal(lookup.session, "ECE2202")
  })

  it("locks the course-notes route to enrollment lookup", () => {
    const source = readFileSync(join(here, "../app/api/student/course-notes/route.ts"), "utf8")
    assert.match(source, /requireCallerStudentDbId/)
    assert.match(source, /publishedCourseNotesLookupFromEnrollment/)
    assert.doesNotMatch(source, /courseIdParam/)
  })
})
