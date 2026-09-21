import { isCodebenchBoilerplate, normalizeCodebenchLanguageId } from "@/lib/codebench-languages"
import type { StudentLiveClassroomSession } from "@/lib/codebench-live-classroom-types"

/** Ignore empty/partial live-session polls right after join. */
export const LIVE_JOIN_GRACE_MS = 20_000

/** Consecutive polls that must omit the assignment before we treat the session as ended. */
export const LIVE_SESSION_END_CONFIRM_MISSES = 2

export function assignmentHasOpenLiveSession(
  sessions: StudentLiveClassroomSession[],
  assignmentId: string | number | null | undefined,
): boolean {
  const id = String(assignmentId ?? "").trim()
  if (!id) return false
  return sessions.some((session) => String(session.assignmentId) === id)
}

/** Whether the student editor should stream keystrokes for live classroom. */
export function studentLiveSnapshotShouldRun(input: {
  liveSharing: boolean
  studentId: string | null
  classroomSubmissionId: string
  listSupported: boolean | null
  sessions: StudentLiveClassroomSession[]
  joinGraceUntilMs?: number
}): boolean {
  if (!input.liveSharing || !input.studentId || !input.classroomSubmissionId) return false
  // Keep streaming for the whole join. The live-sessions list can omit an open
  // assignment (alias/section timing), and the POST is already server-gated (410).
  // Session-ended detection lives in shouldTreatLiveSessionAsEnded, not here.
  return true
}

export function editorLooksLikeStudentWork(code: string, languageId: string): boolean {
  const trimmed = code.trim()
  if (!trimmed) return false
  return !isCodebenchBoilerplate(code, normalizeCodebenchLanguageId(languageId))
}

/**
 * Don't let empty/boilerplate React state (or a failed restore) wipe typed work.
 * Real instructor pushes still apply because they look like student-authored code.
 */
export function shouldReplaceLiveEditorBuffer(
  localCode: string,
  incomingCode: string,
  languageId: string,
): boolean {
  if (localCode === incomingCode) return false
  if (!incomingCode.trim()) return false
  if (editorLooksLikeStudentWork(localCode, languageId) && !editorLooksLikeStudentWork(incomingCode, languageId)) {
    return false
  }
  return true
}

/** Restore a saved snapshot only when the local buffer is still empty/template. */
export function shouldRestoreLiveStudentCode(
  localCode: string,
  savedCode: string,
  languageId: string,
): boolean {
  if (!savedCode.trim()) return false
  if (localCode === savedCode) return false
  if (editorLooksLikeStudentWork(localCode, languageId)) return false
  return true
}

export function shouldTreatLiveSessionAsEnded(input: {
  isJoined: boolean
  listSupported: boolean | null
  loading: boolean
  joinGraceUntilMs: number
  assignmentId: string | number | null | undefined
  sessions: StudentLiveClassroomSession[]
  missCount: number
  now?: number
}): { ended: boolean; nextMissCount: number } {
  if (!input.isJoined || input.listSupported !== true || input.loading) {
    return { ended: false, nextMissCount: 0 }
  }
  const now = input.now ?? Date.now()
  if (now < input.joinGraceUntilMs) {
    return { ended: false, nextMissCount: 0 }
  }
  if (!String(input.assignmentId ?? "").trim()) {
    return { ended: false, nextMissCount: 0 }
  }
  if (assignmentHasOpenLiveSession(input.sessions, input.assignmentId)) {
    return { ended: false, nextMissCount: 0 }
  }
  const nextMissCount = input.missCount + 1
  return {
    ended: nextMissCount >= LIVE_SESSION_END_CONFIRM_MISSES,
    nextMissCount,
  }
}
