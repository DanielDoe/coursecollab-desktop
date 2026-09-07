import type { AppThemeTokens } from "@/lib/appearance/app-themes"
import { hexToRgba } from "@/lib/appearance/app-themes"

export type DrawerNavTheme = {
  primary: string
  primaryDark: string
  soft: string
  softBorder: string
  navActiveBg: string
  navActiveBorder: string
  navIdleBg: string
  navHoverBg: string
  panelBg: string
  headerBorder: string
  label: string
  secondaryLabel: string
  chipActiveBg: string
  iconWellBg: string
  isGlass: boolean
}

function hairline(isDark: boolean) {
  return isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)"
}

/** Mirrors mobile `drawer-nav-theme.ts` — sidebar chrome from appearance tokens. */
export function drawerNavThemeFromTokens(tokens: AppThemeTokens, glassActive = false): DrawerNavTheme {
  const navHoverBg = tokens.isDark
    ? hexToRgba(tokens.accent, 0.2)
    : hexToRgba(tokens.accent, 0.18)

  const base: DrawerNavTheme = {
    primary: tokens.accent,
    primaryDark: tokens.accentDark,
    soft: tokens.isDark ? tokens.tint : tokens.selected,
    softBorder: tokens.border,
    navActiveBg: tokens.selected,
    navActiveBorder: tokens.border,
    navIdleBg: tokens.surface,
    navHoverBg,
    panelBg: tokens.surface,
    headerBorder: tokens.border,
    label: tokens.text,
    secondaryLabel: tokens.textSecondary,
    chipActiveBg: tokens.selected,
    iconWellBg: tokens.native.fill,
    isGlass: false,
  }

  if (!glassActive) {
    return {
      ...base,
      panelBg: tokens.isDark ? tokens.surface : "#FFFFFF",
      navIdleBg: tokens.isDark ? tokens.surface : "#FFFFFF",
      iconWellBg: tokens.isDark ? tokens.native.fill : "#F0F0F4",
    }
  }

  const line = hairline(tokens.isDark)
  return {
    ...base,
    isGlass: true,
    panelBg: tokens.isDark ? tokens.glass.surface : "#FFFFFF",
    softBorder: line,
    soft: tokens.isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(118, 118, 128, 0.14)",
    navIdleBg: "transparent",
    navHoverBg: tokens.isDark ? "rgba(255, 255, 255, 0.1)" : hexToRgba(tokens.accent, 0.18),
    navActiveBg: tokens.isDark ? "rgba(255, 255, 255, 0.12)" : hexToRgba(tokens.accent, 0.16),
    navActiveBorder: tokens.isDark ? "rgba(255, 255, 255, 0.18)" : hexToRgba(tokens.accent, 0.2),
    chipActiveBg: tokens.isDark ? "rgba(255, 255, 255, 0.1)" : hexToRgba(tokens.accent, 0.14),
    iconWellBg: tokens.isDark ? "rgba(255, 255, 255, 0.1)" : "#F0F0F4",
  }
}
