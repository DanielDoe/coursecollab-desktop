"use client"

import { getStudentData } from "@/lib/auth"
import { readDesktopRefreshToken } from "@/lib/desktop-refresh-token"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"
import { tryKeepAliveServerSession } from "@/lib/session-keepalive"
import { tryRestoreStudentSessionFromRefresh } from "@/lib/student-session-restore-client"

/** Restore student session from refresh token with retries (desktop/network blips). */
export async function restoreStudentSessionWithRetry(options?: {
  maxAttempts?: number
}): Promise<boolean> {
  if (typeof window === "undefined") return false

  const maxAttempts = options?.maxAttempts ?? (isDesktopAppShell() ? 4 : 2)

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 350 * attempt))
    }

    if (getStudentData() != null) return true

    const restored = await tryRestoreStudentSessionFromRefresh()
    if (restored && getStudentData() != null) return true

    if (readDesktopRefreshToken()) {
      const keptAlive = await tryKeepAliveServerSession({ force: true })
      if (keptAlive && getStudentData() != null) return true
    }
  }

  return getStudentData() != null
}
