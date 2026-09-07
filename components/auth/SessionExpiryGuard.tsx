"use client"

import { useEffect } from "react"
import { installDesktopRefreshFetchBridge } from "@/lib/desktop-refresh-token"
import { installSessionExpiryFetchGuard } from "@/lib/session-expiry-logout"
import { installSessionKeepAlive } from "@/lib/session-keepalive"

/** Fetch-guard + periodic refresh so dead server sessions log the user out, live ones stay alive. */
export function SessionExpiryGuard() {
  useEffect(() => {
    installDesktopRefreshFetchBridge()
    installSessionExpiryFetchGuard()
    return installSessionKeepAlive()
  }, [])
  return null
}
