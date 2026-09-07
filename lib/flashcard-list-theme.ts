/**
 * Flashcard list chrome — family Color Hunt combinations + contrast-safe ink.
 * coolGold remains a study-face suggestion; list chrome tracks theme family.
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
import {
  COLOR_HUNT_PALETTES,
  contentThumbsForFamily,
  type SolidListThumb,
} from "@/lib/student-color-hunt-theme"

export type { SolidListThumb }

type ListKind = "empty" | "completed" | "in_progress" | "available"

function tile(fill: string, icon = "#FFFFFF"): SolidListThumb {
  return { fill, icon }
}

function thumb(fill: string, isDark: boolean, deep: string): SolidListThumb {
  return tile(fill, inkOnFillForMode(fill, isDark, deep))
}

export type FlashcardListRoles = {
  study: SolidListThumb
  studyDisabled: SolidListThumb
  edit: SolidListThumb
  xp: SolidListThumb
  create: SolidListThumb
  course: SolidListThumb
  mine: SolidListThumb
  topic: SolidListThumb
  empty: SolidListThumb
  completed: SolidListThumb
  locked: SolidListThumb
  mastery: string
  mastered: string
  inProgress: string
  link: string
  browse: { soft: string; ink: string }
  emptyState: { border: string; fill: string; ink: string }
}

/** Study-session action colors — mapped from the active theme family (not coolGold). */
export type FlashcardStudySwatch = {
  ice: string
  powder: string
  blue: string
  navy: string
  indigo: string
  cyan: string
  orange: string
  magenta: string
  mango: string
  yellow: string
  gold: string
  red: string
  teal: string
  tealBright: string
  tealDeep: string
  cream: string
}

export type FlashcardChrome = {
  ice: string
  powder: string
  blue: string
  navy: string
  thumbs: readonly SolidListThumb[]
  roles: FlashcardListRoles
  study: FlashcardStudySwatch
}

function thumbFill(thumbs: readonly SolidListThumb[], index: number, fallback: string): string {
  if (thumbs.length === 0) return fallback
  const slot = ((index % thumbs.length) + thumbs.length) % thumbs.length
  return thumbs[slot]!.fill
}

function buildStudySwatch(
  ice: string,
  powder: string,
  blue: string,
  navy: string,
  thumbs: readonly SolidListThumb[],
): FlashcardStudySwatch {
  return {
    ice,
    powder,
    blue,
    navy,
    indigo: navy,
    cyan: powder,
    orange: thumbFill(thumbs, 3, blue),
    magenta: thumbFill(thumbs, 2, powder),
    mango: blue,
    yellow: thumbFill(thumbs, 1, powder),
    gold: thumbFill(thumbs, 0, ice),
    red: thumbFill(thumbs, Math.min(4, Math.max(0, thumbs.length - 1)), navy),
    teal: blue,
    tealBright: powder,
    tealDeep: navy,
    cream: ice,
  }
}

export function buildFlashcardChrome(
  swatch: ChromeSwatch,
  isDark = false,
  family: ModuleChromeFamily = "blue",
): FlashcardChrome {
  const [ice, powder, blue, navy] = swatch
  const deep = navy
  const softInk = inkOnFillForMode(ice, isDark, deep)
  const powderInk = inkOnFillForMode(powder, isDark, deep)
  const browseInk = isDark ? "#FFFFFF" : deep
  const browseSoft = isDark ? powder : ice

  const familyThumbs = contentThumbsForFamily(family)
  const thumbs: SolidListThumb[] = familyThumbs.map((fill) => thumb(fill, isDark, deep))

  const editFill = familyThumbs[1] ?? powder
  const courseFill = familyThumbs[familyThumbs.length - 1] ?? navy
  const xpFill = familyThumbs[Math.min(7, familyThumbs.length - 1)] ?? navy
  const topicFill = familyThumbs[0] ?? ice

  return {
    ice,
    powder,
    blue,
    navy,
    thumbs,
    study: buildStudySwatch(ice, powder, blue, navy, thumbs),
    roles: {
      study: tile(blue, ctaInkOnFill(blue)),
      studyDisabled: tile(ice, softInk),
      edit: thumb(editFill, isDark, deep),
      xp: thumb(xpFill, isDark, deep),
      create: tile(blue, ctaInkOnFill(blue)),
      course: thumb(courseFill, isDark, deep),
      mine: tile(blue, ctaInkOnFill(blue)),
      topic: thumb(topicFill, isDark, deep),
      empty: tile(ice, softInk),
      completed: tile(powder, powderInk),
      locked: tile(navy, "rgba(255,255,255,0.85)"),
      mastery: blue,
      mastered: powder,
      inProgress: powder,
      link: blue,
      browse: { soft: browseSoft, ink: browseInk },
      emptyState: {
        border: "transparent",
        fill: isDark ? powder : ice,
        ink: browseInk,
      },
    },
  }
}

export function resolveFlashcardChrome(
  themeId: ThemeId,
  tokens?: Pick<AppThemeTokens, "accent" | "accentHover" | "tint" | "selected" | "secondaryAccent" | "isDark">,
): FlashcardChrome {
  const isDark = Boolean(tokens?.isDark)
  const family = themeChromeFamily(themeId)
  const swatch = tokens
    ? chromeSwatchFromTokens(tokens, themeId)
    : chromeSwatchForTheme(themeId)
  return buildFlashcardChrome(swatch, isDark, family)
}

const FALLBACK = buildFlashcardChrome(COLOR_HUNT_PALETTES.coolGold, false, "gold")

/** @deprecated Prefer useFlashcardChrome().roles */
export const FLASHCARD_LIST_ROLES = FALLBACK.roles

/** @deprecated Prefer useFlashcardChrome().thumbs */
export const FLASHCARD_LIST_THUMBS = FALLBACK.thumbs

/** Lifted panel — no hairline stroke. Dark sits above #0f0f0f sheet. */
export const FLASHCARD_CARD_SURFACE =
  "rounded-2xl bg-[var(--cc-surface,#F4F6F8)] shadow-sm dark:bg-white/[0.09] dark:shadow-none"

export function flashcardListThumbAt(
  index: number,
  thumbs: readonly SolidListThumb[] = FALLBACK.thumbs,
): SolidListThumb {
  const len = thumbs.length
  const slot = ((index % len) + len) % len
  return thumbs[slot]!
}

export function flashcardListIdentityThumb(
  index: number,
  kind: ListKind,
  options?: { locked?: boolean },
  chrome: Pick<FlashcardChrome, "thumbs" | "roles"> = FALLBACK,
): SolidListThumb {
  if (options?.locked) return chrome.roles.locked
  if (kind === "empty") return chrome.roles.empty
  if (kind === "completed") return chrome.roles.completed
  return flashcardListThumbAt(index, chrome.thumbs)
}

export function flashcardListStatusColor(
  kind: ListKind,
  thumbFill: string,
  locked?: boolean,
  roles: FlashcardListRoles = FALLBACK.roles,
): string {
  if (locked) return roles.locked.fill
  if (kind === "completed") return roles.completed.fill
  if (kind === "empty") return roles.empty.fill
  if (kind === "in_progress") return roles.inProgress
  return thumbFill
}

export function flashcardListMasteryColor(
  pct: number,
  thumbFill: string,
  roles: FlashcardListRoles = FALLBACK.roles,
): string {
  if (pct >= 100) return roles.mastered
  return thumbFill
}
