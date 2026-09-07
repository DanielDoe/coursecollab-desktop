"use client"

import { buildAdminApiHeaders } from "@/lib/admin-api-headers"
import { getAdminData } from "@/lib/auth"

/** Admin ID from session, or null if not signed in. */
export function getAdminIdOrNull(): string | null {
  const admin = getAdminData()
  return admin?.id != null ? String(admin.id) : null
}

/** Headers + query param for admin API routes that require adminId. */
export function adminApiRequestInit(extra?: HeadersInit): {
  headers: Record<string, string>
  adminId: string | null
} {
  const adminId = getAdminIdOrNull()
  const headers = buildAdminApiHeaders(extra)
  if (adminId) {
    headers["x-admin-id"] = adminId
  }
  return { headers, adminId }
}

export function withAdminIdQuery(url: string, adminId: string | null): string {
  if (!adminId) return url
  const sep = url.includes("?") ? "&" : "?"
  return `${url}${sep}adminId=${encodeURIComponent(adminId)}`
}
