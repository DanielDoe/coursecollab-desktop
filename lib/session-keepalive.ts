"use client"

import { applyStudentSessionRefreshPayload } from "@/lib/student-session-restore-client"
import { applyFacultySessionRefreshPayload } from "@/lib/faculty-session-restore-client"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"
import {
  captureRefreshTokenFromResponse,
  withDesktopRefreshInit,
} from "@/lib/desktop-refresh-token"

const KEEPALIVE_INTERVAL_MS = 6 * 60 * 60 * 1000
const DESKTOP_KEEPALIVE_INTERVAL_MS = 15 * 60 * 1000
const MIN_KEEPALIVE_GAP_MS = 30_000

let inflight: Promise<boolean> | null = null
let lastAttemptAt = 0

function dispatchSessionRestored(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event("cc-session-restored"))
}

/** Refresh the httpOnly session cookie and rewrite local portal state. */
export async function tryKeepAliveServerSession(options?: { force?: boolean }): Promise<boolean> {
  if (typeof window === "undefined") return false
  if (inflight) return inflight

  const now = Date.now()
  if (!options?.force && now - lastAttemptAt < MIN_KEEPALIVE_GAP_MS) return false
  lastAttemptAt = now

  inflight = (async () => {
    try {
      const { isAuthPublicPath, shouldBlockSessionRestore } = await import("@/lib/session-restore-guard")
      if (shouldBlockSessionRestore() || isAuthPublicPath()) return false
      const res = await fetch(
        "/api/auth/refresh",
        withDesktopRefreshInit({
          method: "POST",
          credentials: "include",
        }),
      )
      captureRefreshTokenFromResponse(res)
      if (!res.ok) return false
      const data = (await res.json()) as {
        userType?: string
        refreshed?: boolean
      }
      if (data.userType === "student") {
        const ok = applyStudentSessionRefreshPayload(data)
        if (ok) dispatchSessionRestored()
        return ok
      }
      if (data.userType === "instructor") {
        const ok = applyFacultySessionRefreshPayload(data)
        if (ok) dispatchSessionRestored()
        return ok
      }
      return Boolean(data.refreshed)
    } catch {
      return false
    } finally {
      inflight = null
    }
  })()

  return inflight
}

/** Keep the server session alive while the tab is open. */
export function installSessionKeepAlive(): () => void {
  if (typeof window === "undefined") return () => {}

  const onVisible = () => {
    if (document.visibilityState !== "visible") return
    void tryKeepAliveServerSession()
  }

  void tryKeepAliveServerSession()
  document.addEventListener("visibilitychange", onVisible)
  const intervalMs = isDesktopAppShell() ? DESKTOP_KEEPALIVE_INTERVAL_MS : KEEPALIVE_INTERVAL_MS
  const timer = window.setInterval(() => {
    if (isDesktopAppShell() || document.visibilityState === "visible") {
      void tryKeepAliveServerSession()
    }
  }, intervalMs)

  return () => {
    document.removeEventListener("visibilitychange", onVisible)
    window.clearInterval(timer)
  }
}
