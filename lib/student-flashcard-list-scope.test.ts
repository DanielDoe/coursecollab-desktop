/**
 * Run: npx tsx --test lib/student-flashcard-list-scope.test.ts
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { resolveStudentFlashcardListScope } from "@/lib/student-flashcard-list-scope"

const here = dirname(fileURLToPath(import.meta.url))

describe("student flashcard list enrollment bind", () => {
  it("ignores a client courseId that is not the caller's enrollment", () => {
    const scope = resolveStudentFlashcardListScope(
      { courseId: 16, session: "ECE2202" },
      { courseId: "1", session: "LIVE" },
    )
    assert.equal(scope.courseId, 16)
    assert.equal(scope.session, "ECE2202")
  })

  it("uses enrollment when the client omits course params", () => {
    const scope = resolveStudentFlashcardListScope(
      { courseId: 16, session: "ECE2202" },
      { courseId: null, session: null },
    )
    assert.equal(scope.courseId, 16)
    assert.equal(scope.session, "ECE2202")
  })

  it("does not fall back to a client courseId when enrollment is empty", () => {
    const scope = resolveStudentFlashcardListScope(
      { courseId: null, session: null },
      { courseId: "1", session: "LIVE" },
    )
    assert.equal(scope.courseId, null)
    assert.equal(scope.session, null)
  })
})

describe("student flashcard list route", () => {
  it("binds GET list scope from enrollment, not query courseId", () => {
    const source = readFileSync(join(here, "../app/api/student/flashcards/decks/route.ts"), "utf8")
    assert.match(source, /requireCallerStudentDbId/)
    assert.match(source, /resolveStudentFlashcardListScope/)
    assert.match(source, /resolveStudentCourseContext/)
    assert.doesNotMatch(
      source,
      /if \(courseId == null \|\| !Number\.isFinite\(courseId\)\) courseId = ctx\.courseId/,
    )
  })
})
