export type LiveRosterIdentity = {
  student_db_id: number
  student_id: string
  full_name: string
  section: string | null
  session_code: string | null
}

function firstNonEmptyCode(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value
  }
  return null
}

/**
 * Faculty live view always follows the student's buffer.
 * Instructor pushes live in a separate column and must not hide student typing.
 */
export function resolveInstructorLiveViewCode(input: {
  studentSnapshotCode?: string | null
  submittedCode?: string | null
}): { code: string | null; codeSource: "live" | "submitted" | null } {
  const live = firstNonEmptyCode(input.studentSnapshotCode)
  if (live) return { code: live, codeSource: "live" }
  const submitted = firstNonEmptyCode(input.submittedCode)
  if (submitted) return { code: submitted, codeSource: "submitted" }
  if (typeof input.studentSnapshotCode === "string") {
    return { code: input.studentSnapshotCode, codeSource: "live" }
  }
  return { code: null, codeSource: null }
}

/** Enrolled roster plus anyone who already posted a live snapshot (no cap). */
export function mergeLiveRosterIdentities(
  enrolled: LiveRosterIdentity[],
  joinedFromSnapshots: LiveRosterIdentity[],
): LiveRosterIdentity[] {
  const byId = new Map<number, LiveRosterIdentity>()
  // Normalize student_db_id to a number on the way out — DB drivers can return string ids,
  // and downstream Map/Set lookups (snapshots, submissions, events) key by number.
  for (const row of enrolled) {
    const id = Number(row.student_db_id)
    if (!Number.isFinite(id) || id < 1) continue
    byId.set(id, { ...row, student_db_id: id })
  }
  for (const row of joinedFromSnapshots) {
    const id = Number(row.student_db_id)
    if (!Number.isFinite(id) || id < 1) continue
    if (!byId.has(id)) byId.set(id, { ...row, student_db_id: id })
  }
  return [...byId.values()]
}
