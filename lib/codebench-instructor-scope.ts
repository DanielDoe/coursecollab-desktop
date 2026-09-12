/** Instructor-scoped storage keys for CodeBench workspace, library, and history. */

export function readInstructorOwnerId(): string | null {
  if (typeof window === "undefined") return null
  const id = localStorage.getItem("instructorId")?.trim()
  return id || null
}

export function instructorCodebenchOwnerKey(instructorId?: string | null): string {
  const id = instructorId?.trim() || readInstructorOwnerId()
  return id ? `instructor:${id}` : "instructor:anonymous"
}

export const INSTRUCTOR_CODEBENCH_EXPLORER_STORAGE_KEY = "instructor_codebench_explorer_open"

export function readInstructorCodebenchExplorerDefault(): boolean {
  if (typeof window === "undefined") return true
  const raw = localStorage.getItem(INSTRUCTOR_CODEBENCH_EXPLORER_STORAGE_KEY)
  if (raw === "0" || raw === "false") return false
  return true
}

export function readInstructorCourseId(): number | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem("instructorSession")
    if (!raw) return null
    const session = JSON.parse(raw) as { selectedCourseId?: number }
    const courseId = Number(session.selectedCourseId)
    return Number.isFinite(courseId) && courseId > 0 ? courseId : null
  } catch {
    return null
  }
}
