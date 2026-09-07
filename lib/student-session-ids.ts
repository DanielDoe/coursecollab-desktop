import { getStudentData, studentApiFetch } from "@/lib/auth"

/** Numeric `students.id` for API calls — localStorage session first, then sessionStorage. */
export function getStudentDatabaseId(): string | null {
  if (typeof window === "undefined") return null
  const session = getStudentData()
  const fromSession = session?.databaseId?.trim()
  if (fromSession) return fromSession
  const fromStorage = sessionStorage.getItem("studentDatabaseId")?.trim()
  return fromStorage || null
}

/** Roster login id used by /api/student/* lecture routes (`students.student_id`). */
export function getStudentLoginId(): string | null {
  if (typeof window === "undefined") return null
  const session = getStudentData()
  const fromSession = session?.id?.trim()
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

function activeEnrollmentFromSession(session: ReturnType<typeof getStudentData>, dbIdNum: number) {
  const enrollments = session?.enrollments ?? []
  if (!enrollments.length) return null

  if (Number.isFinite(dbIdNum)) {
    const byRow = enrollments.find((row) => row.studentRowId === dbIdNum)
    if (byRow) return byRow
  }

  const courseId = session?.courseId ?? null
  const section = session?.section?.trim()
  if (courseId != null && section) {
    const byCourseSection = enrollments.find(
      (row) => row.courseId === courseId && row.section?.trim() === section,
    )
    if (byCourseSection) return byCourseSection
  }

  if (courseId != null) {
    return enrollments.find((row) => row.courseId === courseId) ?? null
  }

  return null
}

/** Append course + student db id + catalog session/term for student-scoped API calls. */
export function buildStudentScopedSearchParams(
  extra?: Record<string, string | undefined | null>,
): URLSearchParams {
  const params = new URLSearchParams()
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value != null && value !== "") params.set(key, String(value))
    }
  }
  const session = getStudentData()
  const courseId = session?.courseId ?? getStudentCourseIdFromSession()
  if (courseId != null) params.set("courseId", String(courseId))
  const dbIdFromSession = session?.databaseId?.trim()
  const dbIdFromStorage =
    typeof sessionStorage !== "undefined" ? sessionStorage.getItem("studentDatabaseId")?.trim() : null
  const dbId = dbIdFromSession || dbIdFromStorage
  if (dbId) params.set("studentDatabaseId", dbId)

  const dbIdNum = dbId ? Number.parseInt(dbId, 10) : NaN
  const activeEnrollment = activeEnrollmentFromSession(session, dbIdNum)
  if (activeEnrollment?.academicTermId != null) {
    params.set("academicTermId", String(activeEnrollment.academicTermId))
  }
  if (activeEnrollment?.sessionId != null) {
    params.set("catalogSessionId", String(activeEnrollment.sessionId))
  }
  return params
}
