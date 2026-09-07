/**
 * Practice Hub chrome — family Color Hunt combinations for toolbar / KPIs / topics.
 * Each hue family (purple, gold, red, green, …) gets its own varied thumb set.
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

const WHITE = "#FFFFFF"
const FALLBACK_INK = "#1C1917"
const LOCKED_FILL = "#636366"

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

export type PracticeChrome = {
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
    secondary: SolidListThumb
    icon: SolidListThumb
    search: SolidListThumb
    leaderboard: SolidListThumb
    history: SolidListThumb
    streak: SolidListThumb
    topic: SolidListThumb
    topicSelected: SolidListThumb
    topicLocked: SolidListThumb
    topicDone: SolidListThumb
    summary: SolidListThumb
    recent: SolidListThumb
    kpi: readonly SolidListThumb[]
    browse: { soft: string; ink: string }
  }
}

export function buildPracticeChrome(
  swatch: ChromeSwatch,
  isDark = false,
  family: ModuleChromeFamily = "blue",
): PracticeChrome {
  const [soft, mid, accent, deep] = swatch
  const softInk = inkOnFillForMode(soft, isDark, deep)
  const ink = softInk === WHITE ? (isDark ? WHITE : FALLBACK_INK) : softInk
  const onAccent = ctaInkOnFill(accent)

  const familyThumbs = contentThumbsForFamily(family)
  const vivid = familyThumbs.filter((fill) => !isPaleFill(fill))
  const kpi = vivid.slice(0, 8).map((fill) => thumb(fill, isDark, deep))
  while (kpi.length < 4) {
    kpi.push(tile(accent, onAccent))
  }

  const cool = vivid[0] ?? mid
  const midFill = vivid[1] ?? accent
  const deepFill = vivid[vivid.length - 1] ?? deep
  const doneFill = vivid[Math.min(2, Math.max(0, vivid.length - 1))] ?? mid
  const browseSoft = isDark ? mid : soft
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
      hero: thumb(soft, isDark, deep),
      secondary: thumb(cool, isDark, deep),
      icon: thumb(midFill, isDark, deep),
      search: thumb(cool, isDark, deep),
      leaderboard: thumb(midFill, isDark, deep),
      history: thumb(vivid[2] ?? mid, isDark, deep),
      streak: thumb(vivid[Math.min(3, vivid.length - 1)] ?? accent, isDark, deep),
      topic: thumb(cool, isDark, deep),
      topicSelected: tile(accent, onAccent),
      topicLocked: tile(LOCKED_FILL, "rgba(255,255,255,0.88)"),
      topicDone: thumb(doneFill, isDark, deep),
      summary: tile(accent, onAccent),
      recent: thumb(deepFill, isDark, deep),
      kpi,
      browse: {
        soft: browseSoft,
        ink: browseInk === WHITE && !isDark ? deep : browseInk,
      },
    },
  }
}

export function resolvePracticeChrome(
  themeId: ThemeId,
  tokens?: Pick<
    AppThemeTokens,
    "accent" | "accentHover" | "tint" | "selected" | "secondaryAccent" | "isDark"
  >,
): PracticeChrome {
  const isDark = Boolean(tokens?.isDark)
  const family = themeChromeFamily(themeId)
  return buildPracticeChrome(
    tokens ? chromeSwatchFromTokens(tokens, themeId) : chromeSwatchForTheme(themeId),
    isDark,
    family,
  )
}

export function practiceChromeKpi(
  index: number,
  roles: PracticeChrome["roles"],
): SolidListThumb {
  const cycle = roles.kpi
  return cycle[((index % cycle.length) + cycle.length) % cycle.length]!
}
