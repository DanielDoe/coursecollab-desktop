/**
 * Run: npx tsx --test lib/faculty-course-session-sync.test.ts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import type { FacultyCourseOption } from "./faculty-course-session-sync"
import {
  facultyCourseSelectValue,
  findOfferingMatch,
  reconcileFacultySelectedCourse,
  resolveFacultyCourseSelectValue,
  retainFacultyCourseScopeOnRefresh,
} from "./faculty-course-session-sync"

function offering(
  partial: Partial<FacultyCourseOption> & { course_id: number },
): FacultyCourseOption {
  return {
    id: partial.course_id,
    course_id: partial.course_id,
    academic_term_id: partial.academic_term_id ?? 9,
    term_label: partial.term_label ?? "Fall 2026",
    is_active_term: partial.is_active_term ?? true,
    course_code: partial.course_code ?? "ELEG1301",
    course_title: partial.course_title ?? "Programming",
    university: null,
    semester: "Fall 2026",
    staff_role: "INSTRUCTOR",
    session_id: partial.session_id,
    session_code: partial.session_code,
    catalog_course_code: partial.catalog_course_code ?? "ELEG1301",
  }
}

const p01 = offering({ course_id: 42, session_id: 101, session_code: "P01" })
const p02 = offering({ course_id: 42, session_id: 102, session_code: "P02" })
const courseOnly = offering({ course_id: 42, session_id: undefined, session_code: undefined })

describe("reconcileFacultySelectedCourse", () => {
  it("does not wipe a selected course when the offerings fetch is empty", () => {
    const result = reconcileFacultySelectedCourse(
      {
        selectedCourseId: 42,
        selectedSessionId: 101,
        selectedSessionCode: "P01",
        selectedAcademicTermId: 9,
      },
      [],
    )
    assert.equal(result.valid, true)
    assert.equal(result.session.selectedCourseId, 42)
    assert.equal(result.session.selectedSessionId, 101)
    assert.equal(result.session.selectedSessionCode, "P01")
  })

  it("keeps the login section instead of matching a session-less course row", () => {
    const result = reconcileFacultySelectedCourse(
      {
        selectedCourseId: 42,
        selectedSessionId: 101,
        selectedSessionCode: "P01",
        selectedAcademicTermId: 9,
      },
      [courseOnly, p01, p02],
    )
    assert.equal(result.valid, true)
    assert.equal(result.session.selectedSessionId, 101)
    assert.equal(result.session.selectedSessionCode, "P01")
    assert.equal(
      resolveFacultyCourseSelectValue(result.session, [courseOnly, p01, p02]),
      "42:9:101",
    )
  })
})

describe("retainFacultyCourseScopeOnRefresh", () => {
  it("keeps the selected lab section when the refresh payload has only the account", () => {
    const next = retainFacultyCourseScopeOnRefresh(
      { id: 7, name: "Instructor" },
      {
        selectedCourseId: 42,
        selectedCourseCode: "ELEG1301",
        selectedCatalogCourseCode: "ELEG1301",
        selectedCourseTitle: "Programming",
        selectedSessionId: 101,
        selectedSessionCode: "ELEG1301P01",
        selectedAcademicTermId: 9,
        selectedTermLabel: "Fall 2026",
        coursePermissions: ["codebench"],
        staffRoleForCourse: "INSTRUCTOR",
      },
    )
    assert.equal(next.selectedCourseId, 42)
    assert.equal(next.selectedSessionId, 101)
    assert.equal(next.selectedSessionCode, "ELEG1301P01")
    assert.equal(next.selectedCatalogCourseCode, "ELEG1301")
    assert.equal(facultyCourseSelectValue(next), "42:9:101")
  })
})

describe("resolveFacultyCourseSelectValue", () => {
  it("maps stored scope onto an offering key that exists in the switcher", () => {
    const session = {
      selectedCourseId: 42,
      selectedSessionId: 102,
      selectedAcademicTermId: 9,
    }
    assert.equal(facultyCourseSelectValue(session), "42:9:102")
    assert.equal(resolveFacultyCourseSelectValue(session, [p01, p02]), "42:9:102")
  })
})

describe("findOfferingMatch", () => {
  it("does not fall back to another section when the selected lab is missing from a partial list", () => {
    assert.equal(findOfferingMatch([p02], 42, 9, 101), undefined)
  })
})
