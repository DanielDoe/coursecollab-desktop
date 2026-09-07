import {
  resolvePlaygroundDisplayName,
  type PlaygroundIdentityFields,
} from "@/lib/playground-display-name"

export const PRIVACY_PLACEHOLDER_NAME = "Student"

export function isCurrentStudent(entryId: unknown, currentStudentId: unknown): boolean {
  if (entryId == null || currentStudentId == null) return false
  return String(entryId) === String(currentStudentId)
}

export function resolveEntryStudentId(entry: Record<string, unknown>, idFields: string[] = ["id", "student_id"]): unknown {
  for (const field of idFields) {
    if (entry[field] != null) return entry[field]
  }
  return undefined
}

export function sanitizeLeaderboardForStudent<T extends Record<string, unknown>>(
  entries: T[],
  currentStudentId: string,
  options?: { idFields?: string[] }
): Array<T & { rank: number; is_current_user: boolean } | { rank: number; is_current_user: false }> {
  const idFields = options?.idFields ?? ["id", "student_id"]

  return entries.map((entry, index) => {
    const entryId = resolveEntryStudentId(entry, idFields)
    const isCurrentUser = isCurrentStudent(entryId, currentStudentId)
    const rank = Number(entry.rank ?? index + 1)

    if (isCurrentUser) {
      return { ...entry, rank, is_current_user: true }
    }

    return { rank, is_current_user: false }
  })
}

export function sanitizeCommentForStudent<T extends Record<string, unknown>>(
  comment: T,
  currentStudentId: string
): T & { is_current_user: boolean; student_name?: string } {
  const isCurrentUser = isCurrentStudent(comment.student_id, currentStudentId)

  if (isCurrentUser) {
    return { ...comment, is_current_user: true }
  }

  return {
    ...comment,
    student_name: undefined,
    is_current_user: false,
  }
}

export function sanitizePeerForStudent<T extends { id: unknown; full_name?: string }>(
  peer: T,
  currentStudentId: string
): T & { display_label: string; is_current_user: boolean } {
  const isCurrentUser = isCurrentStudent(peer.id, currentStudentId)

  if (isCurrentUser) {
    return {
      ...peer,
      display_label: peer.full_name || "You",
      is_current_user: true,
    }
  }

  return {
    ...peer,
    full_name: undefined,
    display_label: PRIVACY_PLACEHOLDER_NAME,
    is_current_user: false,
  }
}

export function sanitizePlaygroundEntryForStudent<T extends Record<string, unknown>>(
  entry: T,
  currentStudentRosterId: string,
  options?: { blurPeerNames?: boolean },
): Omit<T, "studentId" | "student_id" | "studentName" | "student_name" | "nickname"> & {
  is_current_user: boolean
  displayName: string
} {
  const blurPeerNames = options?.blurPeerNames === true
  const entryRosterId = entry.studentId ?? entry.student_id
  const isCurrentUser = isCurrentStudent(entryRosterId, currentStudentRosterId)
  const displayName = resolvePlaygroundDisplayName(entry as PlaygroundIdentityFields)

  const {
    studentId: _studentId,
    student_id: _student_id,
    studentName: _studentName,
    student_name: _student_name,
    nickname: _nickname,
    display_name: _display_name,
    ...rest
  } = entry as Record<string, unknown>

  if (blurPeerNames && !isCurrentUser) {
    return {
      rank: entry.rank,
      is_current_user: false,
      displayName: PRIVACY_PLACEHOLDER_NAME,
    } as Omit<T, "studentId" | "student_id" | "studentName" | "student_name" | "nickname"> & {
      is_current_user: boolean
      displayName: string
    }
  }

  return {
    ...(rest as Omit<T, "studentId" | "student_id" | "studentName" | "student_name" | "nickname">),
    displayName,
    is_current_user: isCurrentUser,
  }
}

export function sanitizeProjectLeaderboardEntry<T extends Record<string, unknown>>(
  entry: T,
  currentStudentRosterId: string,
  rank: number
): Record<string, unknown> {
  const leaderId = entry.leaderStudentId ?? entry.leader_student_id
  const isCurrentUser = isCurrentStudent(leaderId, currentStudentRosterId)

  if (isCurrentUser) {
    return { ...entry, rank, is_current_user: true }
  }

  return {
    rank,
    id: entry.id,
    title: entry.title,
    groupName: entry.groupName ?? entry.group_name,
    session: entry.session,
    is_current_user: false,
  }
}
