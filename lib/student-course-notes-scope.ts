export type CourseNotesEnrollment = {
  courseId: number | null
  session: string | null
}

/**
 * Published course notes are bound to the authenticated student's enrollment.
 * Client `courseId` / `session` query params must never override lookup.
 */
export function publishedCourseNotesLookupFromEnrollment(
  enrollment: CourseNotesEnrollment,
  _clientQuery?: { courseId?: string | null; session?: string | null },
): CourseNotesEnrollment {
  return {
    courseId: enrollment.courseId,
    session: enrollment.session,
  }
}
