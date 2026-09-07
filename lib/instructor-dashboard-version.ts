const STORAGE_KEY = "cc_instructor_dashboard_version"
const BANNER_DISMISSED_KEY = "cc_instructor_v2_banner_dismissed"
const BANNER_DISMISSED_AT_KEY = "cc_instructor_v2_banner_dismissed_at"

export type InstructorDashboardVersion = "v1" | "v2"

export function getInstructorDashboardVersion(): InstructorDashboardVersion {
  if (typeof window === "undefined") return "v2"
  const stored = localStorage.getItem(STORAGE_KEY)
  // Default to v2; only use v1 (classic) when user explicitly chose it
  return (stored === "v1" ? "v1" : "v2") as InstructorDashboardVersion
}

export function setInstructorDashboardVersion(version: InstructorDashboardVersion): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, version)
}

export function isInstructorBannerDismissed(): boolean {
  if (typeof window === "undefined") return false
  return localStorage.getItem(BANNER_DISMISSED_KEY) === "true"
}

export function setInstructorBannerDismissed(dismissed: boolean): void {
  if (typeof window === "undefined") return
  localStorage.setItem(BANNER_DISMISSED_KEY, dismissed ? "true" : "false")
  if (dismissed) {
    localStorage.setItem(BANNER_DISMISSED_AT_KEY, Date.now().toString())
  } else {
    localStorage.removeItem(BANNER_DISMISSED_AT_KEY)
  }
}

/** Show banner again if dismissed more than 14 days ago */
export function shouldShowInstructorBanner(): boolean {
  if (typeof window === "undefined") return false
  if (getInstructorDashboardVersion() === "v2") return false
  const path = window.location.pathname
  if (path.startsWith("/faculty/dashboard") || path.startsWith("/instructor/dashboard-v2")) {
    return false
  }
  if (localStorage.getItem(BANNER_DISMISSED_KEY) !== "true") return true

  const dismissedAt = localStorage.getItem(BANNER_DISMISSED_AT_KEY)
  if (!dismissedAt) return true

  const daysSinceDismissal =
    (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24)
  return daysSinceDismissal >= 14
}
