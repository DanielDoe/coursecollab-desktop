import type { CampCertificateBlockId, CampCertificateTemplate } from "@/lib/summer-camp/certificate-template-types"

export function formatCertificateNumber(prefix: string, certId: number): string {
  const clean = prefix.trim() || "PVAMU-CAMP"
  return `${clean}-${String(certId).padStart(4, "0")}`
}

export function formatCertificateDate(iso: string, format: CampCertificateTemplate["dateFormat"]): string {
  const d = new Date(iso)
  if (format === "full") {
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
  }
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long" }).toUpperCase()
}

/** Footer date line — em-dash wrapped, always includes day (matches reference certificate). */
export function formatCertificateFooterDate(iso: string): string {
  const d = new Date(iso)
  const inner = d
    .toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    .toUpperCase()
  return `\u2014 ${inner} \u2014`
}

export function enabledSignatories(template: CampCertificateTemplate) {
  return template.signatories.filter((s) => s.enabled).slice(0, 2)
}

export function isBlockEnabled(template: CampCertificateTemplate, block: CampCertificateBlockId): boolean {
  return template.blocks[block] !== false
}

/** Normalize legacy single-line college/department fields into two-line header text. */
export function collegeHeaderLines(template: CampCertificateTemplate): [string, string] {
  if (template.collegeLineSecondary?.trim()) {
    return [template.collegeLine.trim(), template.collegeLineSecondary.trim()]
  }
  const line = template.collegeLine.trim()
  if (line.toUpperCase().includes("COLLEGE OF ENGINEERING")) {
    return ["ROY G. PERRY", "COLLEGE OF ENGINEERING"]
  }
  return [line, ""]
}

/** Default PVAMU clock-tower watermark (right-side, faint). */
export const CERTIFICATE_WATERMARK_URL = "/summer-camp/certificate-watermark.png"
/** Preview/CSS opacity — pale lines on cream. */
export const CERTIFICATE_WATERMARK_OPACITY = 0.26
/** PDF watermark — jsPDF renders images bolder; keep softer than preview. */
export const CERTIFICATE_WATERMARK_PDF_OPACITY = 0.1

/** Official PVAMU circular seal — PNG with transparent background. */
export const CERTIFICATE_SEAL_URL = "/summer-camp/certificate-seal.png"

/** Breathing room between inner gold border and header/footer content (mm in PDF). */
export const CERTIFICATE_EDGE_PAD_MM = 10
export const CERTIFICATE_SIDE_PAD_MM = 6
/** Half-width of each signature horizontal line (mm in PDF). */
export const CERTIFICATE_SIG_LINE_HALF_WIDTH_MM = 24
/** Seal diameter in PDF (mm) — matches preview `h-14` proportion. */
export const CERTIFICATE_SEAL_SIZE_MM = 22
/** Horizontal offset of each signatory from center (mm). */
export const CERTIFICATE_SIG_SPREAD_MM = 42
/** Footer band height (mm) — matches preview `min-h-[48px]`. */
export const CERTIFICATE_FOOTER_H_MM = 16
/** Clear gap between signature text and footer band (mm). */
export const CERTIFICATE_SIG_FOOTER_GAP_MM = 5
/** Reserved signature zone height above footer gap (mm). */
export const CERTIFICATE_SIG_ZONE_H_MM = 40
/** Space below signature line for name + details (mm). */
export const CERTIFICATE_SIG_TEXT_H_MM = 14

/** PDF point sizes — tuned for print legibility (preview px ≠ PDF pt at 100%). */
export const CERTIFICATE_PDF_SIG_NAME_PT = 9
export const CERTIFICATE_PDF_SIG_DETAIL_PT = 7
export const CERTIFICATE_PDF_FOOTER_VALUE_PT = 9
export const CERTIFICATE_PDF_FOOTER_LABEL_PT = 7.5
/** Seal vertical anchor: fraction of seal height below the signature line (preview `bottom-4`). */
export const CERTIFICATE_SEAL_LINE_OFFSET_MM = 5

/** US Letter landscape height (mm) — matches certificate-pdf.ts PAGE_H. */
export const CERTIFICATE_PAGE_H_MM = 215.9

/** Default faculty signature size multiplier. */
export const DEFAULT_SIGNATURE_SCALE = 1
export const SIGNATURE_SCALE_MIN = 0.5
export const SIGNATURE_SCALE_MAX = 2
/** Vertical signature artwork offset (mm). Signatory lines/names stay fixed. */
export const DEFAULT_SIGNATURE_OFFSET_Y_MM = 0
export const SIGNATURE_OFFSET_Y_MIN_MM = -20
export const SIGNATURE_OFFSET_Y_MAX_MM = 20
/** Base signature image height in preview (px) at 100% scale — matches `h-7`. */
export const CERTIFICATE_PREVIEW_SIG_HEIGHT_PX = 28
/** Base signature image height in PDF (mm) at 100% scale. */
export const CERTIFICATE_PDF_SIG_IMAGE_H_MM = 8

export function clampSignatureScale(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_SIGNATURE_SCALE
  return Math.min(SIGNATURE_SCALE_MAX, Math.max(SIGNATURE_SCALE_MIN, Math.round(n * 100) / 100))
}

export function resolveSignatureScale(template: CampCertificateTemplate): number {
  return clampSignatureScale(template.typography?.signatureScale ?? DEFAULT_SIGNATURE_SCALE)
}

export function clampSignatureOffsetY(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_SIGNATURE_OFFSET_Y_MM
  return Math.min(
    SIGNATURE_OFFSET_Y_MAX_MM,
    Math.max(SIGNATURE_OFFSET_Y_MIN_MM, Math.round(n * 10) / 10),
  )
}

export function resolveSignatureOffsetY(template: CampCertificateTemplate): number {
  return clampSignatureOffsetY(template.typography?.signatureOffsetY ?? DEFAULT_SIGNATURE_OFFSET_Y_MM)
}

/** Convert mm offset to % of certificate height for preview translateY. */
export function signatureOffsetYToPreviewPercent(offsetMm: number): number {
  return (offsetMm / CERTIFICATE_PAGE_H_MM) * 100
}

export function departmentHeaderLines(template: CampCertificateTemplate): [string, string] {
  if (template.departmentLineSecondary?.trim()) {
    return [template.departmentLine.trim(), template.departmentLineSecondary.trim()]
  }
  const line = template.departmentLine.trim()
  if (line.includes("& Computer Engineering")) {
    return ["Department of Electrical &", "Computer Engineering"]
  }
  return [line, ""]
}
