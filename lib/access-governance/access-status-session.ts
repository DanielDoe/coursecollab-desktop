"use client"

import type { AccessRequestStatusPayload } from "@/components/auth/AccessRequestStatusPanel"
import { accessStatusPagePath } from "@/lib/access-governance/access-status-routing"

const STORAGE_KEY = "cc_access_status_payload"
const PORTAL_KEY = "cc_access_status_portal"

export type AccessStatusPortal = "student" | "faculty" | "guest"

export function saveAccessStatusPortal(portal: AccessStatusPortal): void {
  try {
    sessionStorage.setItem(PORTAL_KEY, portal)
  } catch {
    /* ignore */
  }
}

export function loadAccessStatusPortal(): AccessStatusPortal {
  try {
    const value = sessionStorage.getItem(PORTAL_KEY)
    if (value === "faculty" || value === "guest") return value
  } catch {
    /* ignore */
  }
  return "student"
}

export function clearAccessStatusPortal(): void {
  try {
    sessionStorage.removeItem(PORTAL_KEY)
  } catch {
    /* ignore */
  }
}

export function saveAccessStatusPayload(payload: AccessRequestStatusPayload): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadAccessStatusPayload(): AccessRequestStatusPayload | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AccessRequestStatusPayload
  } catch {
    return null
  }
}

export function clearAccessStatusPayload(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
    clearAccessStatusPortal()
  } catch {
    /* ignore */
  }
}

/** Persist payload and return the dedicated status page path, if any. */
export function persistAccessStatusAndGetPath(
  payload: AccessRequestStatusPayload,
): string | null {
  saveAccessStatusPayload(payload)
  if (payload.lifecycle === "not_found") return null
  return accessStatusPagePath(payload.lifecycle)
}

export function redirectToAccessStatusPage(
  router: { push: (href: string) => void },
  payload: AccessRequestStatusPayload,
  portal: AccessStatusPortal = "student",
): boolean {
  saveAccessStatusPortal(portal)
  const path = persistAccessStatusAndGetPath(payload)
  if (!path) return false
  router.push(path)
  return true
}
