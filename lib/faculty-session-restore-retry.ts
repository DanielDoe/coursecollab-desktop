"use client"

import { isFacultyAuthenticated, readFacultySession } from "@/lib/faculty-auth-flow"
import { tryRestoreFacultySessionFromRefresh } from "@/lib/faculty-session-restore-client"
import { readDesktopRefreshToken } from "@/lib/desktop-refresh-token"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"
import { tryKeepAliveServerSession } from "@/lib/session-keepalive"

/** Restore faculty session from refresh token with retries (desktop/network blips). */
export async function restoreFacultySessionWithRetry(options?: {
  maxAttempts?: number
}): Promise<boolean> {
  if (typeof window === "undefined") return false

  const maxAttempts = options?.maxAttempts ?? (isDesktopAppShell() ? 4 : 2)

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 350 * attempt))
    }

    if (isFacultyAuthenticated()) return true

    const restored = await tryRestoreFacultySessionFromRefresh()
    if (restored && readFacultySession() != null) return true

    if (readDesktopRefreshToken()) {
      const keptAlive = await tryKeepAliveServerSession({ force: true })
      if (keptAlive && readFacultySession() != null) return true
    }
  }

  return readFacultySession() != null
}
