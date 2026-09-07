/**
 * CodeBench hub chrome — appearance Color Hunt thumbs for editor CTA / KPIs / tools.
 */

import type { AppThemeTokens, ThemeId } from "@/lib/appearance/app-themes"
import { ctaInkOnFill, inkOnFillForMode } from "@/lib/appearance/chrome-ink"
import {
  chromeSwatchForTheme,
  chromeSwatchFromTokens,
  mixHex,
  themeChromeFamily,
  THEME_CHROME_SWATCH,
  type ChromeSwatch,
  type ModuleChromeFamily,
} from "@/lib/appearance/module-chrome"
import { contentThumbsForFamily, type SolidListThumb } from "@/lib/student-color-hunt-theme"

const WHITE = "#FFFFFF"
const FALLBACK_INK = "#1C1917"
const DARK_BASE = "#0B0F14"

function tile(fill: string, icon = WHITE): SolidListThumb {
  return { fill, icon }
}

function thumb(fill: string, isDark: boolean, deep: string): SolidListThumb {
  return tile(fill, inkOnFillForMode(fill, isDark, deep))
}

function isPaleFill(hex: string): boolean {
  const raw = hex.replace("#", "")
  if (raw.length < 6) return false
  const r = Number.parseInt(raw.slice(0, 2), 16)
  const g = Number.parseInt(raw.slice(2, 4), 16)
  const b = Number.parseInt(raw.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 208
}

export type CodebenchChrome = {
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
    icon: SolidListThumb
    tool: SolidListThumb
    challenge: SolidListThumb
    badge: SolidListThumb
    leaderboard: SolidListThumb
    kpi: readonly SolidListThumb[]
    browse: { soft: string; ink: string }
  }
}

export function buildCodebenchChrome(
  swatch: ChromeSwatch,
  isDark = false,
  family: ModuleChromeFamily = "purple",
  themeId?: ThemeId,
): CodebenchChrome {
  const [soft, mid, accent, deep] = swatch
  const softInk = inkOnFillForMode(soft, isDark, deep)
  const ink = softInk === WHITE ? (isDark ? WHITE : FALLBACK_INK) : softInk
  const onAccent = ctaInkOnFill(accent)

  const locked = themeId ? THEME_CHROME_SWATCH[themeId] : undefined
  const familyThumbs = contentThumbsForFamily(family)
  const vivid = familyThumbs.filter((fill) => !isPaleFill(fill))
  const swatchThumbs = [
    soft,
    mid,
    accent,
    deep,
    mixHex(soft, mid, 0.5),
    mixHex(mid, accent, 0.5),
    mixHex(accent, deep, 0.45),
    mixHex(soft, deep, 0.35),
  ]
  const kpiPool = isDark
    ? [
        mixHex(accent, deep, 0.42),
        mixHex(mid, deep, 0.55),
        mixHex(accent, DARK_BASE, 0.22),
        mixHex(deep, DARK_BASE, 0.12),
        ...vivid,
      ]
    : locked
      ? swatchThumbs
      : vivid.length >= 4
        ? vivid
        : familyThumbs
  const kpi = kpiPool.slice(0, 8).map((fill) => thumb(fill, isDark, deep))
  while (kpi.length < 4) {
    kpi.push(tile(accent, onAccent))
  }

  const cool = (locked ? mid : vivid[0] ?? familyThumbs[1]) ?? mid
  const softFill = (locked ? soft : familyThumbs[0]) ?? soft
  const midFill = (locked ? accent : vivid[1] ?? familyThumbs[Math.min(4, familyThumbs.length - 1)]) ?? accent
  const deepFill = (locked ? deep : vivid[vivid.length - 1] ?? familyThumbs[familyThumbs.length - 1]) ?? deep
  const badgeFill = locked ? accent : vivid[Math.min(2, vivid.length - 1)] ?? mid
  const browseSoft = isDark ? mixHex(deep, accent, 0.28) : softFill
  const browseInk = isDark ? WHITE : inkOnFillForMode(browseSoft, false, deep)

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
      icon: thumb(softFill, isDark, deep),
      tool: thumb(cool, isDark, deep),
      challenge: thumb(midFill, isDark, deep),
      badge: thumb(badgeFill, isDark, deep),
      leaderboard: thumb(deepFill, isDark, deep),
      kpi,
      browse: { soft: browseSoft, ink: browseInk === WHITE && !isDark ? deep : browseInk },
    },
  }
}

export function resolveCodebenchChrome(
  themeId: ThemeId,
  tokens?: Pick<
    AppThemeTokens,
    "accent" | "accentHover" | "tint" | "selected" | "secondaryAccent" | "isDark"
  >,
): CodebenchChrome {
  const isDark = Boolean(tokens?.isDark)
  const family = themeChromeFamily(themeId)
  return buildCodebenchChrome(
    tokens ? chromeSwatchFromTokens(tokens, themeId) : chromeSwatchForTheme(themeId),
    isDark,
    family,
    themeId,
  )
}

export function codebenchChromeKpi(
  index: number,
  roles: CodebenchChrome["roles"],
): SolidListThumb {
  const cycle = roles.kpi
  return cycle[((index % cycle.length) + cycle.length) % cycle.length]!
}
