"use client"

import { detectPortalFromPathname, getPortalConfig, type PortalKind } from "@/lib/portal-config"

/** Resolve portal from current URL (admin vs instructor). */
export function getActivePortal(pathname?: string): PortalKind {
  if (typeof window !== "undefined" && !pathname) {
    return detectPortalFromPathname(window.location.pathname)
  }
  return detectPortalFromPathname(pathname ?? "")
}

export function getActivePortalConfig(pathname?: string) {
  return getPortalConfig(getActivePortal(pathname))
}

export function isAdminPortal(pathname?: string): boolean {
  return getActivePortal(pathname) === "admin"
}
