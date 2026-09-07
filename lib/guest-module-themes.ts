/**
 * Guest portal — single brand accent (no accordion groups).
 * @see lib/portal-module-themes.ts
 */

import {
  type PortalModuleThemeTokens,
  type PortalSidebarTheme,
  themeFromFamily,
} from "./portal-module-themes"

export function getGuestPortalTheme(): PortalModuleThemeTokens {
  return themeFromFamily("brand")
}

export function getGuestSidebarTheme(): PortalSidebarTheme {
  return getGuestPortalTheme().sidebar
}

export function guestBreadcrumbClass(): string {
  const t = getGuestPortalTheme()
  return `${t.page.softBg} ${t.page.iconText} border ${t.page.border} shadow-sm`
}
