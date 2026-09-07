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
}

function numeric(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function entrySection(entry: ClassroomPointsLeaderboardRow): string {
  return String(entry.session ?? entry.section ?? "").trim().toUpperCase()
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

/** Hide 0-pt roster dumps. Rankings start when someone earns approved points this offering. */
export function classroomPointsLeaderboardForCurrentOffering<T extends ClassroomPointsLeaderboardRow>(
  entries: T[],
  session: OfferingSession = {},
): T[] {
  const scoped = entries.filter((entry) => classroomPointsEntryMatchesOffering(entry, session))
  const awarded = scoped.filter((entry) => numeric(entry.total_points) > 0)
  if (awarded.length === 0) return []
  return awarded.map((entry, index) => ({ ...entry, rank: index + 1 }))
}
