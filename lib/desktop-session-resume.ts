"use client"

import { isAdminAuthenticated, isStudentAuthenticated } from "@/lib/auth"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"
import { isFacultyAuthenticated } from "@/lib/faculty-auth-flow"
import { restoreFacultySessionWithRetry } from "@/lib/faculty-session-restore-retry"
import { hasFacultyExplicitSignOut } from "@/lib/faculty-session-restore-client"
import { hasStudentExplicitSignOut } from "@/lib/student-session-restore-client"
import { restoreStudentSessionWithRetry } from "@/lib/student-session-restore-retry"
import { shouldBlockSessionRestore } from "@/lib/session-restore-guard"

export type DesktopPortal = "student" | "faculty" | "admin"

const LAST_PORTAL_KEY = "ccDesktopLastPortal"

export function readLastDesktopPortal(): DesktopPortal | null {
  if (typeof window === "undefined") return null
  const value = window.localStorage.getItem(LAST_PORTAL_KEY)
  if (value === "student" || value === "faculty" || value === "admin") return value
  return null
}

export function persistLastDesktopPortal(portal: DesktopPortal): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(LAST_PORTAL_KEY, portal)
  } catch {
    /* ignore */
  }
}

export function homePathForPortal(portal: DesktopPortal): string {
  if (portal === "faculty") return "/faculty/dashboard"
  if (portal === "admin") return "/admin/dashboard-v2"
  return "/student/dashboard-v2"
}

function currentPortalFromSession(): DesktopPortal | null {
  if (isStudentAuthenticated()) return "student"
  if (isFacultyAuthenticated()) return "faculty"
  if (isAdminAuthenticated()) return "admin"
  return null
}

async function restorePortal(portal: DesktopPortal): Promise<boolean> {
  if (portal === "student") {
    if (hasStudentExplicitSignOut()) return false
    return restoreStudentSessionWithRetry()
  }
  if (portal === "faculty") {
    if (hasFacultyExplicitSignOut()) return false
    return restoreFacultySessionWithRetry()
  }
  return isAdminAuthenticated()
}

/** Reopen an existing desktop login instead of sending the user through welcome. */
export async function resumeDesktopSession(): Promise<string | null> {
  if (typeof window === "undefined") return null
  if (shouldBlockSessionRestore()) return null

  const existing = currentPortalFromSession()
  if (existing) {
    persistLastDesktopPortal(existing)
    return homePathForPortal(existing)
  }

  const order: DesktopPortal[] = []
  const last = readLastDesktopPortal()
  if (last) order.push(last)
  for (const portal of ["student", "faculty", "admin"] as const) {
    if (!order.includes(portal)) order.push(portal)
  }

  for (const portal of order) {
    const restored = await restorePortal(portal)
    if (!restored) continue
    const matched = currentPortalFromSession() ?? portal
    persistLastDesktopPortal(matched)
    return homePathForPortal(matched)
  }

  return null
}

export function rememberDesktopRoute(path: string): void {
  if (!isDesktopAppShell()) return
  if (
    path.startsWith("/student/") ||
    path.startsWith("/faculty/") ||
    path.startsWith("/instructor/") ||
    path.startsWith("/admin/") ||
    path.startsWith("/guest/")
  ) {
    if (path.includes("/login") || path.startsWith("/auth")) return
    void window.courseCollabDesktop?.setLastRoute?.(path.split("?")[0] ?? path)
    if (path.startsWith("/faculty") || path.startsWith("/instructor")) {
      persistLastDesktopPortal("faculty")
    } else if (path.startsWith("/admin")) {
      persistLastDesktopPortal("admin")
    } else {
      persistLastDesktopPortal("student")
    }
  }
}
