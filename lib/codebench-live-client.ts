import { isDesktopElectronShell } from "@/lib/desktop-notifications"

const CLIENT_KEY = "codebench.liveClientId"

function createClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

/** Stable id for this browser or desktop install. Same device, same id. */
export function readCodebenchLiveClientId(): string {
  if (typeof window === "undefined") return "server"
  try {
    const existing = window.localStorage.getItem(CLIENT_KEY)
    if (existing && /^[A-Za-z0-9_-]{8,80}$/.test(existing)) return existing
    const next = createClientId()
    window.localStorage.setItem(CLIENT_KEY, next)
    return next
  } catch {
    return createClientId()
  }
}

export function codebenchLiveClientLabel(): string {
  return isDesktopElectronShell() ? "Desktop app" : "Web"
}

const CLAIM_KEY = "codebench.liveClaim"

export function rememberLiveClaim(assignmentId: string) {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(CLAIM_KEY, String(assignmentId))
  } catch {
    /* ignore */
  }
}

export function peekLiveClaim(assignmentId: string): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.sessionStorage.getItem(CLAIM_KEY) === String(assignmentId)
  } catch {
    return false
  }
}

export function consumeLiveClaim(assignmentId: string): boolean {
  if (typeof window === "undefined") return false
  try {
    const stored = window.sessionStorage.getItem(CLAIM_KEY)
    if (stored !== String(assignmentId)) return false
    window.sessionStorage.removeItem(CLAIM_KEY)
    return true
  } catch {
    return false
  }
}
