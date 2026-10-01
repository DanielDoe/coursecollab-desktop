/**
 * The student's live-classroom join for this window. sessionStorage survives a reload
 * but not a new window, so a refresh resumes the join instead of dropping it.
 */
const KEY = "codebench_live_join"
/** A join older than this is from a previous class period; don't resume it. */
const MAX_AGE_MS = 6 * 60 * 60 * 1000

type StoredJoin = { studentId: string; assignmentId: string; at: number }

export function readRememberedLiveJoin(studentId: string | null | undefined): string | null {
  if (!studentId || typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as Partial<StoredJoin>
    if (String(stored.studentId ?? "") !== String(studentId)) return null
    if (typeof stored.at !== "number" || Date.now() - stored.at > MAX_AGE_MS) return null
    const assignmentId = String(stored.assignmentId ?? "").trim()
    return assignmentId || null
  } catch {
    return null
  }
}

export function rememberLiveJoin(studentId: string, assignmentId: string) {
  if (typeof window === "undefined") return
  try {
    const value: StoredJoin = { studentId: String(studentId), assignmentId: String(assignmentId), at: Date.now() }
    window.sessionStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    /* quota / private mode */
  }
}

const SYNCED_KEY = "codebench_live_synced"

type SyncedCode = { studentId: string; assignmentId: string; code: string }

/** Last code this window's editor delivered to a live assignment. */
export function rememberLiveSyncedCode(studentId: string, assignmentId: string, code: string) {
  if (typeof window === "undefined") return
  try {
    const value: SyncedCode = { studentId: String(studentId), assignmentId: String(assignmentId), code }
    window.sessionStorage.setItem(SYNCED_KEY, JSON.stringify(value))
  } catch {
    /* quota / private mode */
  }
}

/**
 * The editor buffer is one workspace file shared by every assignment. When the instructor
 * switches sessions, the buffer still holds the previous assignment's code; that is not
 * work for this assignment and must not block restoring (or overwrite) its saved copy.
 */
export function editorHoldsOtherLiveAssignment(
  studentId: string | null | undefined,
  assignmentId: string | null | undefined,
  editorCode: string,
): boolean {
  if (!studentId || !assignmentId || typeof window === "undefined") return false
  try {
    const raw = window.sessionStorage.getItem(SYNCED_KEY)
    if (!raw) return false
    const stored = JSON.parse(raw) as Partial<SyncedCode>
    if (String(stored.studentId ?? "") !== String(studentId)) return false
    if (!stored.assignmentId || String(stored.assignmentId) === String(assignmentId)) return false
    return typeof stored.code === "string" && stored.code.trim() !== "" && stored.code.trim() === editorCode.trim()
  } catch {
    return false
  }
}

export function forgetLiveJoin(assignmentId?: string | null) {
  if (typeof window === "undefined") return
  try {
    if (assignmentId) {
      const raw = window.sessionStorage.getItem(KEY)
      const stored = raw ? (JSON.parse(raw) as Partial<StoredJoin>) : null
      if (stored && String(stored.assignmentId ?? "") !== String(assignmentId)) return
    }
    window.sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
