"use client"

import { useEffect } from "react"
import { installDesktopRefreshFetchBridge } from "@/lib/desktop-refresh-token"

/** Ensures Electron-loaded web UI sends refresh tokens on all /api fetch calls. */
export function DesktopRefreshFetchBridge() {
  useEffect(() => {
    installDesktopRefreshFetchBridge()
  }, [])
  return null
}
