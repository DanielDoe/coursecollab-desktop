"use client"

import { getPortalConfig, type PortalKind } from "@/lib/portal-config"

/**
 * Headers for admin API calls: identity + optional selected course scope.
 */
export function buildAdminApiHeaders(base?: HeadersInit): Record<string, string> {
  return buildPortalApiHeaders("admin", base)
}

export function buildAdminAuthorizedApiHeaders(extra?: Record<string, string>): Record<string, string> {
  const out = buildAdminApiHeaders(extra)
  if (typeof localStorage !== "undefined") {
    const raw = localStorage.getItem("adminSession")
    if (raw) out.Authorization = raw
  }
  return out
}

/** Portal-aware API headers for admin or instructor sessions. */
export function buildPortalApiHeaders(portal: PortalKind, base?: HeadersInit): Record<string, string> {
  const cfg = getPortalConfig(portal)
  const out: Record<string, string> = {}
  if (base instanceof Headers) {
    base.forEach((v, k) => {
      out[k] = v
    })
  } else if (Array.isArray(base)) {
    for (const [k, v] of base) {
      out[k] = v
    }
  } else if (base && typeof base === "object") {
    Object.assign(out, base as Record<string, string>)
  }

  let id = typeof localStorage !== "undefined" ? localStorage.getItem(cfg.idStorageKey) : null
  if (!id && typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(cfg.sessionStorageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as { id?: string | number }
        if (parsed?.id != null) id = String(parsed.id)
      }
    } catch {
      /* ignore */
    }
  }
  if (!id && typeof sessionStorage !== "undefined") {
    const legacy = sessionStorage.getItem(cfg.idStorageKey)
    if (legacy) id = legacy
  }
  if (id) {
    out[cfg.idHeader] = id
  }
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(cfg.sessionStorageKey) : null
    if (raw) {
      const s = JSON.parse(raw) as { selectedCourseId?: number }
      if (s?.selectedCourseId != null) {
        out["x-course-id"] = String(s.selectedCourseId)
      }
    }
  } catch {
    /* ignore */
  }
  return out
}
