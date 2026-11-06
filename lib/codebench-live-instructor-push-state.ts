import { liveStudentPushKey } from "@/lib/codebench-live-timing"

export type StoredLiveInstructorPush = {
  revision: number
  code: string
  fileName?: string | null
}

function livePushStorage(): Storage | null {
  try {
    if (typeof sessionStorage === "undefined") return null
    return sessionStorage
  } catch {
    return null
  }
}

export function readStoredLiveInstructorPush(
  studentId: string,
  assignmentId: string,
): StoredLiveInstructorPush | null {
  try {
    const raw = livePushStorage()?.getItem(liveStudentPushKey(studentId, assignmentId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredLiveInstructorPush
    const revision = Number(parsed.revision) || 0
    const code = typeof parsed.code === "string" ? parsed.code : ""
    if (revision <= 0 && !code) return null
    return {
      revision,
      code,
      fileName: parsed.fileName ?? null,
    }
  } catch {
    return null
  }
}

export function writeStoredLiveInstructorPush(
  studentId: string,
  assignmentId: string,
  payload: StoredLiveInstructorPush,
) {
  try {
    livePushStorage()?.setItem(liveStudentPushKey(studentId, assignmentId), JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
}

export function knownLiveInstructorRevision(studentId: string | null, assignmentId: string | null): number {
  if (!studentId || !assignmentId) return 0
  return Number(readStoredLiveInstructorPush(studentId, assignmentId)?.revision) || 0
}

/** A push older than this is history. Joining must not replay it over work the student already has. */
export const LIVE_INSTRUCTOR_PUSH_FRESH_MS = 120_000

function instructorPushTimeMs(pushedAt: string | number | Date | null | undefined): number | null {
  if (pushedAt == null || pushedAt === "") return null
  if (pushedAt instanceof Date) {
    const ms = pushedAt.getTime()
    return Number.isFinite(ms) ? ms : null
  }
  if (typeof pushedAt === "number") return Number.isFinite(pushedAt) ? pushedAt : null
  const ms = Date.parse(pushedAt)
  return Number.isFinite(ms) ? ms : null
}

/** True when the instructor sent this edit recently enough that the student should still receive it. */
export function isFreshInstructorPush(
  pushedAt: string | number | Date | null | undefined,
  now = Date.now(),
  freshMs = LIVE_INSTRUCTOR_PUSH_FRESH_MS,
): boolean {
  const ms = instructorPushTimeMs(pushedAt)
  if (ms == null) return false
  const age = now - ms
  return age >= -5_000 && age <= freshMs
}

/**
 * Revision to remember at join. A push that just landed stays one step below the
 * server revision so the editor still applies it. An older push is marked seen.
 */
export function joinBaselineForInstructorPush(input: {
  serverRevision: number
  pushedAt?: string | number | Date | null
  now?: number
}): number {
  const revision = Math.max(0, Math.trunc(Number(input.serverRevision) || 0))
  if (revision <= 0) return 0
  if (!isFreshInstructorPush(input.pushedAt, input.now)) return revision
  return revision - 1
}

/** Record the instructor revision already on the server so join does not replay it. */
export function seedLiveInstructorPushBaseline(
  studentId: string,
  assignmentId: string,
  revision: number,
  options?: { allowLower?: boolean },
): number {
  const next = Math.max(0, Math.trunc(Number(revision) || 0))
  const current = knownLiveInstructorRevision(studentId, assignmentId)
  const existing = readStoredLiveInstructorPush(studentId, assignmentId)
  const placeholder = !existing || !existing.code || existing.code === "_"
  const revisionToStore = options?.allowLower && placeholder ? next : Math.max(current, next)
  writeStoredLiveInstructorPush(studentId, assignmentId, {
    revision: revisionToStore,
    code: existing?.code || "_",
    fileName: existing?.fileName ?? null,
  })
  return revisionToStore
}

/**
 * Keep a just-sent instructor edit when the snapshot is still the buffer the
 * student had at send time. A later edit from the student is kept as-is.
 */
export function studentSnapshotCodeAfterInstructorPush(input: {
  storedCode: string
  incomingCode: string
  instructorCode: string
  preInstructorCode: string
  instructorUpdatedAt?: string | number | Date | null
  now?: number
}): string {
  const incoming = input.incomingCode
  const stored = input.storedCode
  const instructor = input.instructorCode
  const previous = input.preInstructorCode
  if (!instructor) return incoming
  if (!previous) return incoming
  if (incoming === instructor) return incoming
  if (incoming !== previous) return incoming
  if (!isFreshInstructorPush(input.instructorUpdatedAt, input.now)) return incoming
  if (stored === instructor || stored === previous || !stored.trim()) return instructor
  return stored
}

export function shouldApplyLiveInstructorPush(input: {
  revision: number
  baselineRevision: number
  appliedRevision: number
}): boolean {
  const revision = Number(input.revision) || 0
  if (revision <= 0) return false
  if (revision <= input.appliedRevision) return false
  if (revision <= input.baselineRevision) return false
  return true
}
