"use client"

import {
  applyRememberedCourseToSession,
  clearFacultySessionStorage,
  completeFacultySessionAfterRestore,
  readFacultySession,
  saveFacultySession,
} from "@/lib/faculty-auth-flow"
import {
  applyFacultySkipCourseScope,
  retainFacultyCourseScopeOnRefresh,
} from "@/lib/faculty-course-session-sync"
import { persistRememberedFacultyAuth, readRememberedFacultyLogin, readRememberedFacultyUniversity } from "@/lib/remembered-auth"
import {
  captureRefreshTokenFromResponse,
  withDesktopRefreshInit,
  readDesktopRefreshToken,
} from "@/lib/desktop-refresh-token"
import { desktopSessionDurationMs, effectiveRememberMeForClient, isDesktopAppShell } from "@/lib/desktop-auth-policy"
import { syncInstructorMembershipTierCache } from "@/lib/faculty-membership-cache"

export type FacultySessionRefreshResponse = {
  refreshed?: boolean
  rememberMe?: boolean
  userType?: string
  instructor?: Record<string, unknown>
  error?: string
}

export function applyFacultySessionRefreshPayload(data: FacultySessionRefreshResponse): boolean {
  if (hasFacultyExplicitSignOut()) return false

  const instructor = data.instructor
  if (!instructor || instructor.id == null) return false

  const existing = readFacultySession()
  const skippedScope = existing?.courseScopeSkipped === true

  let session = skippedScope
    ? ({ ...instructor } as Record<string, unknown>)
    : applyRememberedCourseToSession({ ...instructor })

  if (existing?.selectedCourseId != null) {
    session = retainFacultyCourseScopeOnRefresh(session, existing)
  } else if (skippedScope) {
    session = applyFacultySkipCourseScope(session)
  } else if (instructor.selectedUniversityId != null) {
    session = {
      ...session,
      selectedUniversityId: instructor.selectedUniversityId,
    }
  } else if (existing?.selectedUniversityId != null) {
    session = {
      ...session,
      selectedUniversityId: existing.selectedUniversityId,
    }
  }

  saveFacultySession({
    ...session,
    rememberMe: effectiveRememberMeForClient(data.rememberMe === true),
    expiresAt:
      Date.now() +
      (isDesktopAppShell()
        ? desktopSessionDurationMs()
        : data.rememberMe === true
          ? 30
          : 7) *
        24 *
        60 *
        60 *
        1000,
  })

  const rememberedLogin = readRememberedFacultyLogin()
  const rememberedUniversity = readRememberedFacultyUniversity()
  if (rememberedLogin?.rememberMe && rememberedUniversity) {
    persistRememberedFacultyAuth({
      university: rememberedUniversity,
      username: String(instructor.username ?? rememberedLogin.username),
      rememberMe: true,
      courseKey: existing?.selectedCourseId != null ? undefined : null,
    })
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("faculty-session-ready"))
  }

  void syncInstructorMembershipTierCache(instructor.id)

  return true
}

/** Set on explicit logout; blocks refresh restore until the user signs in again. */
export const FACULTY_EXPLICIT_SIGNOUT_KEY = "facultyExplicitSignOut"

export function hasFacultyExplicitSignOut(): boolean {
  if (typeof window === "undefined") return false
  return Boolean(
    sessionStorage.getItem(FACULTY_EXPLICIT_SIGNOUT_KEY) ||
      localStorage.getItem(FACULTY_EXPLICIT_SIGNOUT_KEY),
  )
}

export function markFacultyExplicitSignOut(): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(FACULTY_EXPLICIT_SIGNOUT_KEY, "1")
  localStorage.setItem(FACULTY_EXPLICIT_SIGNOUT_KEY, "1")
}

export function clearFacultyExplicitSignOutFlag(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(FACULTY_EXPLICIT_SIGNOUT_KEY)
  localStorage.removeItem(FACULTY_EXPLICIT_SIGNOUT_KEY)
}

let inflightFacultyRestore: Promise<boolean> | null = null

/** Restore local faculty session from httpOnly refresh cookie when storage expired. */
export async function tryRestoreFacultySessionFromRefresh(): Promise<boolean> {
  if (inflightFacultyRestore) return inflightFacultyRestore

  inflightFacultyRestore = (async () => {
    if (typeof window === "undefined") return false
    const { shouldBlockSessionRestore } = await import("@/lib/session-restore-guard")
    if (shouldBlockSessionRestore() || hasFacultyExplicitSignOut()) return false

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
        if (res.status === 401 && readFacultySession()) {
          const hasDesktopRefresh = isDesktopAppShell() && Boolean(readDesktopRefreshToken())
          if (!hasDesktopRefresh) {
            clearFacultySessionStorage()
          }
        }
        return false
      }

      const data = (await res.json()) as FacultySessionRefreshResponse
      if (data.userType !== "instructor") return false
      if (!applyFacultySessionRefreshPayload(data)) return false
      const session = readFacultySession()
      if (!session) return false
      await completeFacultySessionAfterRestore(session)
      return true
    } catch {
      return false
    } finally {
      inflightFacultyRestore = null
    }
  })()

  return inflightFacultyRestore
}
