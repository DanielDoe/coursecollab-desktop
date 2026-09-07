"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { buildPortalApiHeaders } from "@/lib/admin-api-headers"
import type { PortalKind } from "@/lib/portal-config"

function detectPortal(pathname: string | null): PortalKind | "student" | "summer_camper" | null {
  if (!pathname) return null
  if (pathname.startsWith("/admin")) return "admin"
  if (pathname.startsWith("/faculty") || pathname.startsWith("/instructor")) return "faculty"
  if (pathname.includes("/summer-camp")) return "summer_camper"
  if (pathname.startsWith("/student")) return "student"
  return null
}

function buildHeaders(portal: ReturnType<typeof detectPortal>): Record<string, string> {
  if (portal === "admin" || portal === "faculty") {
    return buildPortalApiHeaders(portal)
  }
  const out: Record<string, string> = {}
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem("studentSession")
      if (raw) {
        const s = JSON.parse(raw) as { databaseId?: string; id?: string | number }
        const dbId = s.databaseId ?? sessionStorage.getItem("studentDatabaseId")
        if (dbId) {
          out["x-student-id"] = String(dbId)
        } else if (s.id != null) {
          // Legacy sessions stored roster student_id in `id` — avoid when databaseId exists
          out["x-student-id"] = String(s.id)
        }
      }
    } catch {
      /* ignore */
    }
  }
  return out
}

function pageSummary(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean)
  const last = segments[segments.length - 1] ?? "dashboard"
  const label = last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  return `Viewed ${label}`
}

/** Logs page navigation to platform activity API (debounced per path). */
export function PlatformActivityTracker() {
  const pathname = usePathname()
  const lastLogged = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname || pathname.includes("/login")) return

    const portal = detectPortal(pathname)
    if (!portal) return

    const key = `${portal}:${pathname}`
    if (lastLogged.current === key) return
    lastLogged.current = key

    const headers = buildHeaders(portal)
    if (!headers["x-admin-id"] && !headers["x-instructor-id"] && !headers["x-student-id"]) {
      return
    }

    const portalValue =
      portal === "summer_camper" ? "summer_camper" : portal === "student" ? "student" : portal

    void instructorApiFetch("/api/platform/activity", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
        "x-activity-path": pathname,
      },
      body: JSON.stringify({
        portal: portalValue,
        action: "page_view",
        category: "navigation",
        path: pathname,
        summary: pageSummary(pathname),
      }),
    }).catch(() => {
      /* non-blocking */
    })
  }, [pathname])

  return null
}
