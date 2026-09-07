import type { jsPDF } from "jspdf"

/**
 * jsPDF standard fonts cannot render emoji reliably; leftover bytes break wrapping and can render as stray glyphs.
 */
export function sanitizePdfPlainText(input: string): string {
  let s = String(input ?? "").normalize("NFKC")
  s = s.replace(/\u200D/g, "").replace(/[\uFE00-\uFE0F]/g, "")
  try {
    s = s.replace(/\p{Extended_Pictographic}/gu, "")
  } catch {
    s = s.replace(
      /[\u231A-\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA-\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u27BF\u2934-\u2935\u2B05-\u2B07\u2B1B-\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDDFF]/g,
      "",
    )
  }
  s = s
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]+/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim()
  return s
}

/**
 * jsPDF `splitTextToSize` is typed as string[] but treat defensively: if a string is returned,
 * iterating it character-by-character will destroy layout (spaced letters / stray glyphs).
 */
export function pdfSplitLines(doc: jsPDF, text: string, maxWidthMm: number): string[] {
  const sized = doc.splitTextToSize(text, maxWidthMm)
  if (Array.isArray(sized)) return sized.length > 0 ? sized : [""]
  if (sized == null) return [""]
  return [String(sized)]
}
