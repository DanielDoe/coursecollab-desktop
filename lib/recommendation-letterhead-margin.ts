import type { LetterheadContentMargin } from "./recommendation-letterhead-types"

const MM_BY_PRESET: Record<LetterheadContentMargin, number> = {
  narrow: 17,
  moderate: 21,
  normal: 25,
  wide: 31,
}

export function parseLetterheadContentMargin(raw: unknown): LetterheadContentMargin {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : ""
  if (s === "narrow" || s === "moderate" || s === "normal" || s === "wide") return s
  return "normal"
}

/** Left/right inset for PDF (A4), in millimeters. */
export function letterheadContentMarginMm(preset: LetterheadContentMargin): number {
  return MM_BY_PRESET[preset]
}

/** Horizontal padding for on-screen preview — matches PDF mm at 96 CSS px per inch. */
export function letterheadContentMarginPaddingPx(preset: LetterheadContentMargin): number {
  const mm = letterheadContentMarginMm(preset)
  return Math.round((mm * 96) / 25.4)
}

export const LETTERHEAD_CONTENT_MARGIN_OPTIONS: ReadonlyArray<{
  value: LetterheadContentMargin
  label: string
  description: string
}> = [
  { value: "narrow", label: "Narrow", description: "~17 mm — wider text block" },
  { value: "moderate", label: "Moderate", description: "~21 mm" },
  { value: "normal", label: "Normal", description: "~25 mm — default (≈1 in)" },
  { value: "wide", label: "Wide", description: "~31 mm — more whitespace" },
]
