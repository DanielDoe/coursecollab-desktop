/** Poll / debounce windows for live classroom sync. Student → instructor is the primary stream. */
export const LIVE_STUDENT_SNAPSHOT_INTERVAL_MS = 900
export const LIVE_STUDENT_SNAPSHOT_DEBOUNCE_MS = 280
export const LIVE_STUDENT_SNAPSHOT_INITIAL_MS = 120
export const LIVE_STUDENT_PUSH_POLL_MS = 700
export const LIVE_INSTRUCTOR_SESSION_POLL_MS = 700
export const LIVE_INSTRUCTOR_SYNC_DEBOUNCE_MS = 350
export const LIVE_STUDENT_SESSIONS_POLL_MS = 2500
export const LIVE_INSTRUCTOR_SESSIONS_POLL_MS = 4000

export function liveInstructorSelectedKey(assignmentId: string | number) {
  return `cb-live-selected:${assignmentId}`
}

export function liveStudentPushKey(studentId: string, assignmentId: string) {
  return `cb-live-push:${studentId}:${assignmentId}`
}
