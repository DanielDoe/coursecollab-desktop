/**
 * Run: npx tsx --test lib/classroom-submission-scope.test.ts
 */
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { classroomAssignmentSessionMatchesStudent } from "./classroom-assignment-session-match"

describe("classroomAssignmentSessionMatchesStudent", () => {
  it("matches the same ELEG section", () => {
    assert.equal(
      classroomAssignmentSessionMatchesStudent("ELEG1301P01", "ELEG1301P01"),
      true,
    )
  })

  it("rejects a different section in the same course", () => {
    assert.equal(
      classroomAssignmentSessionMatchesStudent("ELEG1301P01", "ELEG1301P02"),
      false,
    )
  })

  it("rejects a different ELEG course", () => {
    assert.equal(
      classroomAssignmentSessionMatchesStudent("ELEG1301P01", "ELEG1304P03"),
      false,
    )
  })

  it("rejects null or empty assignment sessions", () => {
    assert.equal(classroomAssignmentSessionMatchesStudent(null, "ELEG1301P01"), false)
    assert.equal(classroomAssignmentSessionMatchesStudent("", "ELEG1301P01"), false)
  })
})
