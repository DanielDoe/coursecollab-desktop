"use client"

let loggingOut = false
let fetchGuardInstalled = false

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

/** End the portal session and send the user to login. Safe to call repeatedly. */
export function forceExpiredSessionLogout(): void {
  if (typeof window === "undefined") return
  if (loggingOut) return
  if (isPublicAuthPage()) return
  loggingOut = true
  void beginExpiredLogout()
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
  void recoverOrLogout()
}

let recovering = false

async function recoverOrLogout(): Promise<void> {
  if (loggingOut || recovering) return
  recovering = true
  try {
    const { tryKeepAliveServerSession } = await import("@/lib/session-keepalive")
    const recovered = await tryKeepAliveServerSession({ force: true })
    if (recovered) return
  } catch {
    /* fall through to logout */
  } finally {
    recovering = false
  }
  forceExpiredSessionLogout()
}

async function beginExpiredLogout(): Promise<void> {
  try {
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
