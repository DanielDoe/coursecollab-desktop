export const STUDENT_SELECT_COURSE_PATH = "/auth/student/select-course"

export type StudentSelectCourseOption = {
  courseId: number
  courseCode: string
  courseTitle: string
  section?: string
  studentRowId?: number | null
  sessionId?: number | null
  academicTermId?: number | null
  academicTermLabel?: string | null
}

export function studentEnrollmentCount(
  enrollments: Array<{ courseId?: number }> | null | undefined,
): number {
  return Array.isArray(enrollments) ? enrollments.filter((row) => row?.courseId != null).length : 0
}

export function studentSelectCoursePickerKey(
  row: Pick<StudentSelectCourseOption, "courseId" | "section" | "studentRowId">,
): string {
  if (row.studentRowId != null && Number.isFinite(row.studentRowId) && row.studentRowId > 0) {
    return `row-${Math.trunc(row.studentRowId)}`
  }
  const section = row.section?.trim() ?? ""
  return section ? `course-${row.courseId}-section-${section}` : `course-${row.courseId}`
}
