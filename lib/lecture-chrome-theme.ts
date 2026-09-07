/**
 * Lectures chrome — family Color Hunt combinations for toolbar / KPIs / charts.
 * Card list thumbs stay coolGold (see lecture-list-theme) — do not change those here.
 */

import type { AppThemeTokens, ThemeId } from "@/lib/appearance/app-themes"
import { ctaInkOnFill, inkOnFill, inkOnFillForMode } from "@/lib/appearance/chrome-ink"
import {
  chromeSwatchForTheme,
  chromeSwatchFromTokens,
  themeChromeFamily,
  type ChromeSwatch,
  type ModuleChromeFamily,
} from "@/lib/appearance/module-chrome"
import {
  contentThumbsForFamily,
  COLOR_HUNT_COOL,
  type SolidListThumb,
} from "@/lib/student-color-hunt-theme"

const WHITE = "#FFFFFF"
const FALLBACK_INK = "#1C1917"

function tile(fill: string, icon = WHITE): SolidListThumb {
  return { fill, icon }
}

function thumb(fill: string, isDark: boolean, deep: string): SolidListThumb {
  return tile(fill, inkOnFillForMode(fill, isDark, deep))
}

export type LectureChrome = {
  red: string
  orange: string
  amber: string
  cream: string
  ink: string
  white: string
  roles: {
    cta: SolidListThumb
    secondary: SolidListThumb
    icon: SolidListThumb
    filter: SolidListThumb
    aiNotes: SolidListThumb
    progress: SolidListThumb
    inProgress: SolidListThumb
    reminder: SolidListThumb
    bookmark: SolidListThumb
    chat: SolidListThumb
    classmates: SolidListThumb
    engagement: SolidListThumb
    charts: SolidListThumb
    materials: SolidListThumb
    saved: SolidListThumb
    instructor: SolidListThumb
    tips: SolidListThumb
    kpi: readonly SolidListThumb[]
  }
  chart: {
    completed: string
    inProgress: string
    notStarted: string
    views: string
    active: string
  }
}

export function buildLectureChrome(
  swatch: ChromeSwatch,
  isDark = false,
  family: ModuleChromeFamily = "blue",
): LectureChrome {
  const [cream, amber, orange, red] = swatch
  const deep = red
  const softIcon = inkOnFillForMode(cream, isDark, deep)
  const amberInk = inkOnFillForMode(amber, isDark, deep)
  const ink = softIcon === WHITE ? (isDark ? WHITE : FALLBACK_INK) : softIcon
  const onAccent = ctaInkOnFill(orange)

  const familyThumbs = contentThumbsForFamily(family)
  const kpi = familyThumbs.slice(0, 8).map((fill) => thumb(fill, isDark, deep))
  while (kpi.length < 4) {
    kpi.push(tile(orange, onAccent))
  }

  // Flashcard-style role spread: cream / sky / gold / slate (or family equivalents)
  const softFill = familyThumbs[0] ?? cream
  const coolFill = familyThumbs[1] ?? amber
  const deepFill = familyThumbs[familyThumbs.length - 1] ?? red

  // coolGold complements — same family as lecture card play thumbs
  const coolIndigo = COLOR_HUNT_COOL.indigo
  const coolCyan = COLOR_HUNT_COOL.cyan
  const coolSky = COLOR_HUNT_COOL.sky
  const coolGold = COLOR_HUNT_COOL.gold

  return {
    red,
    orange,
    amber,
    cream,
    ink,
    white: WHITE,
    roles: {
      cta: tile(orange, onAccent),
      secondary: thumb(coolFill, isDark, deep),
      icon: thumb(softFill, isDark, deep),
      filter: tile(orange, onAccent),
      aiNotes: tile(orange, onAccent),
      progress: tile(coolIndigo, "#FFFFFF"),
      inProgress: tile(coolGold, inkOnFill(coolGold, FALLBACK_INK)),
      reminder: tile(coolCyan, "#FFFFFF"),
      bookmark: tile(amber, amberInk),
      // Default chat — cards override with per-thumb coolGold via lectureSolidThumb
      chat: tile(coolIndigo, "#FFFFFF"),
      classmates: thumb(deepFill, isDark, deep),
      engagement: tile(coolCyan, "#FFFFFF"),
      charts: tile(coolSky, inkOnFill(coolSky, FALLBACK_INK)),
      materials: thumb(softFill, isDark, deep),
      saved: tile(amber, amberInk),
      instructor: thumb(deepFill, isDark, deep),
      tips: tile(coolSky, inkOnFill(coolSky, FALLBACK_INK)),
      kpi,
    },
    chart: {
      completed: coolIndigo,
      inProgress: coolGold,
      notStarted: coolSky,
      views: coolCyan,
      active: coolCyan,
    },
  }
}

export function resolveLectureChrome(
  themeId: ThemeId,
  tokens?: Pick<AppThemeTokens, "accent" | "accentHover" | "tint" | "selected" | "secondaryAccent" | "isDark">,
): LectureChrome {
  const isDark = Boolean(tokens?.isDark)
  const family = themeChromeFamily(themeId)
  return buildLectureChrome(
    tokens ? chromeSwatchFromTokens(tokens, themeId) : chromeSwatchForTheme(themeId),
    isDark,
    family,
  )
}

const DEFAULT = buildLectureChrome(chromeSwatchForTheme("ocean"), false, "blue")

/** @deprecated Prefer useLectureChrome() */
export const LECTURE_CHROME = {
  red: DEFAULT.red,
  orange: DEFAULT.orange,
  amber: DEFAULT.amber,
  cream: DEFAULT.cream,
  ink: DEFAULT.ink,
  white: DEFAULT.white,
} as const

export const LECTURE_CHROME_ROLES = DEFAULT.roles
export const LECTURE_CHROME_CHART = DEFAULT.chart
export const LECTURE_CHROME_DARK = {
  filterActive: "border-transparent text-white",
  filterIdle: "border-transparent",
  viewActive: "text-white shadow-none",
  viewIdle: "bg-transparent",
  viewTrack: "",
} as const

export function lectureChromeKpi(
  index: number,
  roles: LectureChrome["roles"] = DEFAULT.roles,
): SolidListThumb {
  const cycle = roles.kpi
  return cycle[((index % cycle.length) + cycle.length) % cycle.length]!
}
