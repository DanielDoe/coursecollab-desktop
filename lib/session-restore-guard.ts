"use client"

const STUDENT_EXPLICIT_SIGNOUT_KEY = "studentExplicitSignOut"
const FACULTY_EXPLICIT_SIGNOUT_KEY = "facultyExplicitSignOut"

function clearDesktopRefreshTokenSafe(): void {
  void import("@/lib/desktop-refresh-token").then(({ clearDesktopRefreshToken }) => {
    clearDesktopRefreshToken()
  })
}

export function isAuthPublicPath(pathname?: string): boolean {
  const path = pathname ?? (typeof window === "undefined" ? "" : window.location.pathname)
  if (!path) return typeof window === "undefined"
  return (
    path === "/" ||
    path.startsWith("/auth") ||
    path.includes("/login") ||
    path.includes("/signup") ||
    path.includes("/change-password")
  )
}

export function hasSignedOutQuery(): boolean {
  if (typeof window === "undefined") return false
  const params = new URLSearchParams(window.location.search)
  return params.get("signed_out") === "1" || params.get("change") === "1"
}

/** After an explicit sign-out, never silently rebuild a portal session. */
export function shouldBlockSessionRestore(): boolean {
  if (typeof window === "undefined") return true
  try {
    if (
      sessionStorage.getItem(STUDENT_EXPLICIT_SIGNOUT_KEY) ||
      localStorage.getItem(STUDENT_EXPLICIT_SIGNOUT_KEY) ||
      sessionStorage.getItem(FACULTY_EXPLICIT_SIGNOUT_KEY) ||
      localStorage.getItem(FACULTY_EXPLICIT_SIGNOUT_KEY)
    ) {
      return true
    }
  } catch {
    return true
  }
  if (hasSignedOutQuery()) return true
  return false
}

/** Drop stale local portal session blobs (keeps refresh token for silent restore). */
export function clearLeftoverClientSessions(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem("studentSession")
    localStorage.removeItem("instructorSession")
    localStorage.removeItem("instructorId")
    localStorage.removeItem("adminSession")
    localStorage.removeItem("adminId")
    sessionStorage.removeItem("studentId")
    sessionStorage.removeItem("studentName")
    sessionStorage.removeItem("studentSection")
    sessionStorage.removeItem("studentDatabaseId")
    sessionStorage.removeItem("instructorId")
    sessionStorage.removeItem("adminId")
    sessionStorage.removeItem("adminUsername")
  } catch {
    /* ignore */
  }
}

/** Explicit sign-out only — also revoke the desktop refresh token fallback. */
export function clearAllClientSessionsIncludingRefresh(): void {
  clearLeftoverClientSessions()
  clearDesktopRefreshTokenSafe()
}
