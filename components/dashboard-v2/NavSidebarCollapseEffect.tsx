"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { isDashboardV2LandingPath, normalizeDashboardPath } from "@/lib/dashboard-v2-layout"

function isExpandedModuleSubpath(
  pathname: string | null | undefined,
  modulePrefixPaths: string[] | undefined,
): boolean {
  if (!pathname || !modulePrefixPaths?.length) return false
  const current = normalizeDashboardPath(pathname)
  return modulePrefixPaths.some((p) => {
    const base = normalizeDashboardPath(p)
    return current === base || current.startsWith(`${base}/`)
  })
}

/**
 * Expands the sidebar on dashboard landing pages; collapses to icon rail on
 * sub-pages so content areas get maximum horizontal space.
 */
export function NavSidebarCollapseEffect({
  landingPaths,
  modulePrefixPaths,
  setSidebarCollapsed,
  setMobileSidebarOpen,
}: {
  landingPaths: string[]
  /** Module routes (e.g. practice/quiz) that keep the sidebar expanded on sub-pages. */
  modulePrefixPaths?: string[]
  setSidebarCollapsed: (collapsed: boolean) => void
  setMobileSidebarOpen?: (open: boolean) => void
}) {
  const pathname = usePathname()

  useEffect(() => {
    setMobileSidebarOpen?.(false)
    const keepExpanded =
      isDashboardV2LandingPath(pathname, landingPaths) ||
      isExpandedModuleSubpath(pathname, modulePrefixPaths)
    setSidebarCollapsed(!keepExpanded)
  }, [pathname, landingPaths, modulePrefixPaths, setSidebarCollapsed, setMobileSidebarOpen])

  return null
}
