/** Allowlist serializers — never `{ ...row }` or omit-password spreads. */

const STUDENT_PUBLIC_KEYS = [
  "id",
  "student_id",
  "full_name",
  "email",
  "section",
  "session_id",
  "course_id",
  "university_id",
] as const

const FACULTY_PUBLIC_KEYS = [
  "id",
  "username",
  "name",
  "email",
  "role",
  "is_active",
] as const

const ADMIN_PUBLIC_KEYS = ["id", "username", "role", "platformRole"] as const

function pick<T extends Record<string, unknown>>(
  row: T | null | undefined,
  keys: readonly string[],
): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null
  const out: Record<string, unknown> = {}
  for (const key of keys) {
    if (key in row) out[key] = row[key]
  }
  return out
}

export function pickSafeStudentFields(row: Record<string, unknown> | null | undefined) {
  return pick(row, STUDENT_PUBLIC_KEYS)
}

export function pickSafeFacultyFields(row: Record<string, unknown> | null | undefined) {
  return pick(row, FACULTY_PUBLIC_KEYS)
}

export function pickSafeAdminFields(row: Record<string, unknown> | null | undefined) {
  return pick(row, ADMIN_PUBLIC_KEYS)
}

const HIDDEN_QUESTION_KEYS = new Set([
  "correct_answer",
  "correct_answers",
  "answer_key",
  "solution",
  "hidden_notes",
  "instructor_notes",
  "password_hash",
  "mfa_secret",
  "reset_token",
])

export function stripHiddenAssessmentFields<T extends Record<string, unknown>>(row: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (HIDDEN_QUESTION_KEYS.has(key)) continue
    out[key] = value
  }
  return out as Partial<T>
}
