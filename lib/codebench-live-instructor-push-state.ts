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

/** Record the instructor revision already on the server so join does not replay it. */
export function seedLiveInstructorPushBaseline(
  studentId: string,
  assignmentId: string,
  revision: number,
): number {
  const next = Math.max(0, Math.trunc(Number(revision) || 0))
  const current = knownLiveInstructorRevision(studentId, assignmentId)
  const revisionToStore = Math.max(current, next)
  const existing = readStoredLiveInstructorPush(studentId, assignmentId)
  writeStoredLiveInstructorPush(studentId, assignmentId, {
    revision: revisionToStore,
    code: existing?.code || "_",
    fileName: existing?.fileName ?? null,
  })
  return revisionToStore
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
