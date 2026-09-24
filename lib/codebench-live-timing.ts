/** Poll / debounce windows for live classroom sync. Student → instructor is the primary stream. */
/** Presence heartbeat. Full code is posted on edit, not on this timer. */
export const LIVE_STUDENT_SNAPSHOT_INTERVAL_MS = 2000
/** Fallback for code changes that don't come from Monaco keystrokes (restore, pushes). */
export const LIVE_STUDENT_SNAPSHOT_DEBOUNCE_MS = 250
export const LIVE_STUDENT_SNAPSHOT_INITIAL_MS = 80
/**
 * Throttle Monaco keystrokes → lightweight snapshot (code + cursor only). The instructor
 * reads the selected student every LIVE_INSTRUCTOR_CODE_POLL_MS, so posting much faster
 * than that only adds server load.
 */
export const LIVE_STUDENT_SNAPSHOT_FAST_MS = 150
/** Full typing-replay payload cadence (heavier POST). */
export const LIVE_STUDENT_SNAPSHOT_REPLAY_MS = 8000
export const LIVE_STUDENT_PUSH_POLL_MS = 800
export const LIVE_INSTRUCTOR_SESSION_POLL_MS = 1000
/** Selected student's code only. The full roster poll stays on LIVE_INSTRUCTOR_SESSION_POLL_MS. */
export const LIVE_INSTRUCTOR_CODE_POLL_MS = 250
/** Roster polls ask for the selected student's typing replay at most this often. */
export const LIVE_INSTRUCTOR_REPLAY_REFRESH_MS = 8000
export const LIVE_INSTRUCTOR_SYNC_DEBOUNCE_MS = 150
export const LIVE_STUDENT_SESSIONS_POLL_MS = 2500
export const LIVE_INSTRUCTOR_SESSIONS_POLL_MS = 4000

export function liveInstructorSelectedKey(assignmentId: string | number) {
  return `cb-live-selected:${assignmentId}`
}

export function liveStudentPushKey(studentId: string, assignmentId: string) {
  return `cb-live-push:${studentId}:${assignmentId}`
}
