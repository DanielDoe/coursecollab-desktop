const BANNER_DISMISSED_KEY = "cc_v2_banner_dismissed"
const BANNER_DISMISSED_AT_KEY = "cc_v2_banner_dismissed_at"

export type DashboardVersion = "v2"

/** Classic dashboard retired — always V2. */
export function getDashboardVersion(): DashboardVersion {
  return "v2"
}

export function setDashboardVersion(_version: "v1" | "v2"): void {
  if (typeof window === "undefined") return
  localStorage.setItem("cc_dashboard_version", "v2")
}

export function isBannerDismissed(): boolean {
  if (typeof window === "undefined") return true
  return localStorage.getItem(BANNER_DISMISSED_KEY) === "true"
}

export function setBannerDismissed(dismissed: boolean): void {
  if (typeof window === "undefined") return
  localStorage.setItem(BANNER_DISMISSED_KEY, dismissed ? "true" : "false")
  if (dismissed) {
    localStorage.setItem(BANNER_DISMISSED_AT_KEY, Date.now().toString())
  } else {
    localStorage.removeItem(BANNER_DISMISSED_AT_KEY)
  }
}

export function shouldShowBanner(): boolean {
  return false
}
