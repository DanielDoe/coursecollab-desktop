import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { studentInInstructorSessionScopeSql } from "./instructor-session-scope"

describe("office hours offering scope", () => {
  it("locks office-hour students to the selected Fall session, not every ELEG1301P01", () => {
    const fallSessionId = 812
    const sql = studentInInstructorSessionScopeSql({
      courseId: 5,
      sessionId: fallSessionId,
      academicTermId: 71,
      studentAlias: "s",
    })
    assert.match(sql, /s\.session_id = 812/)
    assert.match(sql, /sess_scope\.course_id = 5/)
    assert.doesNotMatch(sql, /LIKE/)
  })

  it("falls back to active term when no session/term is selected", () => {
    const sql = studentInInstructorSessionScopeSql({
      courseId: 5,
      studentAlias: "s",
    })
    assert.match(sql, /academic_terms/)
    assert.match(sql, /is_active/)
  })
})
