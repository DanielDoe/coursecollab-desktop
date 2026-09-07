/**
 * Contrast-safe ink on solid fills — light fills get dark ink; dark fills get white.
 * Used by flashcards / notes / lectures / notetaker chrome.
 */

export function parseHexRgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace("#", "")
  if (h.length === 3) {
    return [parseInt(h[0]! + h[0]!, 16), parseInt(h[1]! + h[1]!, 16), parseInt(h[2]! + h[2]!, 16)]
  }
  if (h.length !== 6) return null
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export function fillLuma(hex: string): number {
  const rgb = parseHexRgb(hex)
  if (!rgb) return 0.5
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255
}

/** Dark ink on light fills; white on dark / mid-dark fills. */
export function inkOnFill(fill: string, deepFallback = "#1C1917"): string {
  if (fillLuma(fill) >= 0.55) {
    // Never use another light gold/amber as “dark” ink.
    return fillLuma(deepFallback) >= 0.45 ? "#1C1917" : deepFallback
  }
  return "#FFFFFF"
}

/** Prefer white on dark UI washes; otherwise contrast against the fill. */
export function inkOnFillForMode(
  fill: string,
  isDark: boolean,
  deepFallback = "#1C1917",
): string {
  if (isDark && fillLuma(fill) < 0.42) return "#FFFFFF"
  return inkOnFill(fill, deepFallback)
}

/** Solid CTA: white on mid/dark fills, near-black on pale fills. */
export function ctaInkOnFill(fill: string): string {
  return fillLuma(fill) >= 0.58 ? "#1C1917" : "#FFFFFF"
}
