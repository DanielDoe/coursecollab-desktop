"use client"

export const SETTINGS_HUB_BASE = "/student/dashboard-v2/settings"

export type SettingsBrowseId =
  | "account"
  | "appearance"
  | "purchases"
  | "privacy"
  | "cora-usage"

export function resolveSettingsBrowseId(pathname: string | null): SettingsBrowseId {
  const path = (pathname || "").replace(/\/$/, "")
  if (path.endsWith("/appearance")) return "appearance"
  if (path.endsWith("/purchases")) return "purchases"
  if (path.endsWith("/privacy")) return "privacy"
  if (path.endsWith("/cora-usage")) return "cora-usage"
  return "account"
}
