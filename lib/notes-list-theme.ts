/**
 * Notes chrome — family Color Hunt combinations + contrast-safe ink (dark-mode aware).
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
  COLOR_HUNT_PALETTES,
  contentThumbsForFamily,
  type SolidListThumb,
} from "@/lib/student-color-hunt-theme"
import type { CSSProperties } from "react"

function tile(fill: string, icon = "#FFFFFF"): SolidListThumb {
  return { fill, icon }
}

function thumb(fill: string, isDark: boolean, deep: string): SolidListThumb {
  return tile(fill, inkOnFillForMode(fill, isDark, deep))
}

/** Solid = filled CTA; ghost = soft fill + accent ink; outline = border only. */
export type NotesActionTone = "solid" | "ghost" | "outline"

export type NotesActionThumb = SolidListThumb & {
  tone: NotesActionTone
  border?: string
}

function solidAction(fill: string, icon = "#FFFFFF"): NotesActionThumb {
  return { fill, icon, tone: "solid" }
}

function ghostAction(soft: string, ink: string, border: string): NotesActionThumb {
  return { fill: soft, icon: ink, border, tone: "ghost" }
}

function outlineAction(ink: string, border: string): NotesActionThumb {
  return { fill: "transparent", icon: ink, border, tone: "outline" }
}

export function notesActionButtonStyle(action: NotesActionThumb): CSSProperties {
  if (action.tone === "solid") {
    return { backgroundColor: action.fill, color: action.icon }
  }
  return {
    backgroundColor: action.fill,
    color: action.icon,
    borderColor: action.border ?? action.icon,
  }
}

export function notesActionButtonClass(action: NotesActionThumb, extra?: string): string {
  const base =
    action.tone === "solid"
      ? "gap-1.5 border-0 shadow-sm hover:opacity-90"
      : action.tone === "ghost"
        ? "gap-1.5 border shadow-none hover:opacity-90"
        : "gap-1.5 border bg-transparent shadow-none hover:opacity-90"
  return extra ? `${base} ${extra}` : base
}

