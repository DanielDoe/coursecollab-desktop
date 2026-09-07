import { getStudentData } from "@/lib/auth"
import { appendNativeAppQuery } from "@/lib/mobile-native-app"

/** Resolve numeric students.id for AI Notetaker API calls (WebView-safe). */
export function resolveNotetakerStudentDbId(): string | null {
  if (typeof window === "undefined") return null
  const session = getStudentData()
  const fromSession = session?.databaseId?.trim()
  if (fromSession) return fromSession
  return sessionStorage.getItem("studentDatabaseId")?.trim() || null
}

export function notetakerAuthHeaders(studentDbId: string): HeadersInit {
  return {
    Accept: "application/json",
    "x-student-database-id": studentDbId,
  }
}

export function notetakerListUrl(
  studentDbId: string,
  q?: string,
  options?: { limit?: number; offset?: number },
): string {
  const params = new URLSearchParams({ studentDatabaseId: studentDbId })
  if (q?.trim()) params.set("q", q.trim())
  if (options?.limit != null) params.set("limit", String(options.limit))
  if (options?.offset != null) params.set("offset", String(options.offset))
  return `/api/student/ai-notetaker?${params.toString()}`
}

export function notetakerNativePath(path: string, native: boolean): string {
  return native ? appendNativeAppQuery(path) : path
}
