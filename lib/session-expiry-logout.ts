"use client"

import { isDesktopAppShell } from "@/lib/desktop-auth-policy"
import {
  DESKTOP_REFRESH_TOKEN_HEADER,
} from "@/lib/desktop-refresh-token"

let loggingOut = false
let fetchGuardInstalled = false
let logoutTimer: ReturnType<typeof setTimeout> | null = null

const SKIP_URL_PARTS = [
  "/api/auth/",
  "/api/mfa/",
  "/api/student/login",
  "/api/instructor/login",
  "/api/faculty/login",
  "/api/admin/login",
  "/api/health",
]

/** 401 here is not a dead portal session — do not force logout. */
const IGNORE_401_URL_PARTS = [
  "/api/presence",
  "/api/platform/activity",
  "/api/system-log",
  "/api/admin/",
]

function requestUrl(input: RequestInfo | URL | undefined): string {
  if (!input) return ""
  if (typeof input === "string") return input
  if (input instanceof URL) return input.href
  if (typeof Request !== "undefined" && input instanceof Request) return input.url
  return String(input)
}

function requestHeaders(input: RequestInfo | URL | undefined, init?: RequestInit): Headers {
  const headers = new Headers()
  if (typeof Request !== "undefined" && input instanceof Request) {
    input.headers.forEach((value, key) => headers.set(key, value))
  }
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => headers.set(key, value))
  }
  return headers
}

function isAuthFlowUrl(url: string): boolean {
  const path = url.split("?")[0]
  return SKIP_URL_PARTS.some((part) => path.includes(part))
}

function isIgnorableUnauthorizedUrl(url: string): boolean {
  const path = url.split("?")[0]
  return IGNORE_401_URL_PARTS.some((part) => path.includes(part))
}

function isPublicAuthPage(): boolean {
  const path = window.location.pathname
  return (
    path === "/" ||
    path.startsWith("/auth") ||
    path.includes("/login") ||
    path.includes("/signup") ||
    path.includes("/change-password")
  )
}

function isFacultyPortalPath(): boolean {
  const path = window.location.pathname
  return path.startsWith("/faculty") || path.startsWith("/instructor")
}

function isStudentPortalPath(): boolean {
  const path = window.location.pathname
  return path.startsWith("/student") || path.startsWith("/guest")
}

function isCrossPortalUnauthorized(headers: Headers): boolean {
  const hasStudent = Boolean(headers.get("x-student-id")?.trim())
  const hasInstructor = Boolean(headers.get("x-instructor-id")?.trim())
  if (isFacultyPortalPath() && hasStudent && !hasInstructor) return true
  if (isStudentPortalPath() && hasInstructor && !hasStudent) return true
  return false
}

function hasLocalPortalSession(): boolean {
  try {
    if (isFacultyPortalPath()) return Boolean(localStorage.getItem("instructorSession"))
    if (isStudentPortalPath()) return Boolean(localStorage.getItem("studentSession"))
    if (window.location.pathname.startsWith("/admin")) return Boolean(localStorage.getItem("adminSession"))
    return Boolean(
      localStorage.getItem("studentSession") ||
        localStorage.getItem("instructorSession") ||
        localStorage.getItem("adminSession"),
    )
  } catch {
    return false
  }
}

/**
 * Skip only when this looks like an anonymous/misrouted call AND the user
 * has no local portal session. A stored session + 401 means the server
 * session died — log them out instead of leaving a zombie shell.
 */
function lacksCurrentPortalIdentity(headers: Headers): boolean {
  if (hasLocalPortalSession()) return false
  if (isFacultyPortalPath()) return !headers.get("x-instructor-id")?.trim()
  if (isStudentPortalPath()) return !headers.get("x-student-id")?.trim()
  if (window.location.pathname.startsWith("/admin")) return !headers.get("x-admin-id")?.trim()
  return false
}

/** Only treat 401 as session death when the call was actually authenticated. */
function wasMeaningfulAuthenticatedRequest(
  url: string,
  headers: Headers,
  init?: RequestInit,
  input?: RequestInfo | URL,
): boolean {
  if (
    headers.get("x-student-id")?.trim() ||
    headers.get("x-instructor-id")?.trim() ||
    headers.get("x-admin-id")?.trim() ||
    headers.get(DESKTOP_REFRESH_TOKEN_HEADER)?.trim()
  ) {
    return true
  }

  const path = url.split("?")[0]
  if (!path.includes("/api/")) return false

  let credentials = init?.credentials
  if (
    credentials == null &&
    typeof Request !== "undefined" &&
    input instanceof Request
  ) {
    credentials = input.credentials
  }
  return credentials === "include"
}

/** End the portal session and send the user to login. Safe to call repeatedly. */
export function forceExpiredSessionLogout(): void {
  if (typeof window === "undefined") return
  if (loggingOut) return
  if (isPublicAuthPage()) return
  if (logoutTimer) {
    clearTimeout(logoutTimer)
    logoutTimer = null
  }
  loggingOut = true
  void beginExpiredLogout()
}

