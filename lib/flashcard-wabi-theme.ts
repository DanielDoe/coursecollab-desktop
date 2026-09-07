import { ctaInkOnFill, fillLuma, inkOnFill } from "@/lib/appearance/chrome-ink"
import type { ChromeSwatch } from "@/lib/appearance/module-chrome"
import type { FlashcardChrome } from "@/lib/flashcard-list-theme"
import { normalizeFlashcardDifficulty, type FlashcardDifficulty } from "@/lib/flashcards-types"

/** Wabi-sabi flashcard face — solid Color Hunt surface, warm ink typography. */
export type FlashcardWabiFace = {
  background: string
  border: string
  orb: string
  title: string
  body: string
  footer: string
  divider: string
  shadow: string
}

export type FlashcardWabiStackLayer = {
  background: string
  border: string
  rotate: string
  offsetX: number
  offsetY: number
  scale: number
}

export type FlashcardWabiTheme = {
  front: FlashcardWabiFace
  back: FlashcardWabiFace
  stack: FlashcardWabiStackLayer[]
}

type DifficultyPalette = {
  front: string
  back: string
  orb: string
  title: string
  body: string
  footer: string
  shadow: string
  divider: string
}

const STACK_GEOMETRY: Pick<
  FlashcardWabiStackLayer,
  "rotate" | "offsetX" | "offsetY" | "scale"
>[] = [
  { rotate: "-5deg", offsetX: -8, offsetY: 6, scale: 0.985 },
  { rotate: "5deg", offsetX: 8, offsetY: 8, scale: 0.97 },
]

const FALLBACK_SWATCH: ChromeSwatch = ["#E3F2FD", "#90CAF9", "#2196F3", "#0D47A1"]

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.trim().replace("#", "")
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function faceInk(fill: string, deep: string): { title: string; body: string; footer: string } {
  const title = ctaInkOnFill(fill)
  const body = title === "#FFFFFF" ? "#FFF7ED" : inkOnFill(fill, deep)
  const footer = title === "#FFFFFF" ? "rgba(255,255,255,0.88)" : deep
  return { title, body, footer }
}

function difficultyPaletteFromChrome(
  difficulty: FlashcardDifficulty,
  swatch: ChromeSwatch,
  thumbs: readonly string[],
  isDark: boolean,
): DifficultyPalette {
  const [soft, midLight, mid, deep] = swatch
  const t = (i: number, fallback: string) =>
    thumbs.length > 0 ? thumbs[((i % thumbs.length) + thumbs.length) % thumbs.length]! : fallback

  const byDiff: Record<FlashcardDifficulty, { front: string; back: string; orb: string }> = {
    easy: {
      front: isDark ? midLight : soft,
      back: isDark ? soft : midLight,
      orb: midLight,
    },
    medium: {
      front: mid,
      back: isDark ? midLight : t(1, midLight),
      orb: midLight,
    },
    hard: {
      front: deep,
      back: mid,
      orb: mid,
    },
    very_hard: {
      front: t(thumbs.length - 1, deep),
      back: deep,
      orb: mid,
    },
  }

  const colors = byDiff[difficulty]
  const ink = faceInk(colors.front, deep)
  const shadowAlpha = isDark ? 0.55 : fillLuma(colors.front) > 0.55 ? 0.35 : 0.5

  return {
    front: colors.front,
    back: colors.back,
    orb: colors.orb,
    title: ink.title,
    body: ink.body,
    footer: ink.footer,
    shadow: hexToRgba(colors.front, shadowAlpha),
    divider:
      ink.title === "#FFFFFF" ? "rgba(255,255,255,0.32)" : hexToRgba(deep, isDark ? 0.28 : 0.16),
  }
}

function buildFace(palette: DifficultyPalette): FlashcardWabiFace {
  return {
    background: palette.front,
    border: palette.front,
    orb: palette.orb,
    title: palette.title,
    body: palette.body,
    footer: palette.footer,
    divider: palette.divider,
    shadow: palette.shadow,
  }
}

function buildBackFace(palette: DifficultyPalette): FlashcardWabiFace {
  return {
    background: palette.back,
    border: palette.back,
    orb: palette.orb,
    title: palette.title,
    body: palette.body,
    footer: palette.footer,
    divider: palette.divider,
    shadow: palette.shadow,
  }
}

export function buildThemedStackLayers(
  swatch: ChromeSwatch,
  thumbs: readonly string[] = [],
): FlashcardWabiStackLayer[] {
  const [, midLight, mid] = swatch
  const layerA = thumbs[1] ?? midLight
  const layerB = thumbs[3] ?? mid
  const colors = [
    { background: layerA, border: layerA },
    { background: layerB, border: layerB },
  ]
  return STACK_GEOMETRY.map((geometry, index) => {
    const layer = colors[index] ?? colors[0]!
    return { ...geometry, ...layer }
  })
}

export function flashcardWabiTheme(
  difficulty: FlashcardDifficulty,
  isDark: boolean,
  chrome?: Pick<FlashcardChrome, "ice" | "powder" | "blue" | "navy" | "thumbs">,
): FlashcardWabiTheme {
  const swatch: ChromeSwatch = chrome
    ? [chrome.ice, chrome.powder, chrome.blue, chrome.navy]
    : FALLBACK_SWATCH
  const thumbFills = chrome?.thumbs.map((t) => t.fill) ?? []
  const palette = difficultyPaletteFromChrome(difficulty, swatch, thumbFills, isDark)
  return {
    front: buildFace(palette),
    back: buildBackFace(palette),
    stack: buildThemedStackLayers(swatch, thumbFills),
  }
}

export function flashcardWabiThemeFromRaw(
  difficulty: FlashcardDifficulty | string | null | undefined,
  isDark: boolean,
  chrome?: Pick<FlashcardChrome, "ice" | "powder" | "blue" | "navy" | "thumbs">,
): FlashcardWabiTheme {
  return flashcardWabiTheme(normalizeFlashcardDifficulty(difficulty), isDark, chrome)
}

export const FLASHCARD_WABI_RADIUS = 32
export const FLASHCARD_WABI_MAX_WIDTH = 420
export const FLASHCARD_WABI_CARD_HEIGHT = 400
export const FLASHCARD_WABI_SCREEN_GUTTER = 36
export const FLASHCARD_WABI_STACK_BLEED = 18
export const FLASHCARD_WABI_STAGE_HEIGHT = 430
export const FLASHCARD_WABI_STACK = {
  cardMinHeight: FLASHCARD_WABI_CARD_HEIGHT,
  backLeftRotate: "-12deg",
  backRightRotate: "11deg",
  backLeftOffset: { x: -18, y: 16 },
  backRightOffset: { x: 18, y: 20 },
} as const
