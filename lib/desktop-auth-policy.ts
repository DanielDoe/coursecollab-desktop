/** Desktop shell is sign-in only; net-new accounts are created on the web app. */

/** Sent on API requests so the server can issue long-lived refresh tokens. */
export const DESKTOP_CLIENT_HEADER = "x-cc-client"

/** Local + server target for desktop sessions (stay signed in until explicit logout). */
export const DESKTOP_SESSION_DAYS = 365

export function desktopSessionDurationMs(): number {
  return DESKTOP_SESSION_DAYS * 24 * 60 * 60 * 1000
}

export function isDesktopAppShell(): boolean {
  if (typeof window === "undefined") return false
  if (window.courseCollabDesktop?.isDesktopShell === true) return true
  if (window.__COURSE_COLLAB_DESKTOP__ === true) return true
  return document.documentElement.dataset.desktopApp === "true"
}

/** True when the desktop app should hide in-app registration flows. */
export function isDesktopLoginOnlyShell(): boolean {
  return isDesktopAppShell()
}

export function isDesktopAuthLoginOnly(variant?: "default" | "desktop"): boolean {
  return variant === "desktop" || isDesktopAppShell()
}

export function resolveWebAppUrl(path: string): string {
  const fromEnv =
    import.meta.env.VITE_COURSECOLLAB_URL?.trim() ||
    import.meta.env.VITE_API_URL?.trim() ||
    "https://course-collab.com"
  const base = fromEnv.replace(/\/+$/, "")
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${base}${normalizedPath}`
}

export function openWebAppPath(path: string): void {
  if (typeof window === "undefined") return
  const url = resolveWebAppUrl(path)
  window.open(url, "_blank", "noopener,noreferrer")
}

/** Desktop apps always persist sessions; web respects the remember-me checkbox. */
export function effectiveRememberMeForClient(rememberMe?: boolean): boolean {
  if (isDesktopAppShell()) return true
  return rememberMe === true
}

export const DESKTOP_WEB_SIGNUP_PATHS = {
  summerCamp: "/student/login/summer-camp",
  careerMember: "/student/login/guest",
  student: "/auth/university?next=signup",
  faculty: "/faculty/signup",
} as const