function scheduleExpiredSessionLogout(): void {
  if (typeof window === "undefined") return
  if (loggingOut || isPublicAuthPage()) return
  if (logoutTimer) clearTimeout(logoutTimer)
  const debounceMs = isDesktopAppShell() ? 2000 : 400
  logoutTimer = setTimeout(() => {
    logoutTimer = null
    void recoverOrLogout()
  }, debounceMs)
}

/** If an API returned 401, try one server refresh, then log out if it failed. */
export function logoutOnUnauthorizedResponse(
  response: Response,
  input?: RequestInfo | URL,
  init?: RequestInit,
): void {
  if (typeof window === "undefined") return
  if (response.status !== 401) return
  if (loggingOut) return
  if (isPublicAuthPage()) return
  const url = requestUrl(input) || response.url || ""
  if (isAuthFlowUrl(url)) return
  if (isIgnorableUnauthorizedUrl(url)) return
  const headers = requestHeaders(input, init)
  if (isCrossPortalUnauthorized(headers)) return
  if (lacksCurrentPortalIdentity(headers)) return
  if (!wasMeaningfulAuthenticatedRequest(url, headers, init, input)) return
  scheduleExpiredSessionLogout()
}

let recovering = false


async function restoreCurrentPortalSessionWithRetry(): Promise<boolean> {
  if (isFacultyPortalPath()) {
    const { restoreFacultySessionWithRetry } = await import("@/lib/faculty-session-restore-retry")
    return restoreFacultySessionWithRetry({ maxAttempts: isDesktopAppShell() ? 4 : 2 })
  }
  if (isDesktopAppShell()) {
    const { restoreStudentSessionWithRetry } = await import("@/lib/student-session-restore-retry")
    return restoreStudentSessionWithRetry({ maxAttempts: 4 })
  }
  const { tryKeepAliveServerSession } = await import("@/lib/session-keepalive")
  return tryKeepAliveServerSession({ force: true })
}

async function recoverOrLogout(): Promise<void> {
  if (loggingOut || recovering) return
  recovering = true
  try {
    const recovered = await restoreCurrentPortalSessionWithRetry()
    if (recovered) {
      if (logoutTimer) {
        clearTimeout(logoutTimer)
        logoutTimer = null
      }
      window.dispatchEvent(new Event("cc-session-restored"))
      return
    }

    if (isDesktopAppShell()) {
      const { readDesktopRefreshToken } = await import("@/lib/desktop-refresh-token")
      if (readDesktopRefreshToken()) {
        if (logoutTimer) clearTimeout(logoutTimer)
        logoutTimer = setTimeout(() => {
          logoutTimer = null
          void recoverOrLogout()
        }, 5000)
        return
      }
    }
  } catch {
    /* fall through to logout */
  } finally {
    recovering = false
  }
  forceExpiredSessionLogout()
}

async function beginExpiredLogout(): Promise<void> {
  try {
    const recovered = await restoreCurrentPortalSessionWithRetry()
    if (recovered) {
      loggingOut = false
      window.dispatchEvent(new Event("cc-session-restored"))
      return
    }

    if (isDesktopAppShell()) {
      const { readDesktopRefreshToken } = await import("@/lib/desktop-refresh-token")
      if (readDesktopRefreshToken()) {
        loggingOut = false
        return
      }
    }

    const path = window.location.pathname
    if (path.startsWith("/faculty") || path.startsWith("/instructor")) {
      const { logoutFaculty } = await import("@/lib/faculty-auth-flow")
      await logoutFaculty({ sessionExpired: true })
      return
    }
    if (path.startsWith("/admin")) {
      const { logoutAdmin } = await import("@/lib/auth")
      logoutAdmin()
      return
    }
    if (
      path.startsWith("/student") ||
      path.startsWith("/guest") ||
      path.startsWith("/auth") ||
      localStorage.getItem("studentSession")
    ) {
      const { logoutStudent } = await import("@/lib/auth")
      await logoutStudent(true)
      return
    }
    if (localStorage.getItem("instructorSession")) {
      const { logoutFaculty } = await import("@/lib/faculty-auth-flow")
      await logoutFaculty({ sessionExpired: true })
      return
    }
    if (localStorage.getItem("adminSession")) {
      const { logoutAdmin } = await import("@/lib/auth")
      logoutAdmin()
      return
    }
    const { logoutStudent } = await import("@/lib/auth")
    await logoutStudent(true)
  } catch {
    window.location.href = "/auth/student?reason=session_expired"
  }
}

/** Catch 401s from raw `fetch()` as well as the portal wrappers. */
export function installSessionExpiryFetchGuard(): void {
  if (typeof window === "undefined" || fetchGuardInstalled) return
  fetchGuardInstalled = true
  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await originalFetch(input, init)
    logoutOnUnauthorizedResponse(response, input, init)
    return response
  }
}
