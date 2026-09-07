export type StudentEnrollmentRecord = {
  courseId: number
  courseCode: string
  courseTitle: string
  section: string
  sessionId: number | null
  studentRowId: number
  academicTermId?: number | null
  academicTermLabel?: string | null
  instructorName?: string | null
  status?: "active" | "completed" | "archived" | "inactive"
}

export type StudentActiveEnrollmentRequest = {
  courseId?: number | null
  section?: string | null
  studentRowId?: number | null
}

export function studentEnrollmentPickerKey(enrollment: Pick<StudentEnrollmentRecord, "courseId" | "section">): string {
  const section = enrollment.section?.trim() ?? ""
  return section ? `course-${enrollment.courseId}-section-${section}` : `course-${enrollment.courseId}`
}

/** Only enrollments belonging to the authenticated student may be selected. */
export function matchStudentEnrollment(
  enrollments: StudentEnrollmentRecord[],
  request: StudentActiveEnrollmentRequest,
): StudentEnrollmentRecord | null {
  if (enrollments.length === 0) return null

  if (request.studentRowId != null && Number.isFinite(request.studentRowId) && request.studentRowId > 0) {
    const byRow = enrollments.find((row) => row.studentRowId === Math.trunc(request.studentRowId!))
    return byRow ?? null
  }

  const courseId = request.courseId != null ? Number(request.courseId) : null
  if (courseId == null || !Number.isFinite(courseId) || courseId <= 0) return null

  const matches = enrollments.filter((row) => row.courseId === Math.trunc(courseId))
  if (matches.length === 0) return null

  const section = request.section?.trim()
  if (section) {
    return matches.find((row) => row.section.trim() === section) ?? null
  }
  return matches[0] ?? null
}

export function serializeStudentEnrollment(enrollment: StudentEnrollmentRecord) {
  return {
    courseId: enrollment.courseId,
    courseCode: enrollment.courseCode,
    courseTitle: enrollment.courseTitle,
    section: enrollment.section,
    sessionId: enrollment.sessionId,
    studentRowId: enrollment.studentRowId,
    academicTermId: enrollment.academicTermId ?? null,
    academicTermLabel: enrollment.academicTermLabel ?? null,
    instructorName: enrollment.instructorName ?? null,
    status: enrollment.status ?? "active",
  }
}
