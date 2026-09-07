/** Headers for instructor APIs that use {@link tryResolveInstructorCourseScope}. */

export function getInstructorScopeHeaders(): HeadersInit {
  const instructorId = (typeof window !== "undefined" ? localStorage.getItem("instructorId") : null) || ""
  const h: Record<string, string> = {}
  const iid = instructorId.trim()
  if (iid) h["x-instructor-id"] = iid

  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("instructorSession") : null
    if (raw) {
      const s = JSON.parse(raw) as {
        id?: number | string
        selectedCourseId?: unknown
        selectedSessionId?: unknown
        selectedAcademicTermId?: unknown
        selectedUniversityId?: unknown
      }
      if (!h["x-instructor-id"] && s.id != null) {
        h["x-instructor-id"] = String(s.id)
      }
      if (s.selectedCourseId != null && String(s.selectedCourseId).trim() !== "") {
        h["x-course-id"] = String(s.selectedCourseId)
      }
      if (s.selectedSessionId != null && String(s.selectedSessionId).trim() !== "") {
        h["x-session-id"] = String(s.selectedSessionId)
      }
      if (s.selectedAcademicTermId != null && String(s.selectedAcademicTermId).trim() !== "") {
        h["x-academic-term-id"] = String(s.selectedAcademicTermId)
      }
      if (s.selectedUniversityId != null && String(s.selectedUniversityId).trim() !== "") {
        const institutionId = String(s.selectedUniversityId)
        h["x-university-id"] = institutionId
        h["x-institution-id"] = institutionId
      }
    }
  } catch {
    /* ignore */
  }

  return h
}
