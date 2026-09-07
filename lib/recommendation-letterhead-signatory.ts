import type { LetterheadBodyTextAlign, LetterheadHeaderTextAlign } from "./recommendation-letterhead-types"

/**
 * Name shown under the signature on the letterhead PDF/preview.
 * Priority: explicit letterhead field → first line of signature_block → account name.
 */
export function resolveLetterheadSignatoryName(
  row: { letterhead_signatory_name?: unknown; signature_block?: unknown },
  accountInstructorName: string,
): string {
  const explicit = typeof row.letterhead_signatory_name === "string" ? row.letterhead_signatory_name.trim() : ""
  if (explicit) return explicit

  const block = typeof row.signature_block === "string" ? row.signature_block.trim() : ""
  const firstLine = block
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => Boolean(l))
  if (firstLine) return firstLine

  const acct = accountInstructorName.trim()
  if (acct) return acct

  return "Faculty"
}

function normClosingLine(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[,;]/g, "")
    .trim()
}

function isStructuredClosingLine(line: string): boolean {
  const t = line.trim()
  const n = normClosingLine(t)
  if (
    n === normClosingLine("Department of Electrical and Computer Engineering") ||
    n === normClosingLine("Prairie View A&M University")
  ) {
    return true
  }
  return /^(email|phone|office|tel|fax)\s*:/i.test(t)
}

/**
 * Builds the closing lines under the signature (title, dept, contact, optional extras).
 * Merges structured letterhead fields with optional `signature_block` text without repeating
 * the signatory line, title, or boilerplate when both are set.
 */
export function buildLetterheadClosingLines(input: {
  signatoryLine: string
  instructorTitle?: string | null
  instructorEmail?: string | null
  instructorPhone?: string | null
  instructorOffice?: string | null
  signatureBlock?: string | null
}): string[] {
  const dept = "Department of Electrical and Computer Engineering"
  const uni = "Prairie View A&M University"

  const block = typeof input.signatureBlock === "string" ? input.signatureBlock.trim() : ""
  const rawLines = block ? block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : []

  const sigN = normClosingLine(input.signatoryLine)
  let idx = 0
  while (idx < rawLines.length && sigN && normClosingLine(rawLines[idx]) === sigN) {
    idx += 1
  }

  let title = input.instructorTitle?.trim() || ""
  if (!title && idx < rawLines.length && !isStructuredClosingLine(rawLines[idx])) {
    title = rawLines[idx]
    idx += 1
  }

  const closing: string[] = []
  if (title) closing.push(title)
  closing.push(dept, uni)
  if (input.instructorEmail?.trim()) closing.push(`Email: ${input.instructorEmail.trim()}`)
  if (input.instructorPhone?.trim()) closing.push(`Phone: ${input.instructorPhone.trim()}`)
  if (input.instructorOffice?.trim()) closing.push(`Office: ${input.instructorOffice.trim()}`)

  const seen = new Set<string>()
  for (const line of closing) seen.add(normClosingLine(line))
  if (sigN) seen.add(sigN)

  for (; idx < rawLines.length; idx++) {
    const line = rawLines[idx]
    const n = normClosingLine(line)
    if (!n || seen.has(n)) continue
    seen.add(n)
    closing.push(line)
  }

  return closing
}

/** Clamp logo/signature scale for PDF and UI (0.4 = 40%, 2 = 200%). */
export function clampLetterheadImageScale(v: unknown, fallback = 1): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(2, Math.max(0.4, n))
}

/**
 * Logo box side length in px shared by `LetterheadLetterPreview` and PDF: `min(180, round(100 * scale))` after clamp.
 */
export function letterheadLogoBoxPx(scale: unknown): number {
  const s = clampLetterheadImageScale(scale, 1)
  return Math.min(180, Math.round(100 * s))
}

/**
 * Logo box in mm (96 CSS px ≈ 1 inch) — same visual size as preview.
 */
export function letterheadLogoBoxMm(scale: unknown): { wMm: number; hMm: number } {
  const px = letterheadLogoBoxPx(scale)
  const mm = (px * 25.4) / 96
  return { wMm: mm, hMm: mm }
}

/** Main letter column (date through body); matches preview + PDF. */
export function parseLetterheadBodyTextAlign(v: unknown): LetterheadBodyTextAlign {
  const s = typeof v === "string" ? v.trim().toLowerCase() : ""
  if (s === "left" || s === "center" || s === "right" || s === "justify") return s
  return "justify"
}

/** Banner next to logo: “PRAIRIE VIEW A&M UNIVERSITY” + system line (default left like official stock). */
export function parseLetterheadHeaderTextAlign(v: unknown): LetterheadHeaderTextAlign {
  const s = typeof v === "string" ? v.trim().toLowerCase() : ""
  if (s === "left" || s === "center" || s === "right") return s
  return "left"
}

/** Banner title + system line (~85%–135%); default 0.92 to approximate official print size. */
export function clampLetterheadHeaderFontScale(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0.92
  return Math.round(Math.min(1.35, Math.max(0.85, n)) * 100) / 100
}

/** Space between seal and banner text (preview px / PDF mm). */
export function clampLetterheadLogoTextGapPx(v: unknown): number {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return 20
  return Math.min(48, Math.max(8, n))
}

/** Scales main letter body text (preview + PDF), ~85%–135% of baseline. */
export function clampLetterheadBodyFontScale(v: unknown, fallback = 1): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.round(Math.min(1.35, Math.max(0.85, n)) * 100) / 100
}
