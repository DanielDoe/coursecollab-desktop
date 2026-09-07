import { PRIVACY_PLACEHOLDER_NAME } from "@/lib/student-privacy"

export type PlaygroundIdentityFields = {
  nickname?: string | null
  display_name?: string | null
  displayName?: string | null
  student_name?: string | null
  studentName?: string | null
  student_id?: string | null
  studentId?: string | null
}

function normalize(value: unknown): string {
  return String(value ?? "").trim()
}

/** True when value is the roster student_id or looks like a numeric student ID. */
export function looksLikePlaygroundStudentId(value: string, rosterId?: string): boolean {
  if (!value) return false
  const roster = normalize(rosterId)
  if (roster && value === roster) return true
  return /^\d{5,}$/.test(value)
}

function withDedupSuffix(base: string, storedDisplay: string): string | null {
  if (!storedDisplay || looksLikePlaygroundStudentId(storedDisplay)) return null
  if (storedDisplay === base || storedDisplay.startsWith(`${base} (`)) return storedDisplay
  return null
}

/**
 * Leaderboard label: nickname when set, otherwise real name. Never roster student_id.
 */
export function resolvePlaygroundDisplayName(fields: PlaygroundIdentityFields): string {
  const rosterId = normalize(fields.student_id ?? fields.studentId)
  const nickname = normalize(fields.nickname)
  const studentName = normalize(fields.student_name ?? fields.studentName)
  const storedDisplay = normalize(fields.display_name ?? fields.displayName)

  if (nickname) {
    const withSuffix = withDedupSuffix(nickname, storedDisplay)
    return withSuffix ?? nickname
  }

  if (studentName && !looksLikePlaygroundStudentId(studentName, rosterId)) {
    const withSuffix = withDedupSuffix(studentName, storedDisplay)
    return withSuffix ?? studentName
  }

  if (storedDisplay && !looksLikePlaygroundStudentId(storedDisplay, rosterId)) {
    return storedDisplay
  }

  return PRIVACY_PLACEHOLDER_NAME
}

/** Prefer roster full_name when client-provided name looks like a student ID. */
export function resolvePlaygroundStudentName(
  clientName: string | undefined | null,
  rosterId: string,
  dbFullName: string | undefined | null,
): string {
  const trimmedClient = normalize(clientName)
  const trimmedDb = normalize(dbFullName)

  if (trimmedDb && !looksLikePlaygroundStudentId(trimmedDb, rosterId)) {
    if (!trimmedClient || looksLikePlaygroundStudentId(trimmedClient, rosterId)) {
      return trimmedDb
    }
  }

  if (trimmedClient && !looksLikePlaygroundStudentId(trimmedClient, rosterId)) {
    return trimmedClient
  }

  return trimmedDb || PRIVACY_PLACEHOLDER_NAME
}
