import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  matchStudentEnrollment,
  serializeStudentEnrollment,
  studentEnrollmentPickerKey,
  type StudentEnrollmentRecord,
} from "@/lib/student-active-enrollment-logic"

function enrollment(
  partial: Partial<StudentEnrollmentRecord> & Pick<StudentEnrollmentRecord, "courseId" | "studentRowId">,
): StudentEnrollmentRecord {
  return {
    courseCode: partial.courseCode ?? "ELEG 1304",
    courseTitle: partial.courseTitle ?? "Computer Applications in Engineering",
    section: partial.section ?? "P01",
    sessionId: partial.sessionId ?? 10,
    academicTermId: partial.academicTermId ?? 70,
    academicTermLabel: partial.academicTermLabel ?? "Fall 2026",
    status: partial.status ?? "active",
    ...partial,
  }
}

describe("student active enrollment matching", () => {
  const alex = [
    enrollment({ courseId: 16, studentRowId: 101, courseCode: "ELEG 1304", section: "P01" }),
    enrollment({ courseId: 5, studentRowId: 202, courseCode: "ELEG 1301", section: "P01" }),
  ]
  const bailey = [enrollment({ courseId: 16, studentRowId: 303, courseCode: "ELEG 1304", section: "P01" })]

  it("lets a multi-course student switch to another enrolled course", () => {
    const selected = matchStudentEnrollment(alex, { courseId: 5, section: "P01" })
    assert.equal(selected?.studentRowId, 202)
    assert.equal(selected?.courseCode, "ELEG 1301")
  })

  it("rejects a course the student is not enrolled in", () => {
    assert.equal(matchStudentEnrollment(bailey, { courseId: 5, section: "P01" }), null)
  })

  it("matches by bound student row when provided", () => {
    const selected = matchStudentEnrollment(alex, { studentRowId: 202 })
    assert.equal(selected?.courseId, 5)
  })

  it("does not accept another student's row id", () => {
    assert.equal(matchStudentEnrollment(bailey, { studentRowId: 202 }), null)
  })

  it("serializes section and term for the picker", () => {
    const publicRow = serializeStudentEnrollment(alex[0]!)
    assert.equal(publicRow.section, "P01")
    assert.equal(publicRow.academicTermLabel, "Fall 2026")
    assert.equal(publicRow.studentRowId, 101)
    assert.equal(studentEnrollmentPickerKey(publicRow), "course-16-section-P01")
  })
})
