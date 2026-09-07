"use client"

import { useEffect } from "react"
import {
  clearBrandSurfaceBrowserChromeFlag,
  syncBrandSurfaceBrowserChrome,
} from "@/lib/appearance/brand-surface-chrome"

/**
 * Brand-locked pages (landing, auth) follow OS light/dark via CSS media queries.
 * Saved in-app appearance prefs can disagree, leaving Safari's URL bar white in OS dark mode.
 */
export function BrandSurfaceChromeSync() {
  useEffect(() => {
    const resync = () => syncBrandSurfaceBrowserChrome()

    resync()

    const schemeMq = window.matchMedia("(prefers-color-scheme: dark)")
    schemeMq.addEventListener("change", resync)
    window.addEventListener("appearance-change", resync)

    return () => {
      schemeMq.removeEventListener("change", resync)
      window.removeEventListener("appearance-change", resync)
      clearBrandSurfaceBrowserChromeFlag()
    }
  }, [])

  return null
}
