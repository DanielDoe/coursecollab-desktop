/**
 * Shared confirmation phrase for any destructive delete of student activity records.
 * Faculty must type this exactly; agents must ask the instructor before proceeding.
 */
export const STUDENT_DATA_DELETE_CONFIRM_PHRASE = "DELETE STUDENT DATA"

/** @deprecated Use STUDENT_DATA_DELETE_CONFIRM_PHRASE */
export const PLAYGROUND_DELETE_CONFIRM_PHRASE = STUDENT_DATA_DELETE_CONFIRM_PHRASE

/** Data-management keys that remove student activity or roster rows. */
export const PROTECTED_STUDENT_DATA_TYPES = [
  "students",
  "groups",
  "quizAttempts",
  "quizAnswers",
  "practiceAttempts",
  "playgroundSessions",
  "userQuizzes",
  "classroomPoints",
] as const

export type ProtectedStudentDataType = (typeof PROTECTED_STUDENT_DATA_TYPES)[number]
