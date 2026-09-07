"use client"

import { isStudentAuthenticated, setStudentSession } from "@/lib/auth"
import { persistRememberedStudentAuth } from "@/lib/remembered-auth"
import type { UniversityRecord } from "@/lib/universities-shared"
import {
  captureRefreshTokenFromResponse,
  readDesktopRefreshToken,
  withDesktopRefreshInit,
} from "@/lib/desktop-refresh-token"

export type StudentSessionRefreshResponse = {
  refreshed?: boolean
  rememberMe?: boolean
  effectiveMembershipTier?: string
  university?: UniversityRecord
  student?: Record<string, unknown>
  enrollment?: {
    courseId: number
    courseCode: string
    courseTitle: string
    section: string
  }
  enrollments?: Array<{
    courseId: number
    courseCode: string
    courseTitle: string
    section?: string
    studentRowId?: number
    academicTermId?: number | null
    academicTermLabel?: string | null
  }>
  userType?: string
  error?: string
}

export function applyStudentSessionRefreshPayload(data: StudentSessionRefreshResponse): boolean {
  if (hasStudentExplicitSignOut()) return false

  const student = data.student
  const enrollment = data.enrollment
  const university = data.university
  if (!student || !enrollment || !university) return false

  const rememberMe = data.rememberMe ?? true

  setStudentSession({
    id: String(student.student_id ?? ""),
    name: String(student.full_name ?? ""),
    section: enrollment.section,
    databaseId: String(student.id ?? ""),
    rememberMe,
    universityId: university.id,
    universityName: university.name,
    universityShortName: university.short_name,
    courseId: enrollment.courseId,
    courseCode: enrollment.courseCode,
    courseTitle: enrollment.courseTitle,
    enrollments: data.enrollments,
  })

  const membershipTier = data.effectiveMembershipTier || String(student.membership_tier ?? "Scholar")
  sessionStorage.setItem("studentMembershipTier", membershipTier)
  localStorage.setItem("studentMembershipTier", membershipTier)

  persistRememberedStudentAuth({
    university,
    identifier: String(student.student_id ?? "").trim(),
    rememberMe,
  })

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("student-session-ready"))
  }

  return true
}

export const STUDENT_SKIP_SESSION_RESTORE_KEY = "studentSkipSessionRestore"
/** Set on explicit logout; blocks refresh restore until the user signs in again. */
export const STUDENT_EXPLICIT_SIGNOUT_KEY = "studentExplicitSignOut"

export function hasStudentExplicitSignOut(): boolean {
  if (typeof window === "undefined") return false
  return Boolean(
    sessionStorage.getItem(STUDENT_EXPLICIT_SIGNOUT_KEY) ||
      localStorage.getItem(STUDENT_EXPLICIT_SIGNOUT_KEY),
  )
}

export function markStudentExplicitSignOut(): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(STUDENT_EXPLICIT_SIGNOUT_KEY, "1")
  localStorage.setItem(STUDENT_EXPLICIT_SIGNOUT_KEY, "1")
}

export function clearStudentExplicitSignOutFlag(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(STUDENT_EXPLICIT_SIGNOUT_KEY)
  localStorage.removeItem(STUDENT_EXPLICIT_SIGNOUT_KEY)
}

let inflightStudentRestore: Promise<boolean> | null = null

/** Restore local student session from httpOnly refresh cookie when storage expired. */
export async function tryRestoreStudentSessionFromRefresh(): Promise<boolean> {
  if (inflightStudentRestore) return inflightStudentRestore

  inflightStudentRestore = (async () => {
    if (typeof window === "undefined") return false
    const { shouldBlockSessionRestore } = await import("@/lib/session-restore-guard")
    if (shouldBlockSessionRestore() || hasStudentExplicitSignOut()) return false
    if (sessionStorage.getItem(STUDENT_SKIP_SESSION_RESTORE_KEY)) {
      sessionStorage.removeItem(STUDENT_SKIP_SESSION_RESTORE_KEY)
      return false
    }

    try {
      const res = await fetch(
        "/api/auth/refresh",
        withDesktopRefreshInit({
          method: "POST",
          credentials: "include",
        }),
      )
      captureRefreshTokenFromResponse(res)

      if (!res.ok) {
        if (res.status === 401 && isStudentAuthenticated() && !readDesktopRefreshToken()) {
          sessionStorage.setItem("studentSessionExpired", "1")
          localStorage.removeItem("studentSession")
          sessionStorage.removeItem("studentId")
          sessionStorage.removeItem("studentName")
          sessionStorage.removeItem("studentSection")
          sessionStorage.removeItem("studentDatabaseId")
        }
        return false
      }

      const data = (await res.json()) as StudentSessionRefreshResponse
      if (data.userType && data.userType !== "student") return false

      return applyStudentSessionRefreshPayload(data)
    } catch {
      return false
    } finally {
      inflightStudentRestore = null
    }
  })()

  return inflightStudentRestore
}
