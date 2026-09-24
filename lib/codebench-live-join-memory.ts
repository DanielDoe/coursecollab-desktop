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
