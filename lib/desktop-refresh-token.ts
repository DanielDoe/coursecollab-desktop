"use client"

import { DESKTOP_CLIENT_HEADER, isDesktopAppShell } from "@/lib/desktop-auth-policy"

/** Matches server `REFRESH_TOKEN_HEADER` — used when httpOnly cookies are unavailable. */
export const DESKTOP_REFRESH_TOKEN_HEADER = "x-cc-refresh"
const STORAGE_KEY = "ccDesktopRefreshToken"

export function shouldUseDesktopRefreshHeader(): boolean {
  return isDesktopAppShell()
}

export function readDesktopRefreshToken(): string | null {
  if (!shouldUseDesktopRefreshHeader()) return null
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() || null
  } catch {
    return null
  }
}

export function persistDesktopRefreshToken(token: string | null | undefined): void {
  if (!shouldUseDesktopRefreshHeader()) return
  try {
    if (!token?.trim()) return
    localStorage.setItem(STORAGE_KEY, token.trim())
  } catch {
    /* ignore */
  }
}

export function clearDesktopRefreshToken(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function captureRefreshTokenFromResponse(response: Response): void {
  if (!shouldUseDesktopRefreshHeader()) return
  const token = response.headers.get(DESKTOP_REFRESH_TOKEN_HEADER)?.trim()
  if (token) persistDesktopRefreshToken(token)
}

function isSameOriginApiRequest(input: RequestInfo | URL): boolean {
  if (typeof input === "string") {
    return input.startsWith("/api/") || input.includes("/api/")
  }
  if (input instanceof URL) {
    return input.pathname.startsWith("/api/")
  }
  if (typeof Request !== "undefined" && input instanceof Request) {
    try {
      const url = new URL(input.url, window.location.origin)
      return url.pathname.startsWith("/api/")
    } catch {
      return false
    }
  }
  return false
}

export function applyDesktopRefreshHeader(headers: Headers): void {
  if (shouldUseDesktopRefreshHeader()) {
    headers.set(DESKTOP_CLIENT_HEADER, "desktop")
  }
  const token = readDesktopRefreshToken()
  if (token) headers.set(DESKTOP_REFRESH_TOKEN_HEADER, token)
}

export function withDesktopRefreshInit(init?: RequestInit): RequestInit {
  if (!shouldUseDesktopRefreshHeader()) return init ?? {}
  const headers = new Headers(init?.headers)
  applyDesktopRefreshHeader(headers)
  return { ...init, credentials: init?.credentials ?? "include", headers }
}

let bridgeInstalled = false

/** Desktop shell: send stored refresh token on API calls and persist rotated tokens from responses. */
export function installDesktopRefreshFetchBridge(): void {
  if (typeof window === "undefined" || bridgeInstalled || !shouldUseDesktopRefreshHeader()) return
  bridgeInstalled = true

  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const nextInit = isSameOriginApiRequest(input) ? withDesktopRefreshInit(init) : init
    const response = await originalFetch(input, nextInit)
    if (isSameOriginApiRequest(input)) {
      captureRefreshTokenFromResponse(response)
    }
    return response
  }
}
