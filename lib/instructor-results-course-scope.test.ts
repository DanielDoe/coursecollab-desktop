import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  studentInSelectedCourseSqlForCourse,
  studentOnCourseActiveTermSql,
} from "./instructor-results-course-scope"
import {
  sessionInInstructorOfferingSql,
  studentInInstructorSessionScopeSql,
} from "./instructor-session-scope"

describe("studentInSelectedCourseSqlForCourse", () => {
  it("locks to the selected session id so reused section codes cannot leak", () => {
    const sql = studentInSelectedCourseSqlForCourse(5, "ELEG1301", {
      sessionId: 505,
      academicTermId: 70,
    })
    assert.match(sql, /s\.session_id = 505/)
    assert.doesNotMatch(sql, /LIKE/)
    assert.doesNotMatch(sql, /s\.section/)
  })

  it("falls back to the active academic term instead of every ELEG1301P01 roster", () => {
    const sql = studentOnCourseActiveTermSql(5)
    assert.match(sql, /academic_terms/)
    assert.match(sql, /is_active/)
    assert.doesNotMatch(sql, /LIKE/)
  })

  it("never prefix-matches section codes on the catalog course", () => {
    const { studentInSelectedCourseSql } = require("./instructor-results-course-scope") as {
      studentInSelectedCourseSql: (courseId: number, courseCode?: string) => string
    }
    const sql = studentInSelectedCourseSql(5, "ELEG1301")
    assert.doesNotMatch(sql, /LIKE/)
    assert.match(sql, /is_active/)
  })
})

describe("offering scope helpers", () => {
  it("locks students and sessions to the selected session id", () => {
    const student = studentInInstructorSessionScopeSql({
      courseId: 5,
      sessionId: 505,
      academicTermId: 70,
      studentAlias: "st",
    })
    assert.match(student, /st\.session_id = 505/)
    assert.doesNotMatch(student, /LIKE/)
    assert.doesNotMatch(student, /st\.section/)

    const session = sessionInInstructorOfferingSql({
      courseId: 5,
      sessionId: 505,
      academicTermId: 70,
      sessionAlias: "sess",
    })
    assert.match(session, /sess\.id = 505/)
    assert.match(session, /sess\.course_id = 5/)
  })
})
