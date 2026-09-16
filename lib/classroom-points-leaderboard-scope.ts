type OfferingSession = {
  section?: string | null
  courseId?: number | null
  academicTermId?: number | null
}

export type ClassroomPointsLeaderboardRow = {
  rank?: number
  total_points?: number | string
  award_count?: number | string
  session?: string | null
  section?: string | null
  course_id?: number | null
  academic_term_id?: number | null
  full_name?: string | null
  is_current_user?: boolean
}

function numeric(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function entrySection(entry: ClassroomPointsLeaderboardRow): string {
  return String(entry.session ?? entry.section ?? "").trim().toUpperCase()
}

function entryRank(entry: ClassroomPointsLeaderboardRow, fallbackIndex: number): number {
  const parsed = Number(entry.rank)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackIndex + 1
}

/** Peer rows reduced by FERPA sanitize (no name; may or may not keep points). */
export function isClassroomLeaderboardPrivacyStub(entry: ClassroomPointsLeaderboardRow): boolean {
  if (entry.is_current_user === true) return false
  const hasName = Boolean(String(entry.full_name ?? "").trim())
  const hasPointsField = entry.total_points != null && String(entry.total_points).trim() !== ""
  return !hasName && !hasPointsField && entryRank(entry, 0) > 0
}

export function classroomPointsEntryMatchesOffering(
  entry: ClassroomPointsLeaderboardRow,
  session: OfferingSession,
): boolean {
  const code = entrySection(entry)
  if (code && session.section?.trim() && code !== session.section.trim().toUpperCase()) {
    return false
  }
  if (entry.course_id != null && session.courseId != null && Number(entry.course_id) !== Number(session.courseId)) {
    return false
  }
  if (
    entry.academic_term_id != null &&
    session.academicTermId != null &&
    Number(entry.academic_term_id) !== Number(session.academicTermId)
  ) {
    return false
  }
  return true
}

export function classroomPointsLeaderboardHasAwards(
  entries: ClassroomPointsLeaderboardRow[],
): boolean {
  return entries.some((entry) => numeric(entry.total_points) > 0)
}

/** Hide 0-pt roster dumps. Keep privacy stubs beside real awards; preserve API ranks. */
export function classroomPointsLeaderboardForCurrentOffering<T extends ClassroomPointsLeaderboardRow>(
  entries: T[],
  session: OfferingSession = {},
): T[] {
  const scoped = entries.filter((entry) => classroomPointsEntryMatchesOffering(entry, session))
  if (!classroomPointsLeaderboardHasAwards(scoped)) return []

  const kept = scoped.filter(
    (entry) => numeric(entry.total_points) > 0 || isClassroomLeaderboardPrivacyStub(entry),
  )

  return kept
    .map((entry, index) => ({ ...entry, rank: entryRank(entry, index) }))
    .sort((a, b) => entryRank(a, 0) - entryRank(b, 0))
}
