import { getStudentData } from "@/lib/auth"

/** Append active enrollment catalog ids so server scope matches the course switcher. */
export function appendStudentCatalogScopeToUrl(path: string): string {
  if (typeof window === "undefined") return path
  const data = getStudentData()
  if (!data?.databaseId) return path

  const dbId = Number.parseInt(String(data.databaseId), 10)
  const enrollments = data.enrollments ?? []
  const active =
    (Number.isFinite(dbId)
      ? enrollments.find((row) => row.studentRowId === dbId)
      : undefined) ??
    (data.courseId != null
      ? enrollments.find((row) => row.courseId === data.courseId)
      : undefined)

  const sessionId = active?.sessionId
  const academicTermId = active?.academicTermId
  if (
    (sessionId == null || !Number.isFinite(Number(sessionId))) &&
    (academicTermId == null || !Number.isFinite(Number(academicTermId)))
  ) {
    return path
  }

  const url = new URL(path, window.location.origin)
  if (sessionId != null && Number.isFinite(Number(sessionId)) && Number(sessionId) > 0) {
    url.searchParams.set("catalogSessionId", String(Math.trunc(Number(sessionId))))
  }
  if (academicTermId != null && Number.isFinite(Number(academicTermId)) && Number(academicTermId) > 0) {
    url.searchParams.set("academicTermId", String(Math.trunc(Number(academicTermId))))
  }
  return `${url.pathname}${url.search}`
}
