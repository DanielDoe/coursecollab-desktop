/**
 * Cora AI chrome — appearance-aware Color Hunt thumbs for platform nav + capabilities.
 */

import type { AppThemeTokens, ThemeId } from "@/lib/appearance/app-themes"
import { ctaInkOnFill, inkOnFillForMode } from "@/lib/appearance/chrome-ink"
import {
  chromeSwatchForTheme,
  chromeSwatchFromTokens,
  themeChromeFamily,
  type ChromeSwatch,
  type ModuleChromeFamily,
} from "@/lib/appearance/module-chrome"
import { contentThumbsForFamily, type SolidListThumb } from "@/lib/student-color-hunt-theme"
import { CORA_HOME_ACTIONS, CORA_PLATFORM_NAV, type CoraPlatformTab } from "@/lib/cora/platform-nav"

const WHITE = "#FFFFFF"
const FALLBACK_INK = "#1C1917"

function tile(fill: string, icon = WHITE): SolidListThumb {
  return { fill, icon }
}

function thumb(fill: string, isDark: boolean, deep: string): SolidListThumb {
  return tile(fill, inkOnFillForMode(fill, isDark, deep))
}

function cycleThumb(
  fills: readonly string[],
  index: number,
  isDark: boolean,
  deep: string,
  fallback: string,
  onFallback: string,
): SolidListThumb {
  const fill = fills[((index % fills.length) + fills.length) % fills.length] ?? fallback
  return fill === fallback ? tile(fallback, onFallback) : thumb(fill, isDark, deep)
}

export type CoraChrome = {
  soft: string
  mid: string
  accent: string
  deep: string
  ink: string
  white: string
  family: ModuleChromeFamily
  roles: {
    cta: SolidListThumb
    hero: SolidListThumb
    navActive: SolidListThumb
    navIdle: SolidListThumb
    panel: SolidListThumb
    nav: readonly SolidListThumb[]
    capability: readonly SolidListThumb[]
    kpi: readonly SolidListThumb[]
  }
}

export function buildCoraChrome(
  swatch: ChromeSwatch,
  isDark = false,
  family: ModuleChromeFamily = "purple",
): CoraChrome {
  const [soft, mid, accent, deep] = swatch
  const softInk = inkOnFillForMode(soft, isDark, deep)
  const ink = softInk === WHITE ? (isDark ? WHITE : FALLBACK_INK) : softInk
  const onAccent = ctaInkOnFill(accent)

  const familyThumbs = contentThumbsForFamily(family)
  const softFill = familyThumbs[0] ?? soft
  const cool = familyThumbs[1] ?? mid
  const midFill = familyThumbs[Math.min(4, familyThumbs.length - 1)] ?? accent

  const kpi = familyThumbs.slice(0, 8).map((fill) => thumb(fill, isDark, deep))
  while (kpi.length < 4) {
    kpi.push(tile(accent, onAccent))
  }

  const nav = CORA_PLATFORM_NAV.map((_, i) =>
    cycleThumb(familyThumbs, i, isDark, deep, accent, onAccent),
  )
  const capability = CORA_HOME_ACTIONS.map((_, i) =>
    cycleThumb(familyThumbs, i + 1, isDark, deep, accent, onAccent),
  )

  return {
    soft,
    mid,
    accent,
    deep,
    ink,
    white: WHITE,
    family,
    roles: {
      cta: tile(accent, onAccent),
      hero: thumb(softFill, isDark, deep),
      navActive: tile(accent, onAccent),
      navIdle: thumb(cool, isDark, deep),
      panel: thumb(midFill, isDark, deep),
      nav,
      capability,
      kpi,
    },
  }
}

export function resolveCoraChrome(
  themeId: ThemeId,
  tokens?: Pick<
    AppThemeTokens,
    "accent" | "accentHover" | "tint" | "selected" | "secondaryAccent" | "isDark"
  >,
): CoraChrome {
  const isDark = Boolean(tokens?.isDark)
  const family = themeChromeFamily(themeId)
  return buildCoraChrome(
    tokens ? chromeSwatchFromTokens(tokens, themeId) : chromeSwatchForTheme(themeId),
    isDark,
    family,
  )
}

export function coraChromeNavThumb(tab: CoraPlatformTab, roles: CoraChrome["roles"]): SolidListThumb {
  const index = CORA_PLATFORM_NAV.findIndex((item) => item.id === tab)
  const cycle = roles.nav
  if (index < 0 || cycle.length === 0) return roles.navActive
  return cycle[((index % cycle.length) + cycle.length) % cycle.length]!
}

export function coraChromeCapabilityThumb(
  capabilityId: string,
  roles: CoraChrome["roles"],
): SolidListThumb {
  const index = CORA_HOME_ACTIONS.findIndex((action) => action.id === capabilityId)
  const cycle = roles.capability
  if (index < 0 || cycle.length === 0) return roles.cta
  return cycle[((index % cycle.length) + cycle.length) % cycle.length]!
}

export function coraChromeKpi(index: number, roles: CoraChrome["roles"]): SolidListThumb {
  const cycle = roles.kpi
  return cycle[((index % cycle.length) + cycle.length) % cycle.length]!
}