function isPaleFill(hex: string): boolean {
  const raw = hex.replace("#", "")
  if (raw.length < 6) return false
  const r = Number.parseInt(raw.slice(0, 2), 16)
  const g = Number.parseInt(raw.slice(2, 4), 16)
  const b = Number.parseInt(raw.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 208
}

export const NOTE_ICON_COLOR_CHOICES = [
  "#4E31AA",
  "#2196F3",
  "#00ADB5",
  "#2FA084",
  "#F9B637",
  "#FB6C00",
  "#E22F80",
  "#364F6B",
] as const

/** Alternate family thumbs by row; skip ice tiles; honor a saved icon color. */
export function notesListThumbFor(
  chrome: Pick<NotesChrome, "roles" | "thumbs">,
  opts: {
    index?: number
    kind?: "mine" | "shared" | "course"
    hasTyped?: boolean
    hasInk?: boolean
    iconColor?: string | null
  },
): SolidListThumb {
  if (opts.iconColor && /^#[0-9A-Fa-f]{6}$/.test(opts.iconColor)) {
    return { fill: opts.iconColor, icon: ctaInkOnFill(opts.iconColor) }
  }
  const cycle = (chrome.thumbs.length > 0 ? chrome.thumbs : [chrome.roles.mine]).filter(
    (thumb) => !isPaleFill(thumb.fill),
  )
  const usable = cycle.length > 0 ? cycle : [chrome.roles.mine]
  const offset = opts.kind === "shared" ? 1 : opts.kind === "course" ? 2 : 0
  const slot = ((opts.index ?? 0) + offset) % usable.length
  return usable[(slot + usable.length) % usable.length]!
}

export type NotesChrome = {
  ice: string
  powder: string
  blue: string
  navy: string
  white: string
  thumbs: readonly SolidListThumb[]
  roles: {
    create: NotesActionThumb
    browse: { soft: string; ink: string }
    selected: { fill: string; ink: string }
    mine: SolidListThumb
    shared: SolidListThumb
    course: SolidListThumb
    empty: SolidListThumb
    link: string
    share: NotesActionThumb
    text: NotesActionThumb
    ink: NotesActionThumb
    json: NotesActionThumb
    delete: NotesActionThumb
    tabTrack: string
    tabActive: SolidListThumb
  }
  surfaces: {
    selected: { backgroundColor: string; color: string }
    selectedDark: { backgroundColor: string; color: string }
    selectedMeta: { color: string }
    selectedMetaDark: { color: string }
    tabTrack: { backgroundColor: string }
    tabTrackDark: { backgroundColor: string }
    tabActive: { backgroundColor: string; color: string }
    tabActiveDark: { backgroundColor: string; color: string }
    json: { backgroundColor: string; color: string }
    jsonDark: { backgroundColor: string; color: string }
  }
}

export function buildNotesChrome(
  swatch: ChromeSwatch,
  isDark = false,
  family: ModuleChromeFamily = "blue",
): NotesChrome {
  const [ice, powder, blue, navy] = swatch
  const deep = navy
  const softInk = inkOnFillForMode(ice, isDark, deep)
  const powderInk = inkOnFillForMode(powder, isDark, deep)
  const onAccent = ctaInkOnFill(blue)
  const browseInk = isDark ? "#FFFFFF" : softInk === "#FFFFFF" ? deep : softInk
  const browseSoft = isDark ? powder : ice

  const familyThumbs = contentThumbsForFamily(family)
  const thumbs = familyThumbs.map((fill) => thumb(fill, isDark, deep))

  const ghostFill = isDark ? "transparent" : ice
  const ghostInk = isDark ? blue : deep
  const ghostBorder = isDark ? blue : powder
  const deleteInk = isDark ? "rgba(255,255,255,0.88)" : deep
  const deleteBorder = isDark ? blue : powder

  const sharedFill = familyThumbs[1] ?? powder
  const courseFill = familyThumbs[familyThumbs.length - 1] ?? navy

  return {
    ice,
    powder,
    blue,
    navy,
    white: "#FFFFFF",
    thumbs,
    roles: {
      create: solidAction(blue, onAccent),
      browse: { soft: browseSoft, ink: browseInk },
      selected: { fill: browseSoft, ink: browseInk },
      mine: tile(blue, onAccent),
      shared: thumb(sharedFill, isDark, deep),
      course: thumb(courseFill, isDark, deep),
      empty: tile(ice, softInk),
      link: blue,
      share: solidAction(blue, onAccent),
      text: ghostAction(ghostFill, ghostInk, ghostBorder),
      ink: ghostAction(ghostFill, ghostInk, ghostBorder),
      json: ghostAction(ghostFill, ghostInk, ghostBorder),
      delete: outlineAction(deleteInk, deleteBorder),
      tabTrack: ice,
      tabActive: tile(blue, onAccent),
    },
    surfaces: {
      selected: { backgroundColor: ice, color: browseInk },
      selectedDark: { backgroundColor: powder, color: "#FFFFFF" },
      selectedMeta: { color: inkOnFill(ice, deep) === "#FFFFFF" ? "rgba(255,255,255,0.75)" : `${deep}B3` },
      selectedMetaDark: { color: "rgba(255,255,255,0.7)" },
      tabTrack: { backgroundColor: ice },
      tabTrackDark: { backgroundColor: powder },
      tabActive: { backgroundColor: blue, color: onAccent },
      tabActiveDark: { backgroundColor: blue, color: "#FFFFFF" },
      json: { backgroundColor: ice, color: softInk },
      jsonDark: { backgroundColor: "transparent", color: blue },
    },
  }
}

const FALLBACK = COLOR_HUNT_PALETTES.materialBlue
const DEFAULT_CHROME = buildNotesChrome(FALLBACK, false, "blue")

export const NOTES_LIST = {
  ice: FALLBACK[0],
  powder: FALLBACK[1],
  blue: FALLBACK[2],
  navy: FALLBACK[3],
  white: "#FFFFFF",
} as const

export const NOTES_LIST_ROLES = DEFAULT_CHROME.roles

/** @deprecated Use chrome.surfaces with isDark. */
export const NOTES_LIST_DARK = {
  selected: "bg-[#E3F2FD] text-[#0D47A1] dark:bg-[#2196F3]/25 dark:text-white",
  selectedMeta: "text-[#0D47A1]/70 dark:text-white/70",
  tabTrack: "bg-[#E3F2FD] dark:bg-[#2196F3]/20",
  tabActive:
    "data-[state=active]:bg-[#2196F3] data-[state=active]:text-white dark:data-[state=active]:bg-[#90CAF9] dark:data-[state=active]:text-[#0D47A1]",
  json: "bg-[#E3F2FD] text-[#0D47A1] dark:bg-[#90CAF9] dark:text-[#0D47A1]",
} as const

export function resolveNotesChrome(
  themeId: ThemeId,
  tokens?: Pick<AppThemeTokens, "accent" | "accentHover" | "tint" | "selected" | "secondaryAccent" | "isDark">,
): NotesChrome {
  const isDark = Boolean(tokens?.isDark)
  const family = themeChromeFamily(themeId)
  return buildNotesChrome(
    tokens ? chromeSwatchFromTokens(tokens, themeId) : chromeSwatchForTheme(themeId),
    isDark,
    family,
  )
}
