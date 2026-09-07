/**
 * AI Notetaker list chrome — family Color Hunt combinations + contrast-safe ink.
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
  type SolidListThumb,
} from "@/lib/student-color-hunt-theme"

export type { SolidListThumb }

function tile(fill: string, icon = "#FFFFFF"): SolidListThumb {
  return { fill, icon }
}

function thumb(fill: string, isDark: boolean, deep: string): SolidListThumb {
  return tile(fill, inkOnFillForMode(fill, isDark, deep))
}

export type NotetakerChrome = {
  ice: string
  powder: string
  blue: string
  navy: string
  roles: {
    record: SolidListThumb
    upload: { fill: string; icon: string; border: string }
    browse: { soft: string; ink: string }
    ready: SolidListThumb
    processing: SolidListThumb
    failed: SolidListThumb
    archived: SolidListThumb
    empty: SolidListThumb
    link: string
  }
  thumbs: readonly SolidListThumb[]
}

export function buildNotetakerChrome(
  swatch: ChromeSwatch,
  isDark = false,
  family: ModuleChromeFamily = "blue",
): NotetakerChrome {
  const [ice, powder, blue, navy] = swatch
  const deep = navy
  const softInk = inkOnFillForMode(ice, isDark, deep)
  const powderInk = inkOnFillForMode(powder, isDark, deep)
  const onAccent = ctaInkOnFill(blue)
  const browseInk = isDark ? "#FFFFFF" : softInk === "#FFFFFF" ? deep : softInk

  const familyThumbs = contentThumbsForFamily(family)
  const thumbs = familyThumbs.map((fill) => thumb(fill, isDark, deep))

  const processingFill = familyThumbs[1] ?? powder
  const archivedFill = familyThumbs[0] ?? ice
  const failedFill = familyThumbs[familyThumbs.length - 1] ?? navy

  return {
    ice,
    powder,
    blue,
    navy,
    roles: {
      record: tile(blue, onAccent),
      upload: {
        fill: isDark ? "transparent" : ice,
        icon: isDark ? blue : deep,
        border: isDark ? blue : powder,
      },
      browse: { soft: ice, ink: browseInk },
      ready: tile(blue, onAccent),
      processing: thumb(processingFill, isDark, deep),
      failed: thumb(failedFill, isDark, deep),
      archived: thumb(archivedFill, isDark, deep),
      empty: tile(ice, softInk),
      link: blue,
    },
    thumbs,
  }
}

export function resolveNotetakerChrome(
  themeId: ThemeId,
  tokens?: Pick<AppThemeTokens, "accent" | "accentHover" | "tint" | "selected" | "secondaryAccent" | "isDark">,
): NotetakerChrome {
  const isDark = Boolean(tokens?.isDark)
  const family = themeChromeFamily(themeId)
  return buildNotetakerChrome(
    tokens ? chromeSwatchFromTokens(tokens, themeId) : chromeSwatchForTheme(themeId),
    isDark,
    family,
  )
}

export function notetakerListThumbAt(
  chrome: NotetakerChrome,
  index: number,
): SolidListThumb {
  const cycle = chrome.thumbs
  return cycle[((index % cycle.length) + cycle.length) % cycle.length]!
}

export function notetakerStatusThumb(
  chrome: NotetakerChrome,
  status: string,
): SolidListThumb {
  const s = status.toLowerCase()
  if (s.includes("fail") || s.includes("error")) return chrome.roles.failed
  if (s.includes("ready") || s.includes("complete") || s === "done") return chrome.roles.ready
  if (s.includes("process") || s.includes("transcrib") || s.includes("pending") || s.includes("queue")) {
    return chrome.roles.processing
  }
  return chrome.roles.ready
}
