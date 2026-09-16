/** Bust instructor assignment caches and refetch CodeBench / Classroom Points lists. */
export const INSTRUCTOR_CLASSROOM_ASSIGNMENTS_CHANGED = "instructor-classroom-assignments-changed"

export function notifyInstructorClassroomAssignmentsChanged() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(INSTRUCTOR_CLASSROOM_ASSIGNMENTS_CHANGED))
}
