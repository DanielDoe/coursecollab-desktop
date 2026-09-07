/**
 * Default roster passwords by course. Must stay in sync with student login validation,
 * roster import, and instructor password-reset flows.
 */
export const STUDENT_ROSTER_DEFAULT_PASSWORD = "ELEG2026!" as const

export const STUDENT_ROSTER_DEFAULT_PASSWORD_ECE2202 = "ECE2202!" as const

const BY_COURSE_CODE: Record<string, string> = {
  ECE2202: STUDENT_ROSTER_DEFAULT_PASSWORD_ECE2202,
  ELEG1301: STUDENT_ROSTER_DEFAULT_PASSWORD,
  ELEG1304: STUDENT_ROSTER_DEFAULT_PASSWORD,
  ELEG1301P01: STUDENT_ROSTER_DEFAULT_PASSWORD,
  ELEG1301P02: STUDENT_ROSTER_DEFAULT_PASSWORD,
  ELEG1304P03: STUDENT_ROSTER_DEFAULT_PASSWORD,
  LEGACY: STUDENT_ROSTER_DEFAULT_PASSWORD,
}

/** Normalize catalog codes (e.g. "ECE 2202" → ECE2202). */
export function normalizeCourseCodeForDefaultPassword(courseCode: string | null | undefined): string {
  return String(courseCode ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
}

/** Default first-login / roster password for a course. Falls back to ELEG2026!. */
export function getStudentRosterDefaultPassword(courseCode: string | null | undefined): string {
  const key = normalizeCourseCodeForDefaultPassword(courseCode)
  if (key && BY_COURSE_CODE[key]) return BY_COURSE_CODE[key]
  return STUDENT_ROSTER_DEFAULT_PASSWORD
}

/** Human label for login instructions (e.g. "ECE 2202" or course title). */
export function formatCourseDefaultPasswordHint(
  courseCode: string | null | undefined,
  courseTitle?: string | null,
): string {
  const title = String(courseTitle ?? "").trim()
  const code = String(courseCode ?? "").trim()
  if (title && code && title.toUpperCase() !== code.toUpperCase()) return `${title} (${code})`
  return title || code || "your course"
}
