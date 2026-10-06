import { getStudentData, studentApiFetch } from "@/lib/auth"

/** Session ids are stored as strings, but older sessions saved the numeric students.id. */
export function sessionIdText(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value !== "string") return null
  const text = value.trim()
  return text || null
}

/** Numeric `students.id` for API calls — localStorage session first, then sessionStorage. */
export function getStudentDatabaseId(): string | null {
  if (typeof window === "undefined") return null
  const session = getStudentData()
  const fromSession = sessionIdText(session?.databaseId)
  if (fromSession) return fromSession
  return sessionIdText(sessionStorage.getItem("studentDatabaseId"))
}

/** Roster login id used by /api/student/* lecture routes (`students.student_id`). */
export function getStudentLoginId(): string | null {
  if (typeof window === "undefined") return null
  const session = getStudentData()
  const fromSession = sessionIdText(session?.id)
  if (fromSession) return fromSession
  return sessionStorage.getItem("studentId")
}

export function getStudentCourseIdFromSession(): number | null {
  if (typeof window === "undefined") return null
  const session = getStudentData()
  const raw = session?.courseId
  if (raw == null || raw === "") return null
  const n = Number.parseInt(String(raw), 10)
  return Number.isFinite(n) ? n : null
}

/** Course id for lecture week routing — session first, then /api/student/info. */
export async function resolveStudentCourseIdForLectures(): Promise<number | null> {
  const fromSession = getStudentCourseIdFromSession()
  if (fromSession != null) return fromSession

  const rosterId = getStudentLoginId()
  if (!rosterId) return null

  try {
    const res = await studentApiFetch(`/api/student/info?student_id=${encodeURIComponent(rosterId)}`, {
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = (await res.json()) as { student?: { course_id?: unknown } }
    const raw = data.student?.course_id
    const n = Number.parseInt(String(raw ?? ""), 10)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

/** Append course + student db id for student-scoped API calls. */
export function buildStudentScopedSearchParams(
  extra?: Record<string, string | undefined | null>,
): URLSearchParams {
  const params = new URLSearchParams()
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value != null && value !== "") params.set(key, String(value))
    }
  }
  const courseId = getStudentCourseIdFromSession()
  if (courseId != null) params.set("courseId", String(courseId))
  if (typeof sessionStorage !== "undefined") {
    const dbId = sessionStorage.getItem("studentDatabaseId")
    if (dbId) params.set("studentDatabaseId", dbId)
  }
  return params
}
