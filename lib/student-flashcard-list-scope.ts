export type StudentFlashcardListScope = {
  courseId: number | null
  session: string | null
}

/**
 * Student flashcard lists bind to the authenticated student's enrollment.
 * Client `courseId` / `session` query params must never override lookup.
 */
export function resolveStudentFlashcardListScope(
  enrollment: StudentFlashcardListScope,
  _clientQuery?: { courseId?: string | null; session?: string | null },
): StudentFlashcardListScope {
  return {
    courseId: enrollment.courseId,
    session: enrollment.session,
  }
}
