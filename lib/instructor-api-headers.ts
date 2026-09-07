"use client"

import { logoutOnUnauthorizedResponse } from "@/lib/session-expiry-logout"
import { applyDesktopRefreshHeader } from "@/lib/desktop-refresh-token"

/**
 * Headers for instructor API calls: identity + selected course scope.
 */
export function usesInstructorScopedCourseApi(): boolean {
  if (typeof localStorage === "undefined") return false
  if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("adminId")) return false
  return !!localStorage.getItem("instructorId")
}

export function buildInstructorApiHeaders(base?: HeadersInit): Record<string, string> {
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

  const instructorId = typeof localStorage !== "undefined" ? localStorage.getItem("instructorId") : null
  if (instructorId) {
    out["x-instructor-id"] = instructorId
  }
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem("instructorSession") : null
    if (raw) {
      const s = JSON.parse(raw) as {
        selectedCourseId?: number
        selectedSessionId?: number
        selectedAcademicTermId?: number
        selectedUniversityId?: number
        id?: number | string
      }
      if (!out["x-instructor-id"] && s?.id != null) {
        out["x-instructor-id"] = String(s.id)
      }
      if (s?.selectedCourseId != null) {
        out["x-course-id"] = String(s.selectedCourseId)
      }
      if (s?.selectedSessionId != null) {
        out["x-session-id"] = String(s.selectedSessionId)
      }
      if (s?.selectedAcademicTermId != null) {
        out["x-academic-term-id"] = String(s.selectedAcademicTermId)
      }
      if (s?.selectedUniversityId != null) {
        const institutionId = String(s.selectedUniversityId)
        out["x-university-id"] = institutionId
        out["x-institution-id"] = institutionId
      }
    }
  } catch {
    /* ignore */
  }
  if (!out["x-university-id"] && typeof sessionStorage !== "undefined") {
    const sessionUni = sessionStorage.getItem("selectedUniversityId")
    if (sessionUni?.trim()) {
      out["x-university-id"] = sessionUni.trim()
      out["x-institution-id"] = sessionUni.trim()
    }
  }
  if (!out["x-course-id"] && typeof localStorage !== "undefined") {
    const legacyCourseId = localStorage.getItem("selectedCourseId")?.trim()
    if (legacyCourseId) out["x-course-id"] = legacyCourseId
  }
  return out
}

function isHttpHeaderSafe(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 255) return false
  }
  return true
}

/** Legacy plain token only — never send JSON session blobs (unicode breaks `Headers.set`). */
export function buildInstructorAuthorizedApiHeaders(extra?: Record<string, string>): Record<string, string> {
  const out = buildInstructorApiHeaders(extra)
  if (typeof localStorage !== "undefined") {
    const raw = localStorage.getItem("instructorSession")?.trim()
    if (raw && !raw.startsWith("{") && isHttpHeaderSafe(raw)) {
      out.Authorization = raw
    }
  }
  return out
}

function setHeaderIfSafe(headers: Headers, key: string, value: string | undefined): void {
  if (!value || !isHttpHeaderSafe(value)) return
  headers.set(key, value)
}

/** Same-origin instructor API calls must include the httpOnly refresh cookie. */
export function withInstructorApiInit(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers)
  const authHeaders = buildInstructorAuthorizedApiHeaders()
  for (const [key, value] of Object.entries(authHeaders)) {
    setHeaderIfSafe(headers, key, value)
  }
  applyDesktopRefreshHeader(headers)
  return { ...init, credentials: "include", headers }
}

export async function instructorApiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const nextInit = withInstructorApiInit(init)
  const response = await fetch(input, nextInit)
  logoutOnUnauthorizedResponse(response, input, nextInit)
  return response
}
