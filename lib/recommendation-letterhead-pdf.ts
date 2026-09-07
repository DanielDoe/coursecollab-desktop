/**
 * PVAMU / CourseCollab recommendation letterhead PDF (jsPDF).
 * Layout follows official ECE letterhead: seal left, title right (serif), split footer.
 */

import { jsPDF } from "jspdf"
import { pdfSplitLines } from "@/lib/pdf-text-sanitize"
import type { LetterheadBodyTextAlign, RecommendationLetterheadContent } from "./recommendation-letterhead-types"
import {
  PVAMU_LETTERHEAD_ATTRIBUTION,
  PVAMU_LETTERHEAD_FOOTER_CONTACT_LINES,
  PVAMU_LETTERHEAD_FOOTER_WEB,
  PVAMU_LETTERHEAD_SYSTEM_LINE,
  PVAMU_LETTERHEAD_UNIVERSITY_TITLE,
} from "./recommendation-letterhead-types"
import {
  buildLetterheadClosingLines,
  clampLetterheadBodyFontScale,
  clampLetterheadHeaderFontScale,
  clampLetterheadImageScale,
  clampLetterheadLogoTextGapPx,
  letterheadLogoBoxMm,
  parseLetterheadBodyTextAlign,
  parseLetterheadHeaderTextAlign,
} from "./recommendation-letterhead-signatory"
import { fitImageToBoxMm, loadLetterheadImageDataUrl } from "./recommendation-letterhead-images"
import {
  letterheadContentMarginMm,
  parseLetterheadContentMargin,
} from "./recommendation-letterhead-margin"

const BLACK: [number, number, number] = [20, 20, 20]
const GRAY_LINE: [number, number, number] = [190, 190, 190]

const FOOTER_RESERVE_MM = 26
/** ~195–205 px at 96dpi (before scale) */
const SIGNATURE_MAX_W_MM = 52
const SIGNATURE_MAX_H_MM = 20

/** Clean text for standard PDF fonts (Helvetica/Times) — reduces missing-glyph issues */
function sanitizePdfText(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "")
}

function recipientSalutation(recipientName: string | null | undefined): string {
  const r = recipientName?.trim()
  if (!r) return "To Whom It May Concern:"
  const lower = r.toLowerCase()
  if (lower === "to whom it may concern" || lower === "to whom it may concern:") return "To Whom It May Concern:"
  if (lower.startsWith("dear ")) return r.endsWith(":") ? r : `${r}:`
  return `Dear ${r}${r.endsWith(":") ? "" : ":"}`
}

function pageBodyBottom(pdf: jsPDF): number {
  return pdf.internal.pageSize.getHeight() - FOOTER_RESERVE_MM
}

/** Preview/CSS px → mm for PDF (96 CSS px ≈ 1 inch). */
function pxToMm(px: number): number {
  return (px * 25.4) / 96
}

/** jsPDF anchors: left = left edge; center / right align use matching x semantics. */
function bodyBlockTextOptions(bodyAlign: LetterheadBodyTextAlign, contentW: number) {
  return {
    maxWidth: contentW,
    align: bodyAlign as "left" | "center" | "right" | "justify",
  }
}

/** Single-line snippets (date, sincerely) wrapped with maxWidth for alignment symmetry. */
function writeBodyLine(
  pdf: jsPDF,
  textStr: string,
  y: number,
  opts: {
    bodyAlign: LetterheadBodyTextAlign
    fs: number
    bold: boolean
    margin: number
    pageW: number
    contentW: number
  },
): void {
  const { bodyAlign, fs, bold, margin, pageW, contentW } = opts
  pdf.setFont("times", bold ? "bold" : "normal")
  pdf.setFontSize(fs)
  const x =
    bodyAlign === "center" ? pageW / 2 : bodyAlign === "right" ? pageW - margin : margin
  pdf.text(textStr, x, y, bodyBlockTextOptions(bodyAlign, contentW))
}

function drawFooterBlock(pdf: jsPDF, marginMm: number): void {
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()

  pdf.setDrawColor(...GRAY_LINE)
  pdf.setLineWidth(0.12)
  const ruleY = pageH - 21
  pdf.line(marginMm, ruleY, pageW - marginMm, ruleY)

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(7.5)
  pdf.setTextColor(...BLACK)
  const lineH = 3.35
  const lines = [...PVAMU_LETTERHEAD_FOOTER_CONTACT_LINES]
  const blockBottom = pageH - 7.5
  let y = blockBottom
  for (let i = lines.length - 1; i >= 0; i--) {
    pdf.text(lines[i], pageW - marginMm, y, { align: "right" })
    y -= lineH
  }
  const blockMid = blockBottom - ((lines.length - 1) * lineH) / 2
  pdf.text(PVAMU_LETTERHEAD_FOOTER_WEB, marginMm, blockMid)

  pdf.setFontSize(6)
  pdf.setTextColor(130, 130, 130)
  pdf.text(PVAMU_LETTERHEAD_ATTRIBUTION, pageW / 2, pageH - 4, { align: "center" })
}

export async function buildRecommendationLetterheadPdf(
  input: RecommendationLetterheadContent,
): Promise<Buffer> {
  const letterBody = sanitizePdfText(input.letterBody)
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const marginMm = letterheadContentMarginMm(parseLetterheadContentMargin(input.contentMargin))
  const contentW = pageW - marginMm * 2
  const limitY = pageBodyBottom(pdf)

  const signatureScale = clampLetterheadImageScale(input.signatureScale, 1)
  const logoBoxMm = letterheadLogoBoxMm(input.logoScale)
  const logoBoxW = logoBoxMm.wMm
  const logoBoxH = logoBoxMm.hMm
  const sigBoxW = SIGNATURE_MAX_W_MM * signatureScale
  const sigBoxH = SIGNATURE_MAX_H_MM * signatureScale

  const logo = await loadLetterheadImageDataUrl(input.logoUrl)
  const sig = await loadLetterheadImageDataUrl(input.signatureUrl)

  const headerTop = marginMm
  let logoBottom = headerTop
  let logoWidthMm = 0

  if (logo && (logo.format === "PNG" || logo.format === "JPEG")) {
    const { widthMm, heightMm } = fitImageToBoxMm(logo.widthPx, logo.heightPx, logoBoxW, logoBoxH)
    try {
      pdf.addImage(logo.dataUrl, logo.format, marginMm, headerTop, widthMm, heightMm)
      logoBottom = headerTop + heightMm
      logoWidthMm = widthMm
    } catch {
      /* ignore broken image */
    }
  }

  let textY = headerTop + 6
  const gapPx = clampLetterheadLogoTextGapPx(input.headerLogoTextGapPx ?? 20)
  const gapMm = pxToMm(gapPx)
  const bannerStripeLeft = marginMm + logoWidthMm + gapMm
  const textRightX = pageW - marginMm
  const stripeRight = textRightX
  const stripeWidth = Math.max(10, stripeRight - bannerStripeLeft)

  const hdrFs = clampLetterheadHeaderFontScale(input.headerFontScale)
  const hdrAlign = parseLetterheadHeaderTextAlign(input.headerTextAlign)

  let headerBannerX: number
  const headerBannerOpts: { align: "left" | "center" | "right"; maxWidth: number } =
    hdrAlign === "left"
      ? { align: "left", maxWidth: stripeWidth }
      : hdrAlign === "right"
        ? { align: "right", maxWidth: stripeWidth }
        : { align: "center", maxWidth: stripeWidth }

  if (hdrAlign === "left") {
    headerBannerX = bannerStripeLeft
  } else if (hdrAlign === "right") {
    headerBannerX = stripeRight
  } else {
    headerBannerX = bannerStripeLeft + stripeWidth / 2
  }

  pdf.setTextColor(...BLACK)

  pdf.setFont("times", "bold")
  pdf.setFontSize(13.5 * hdrFs)
  pdf.text(PVAMU_LETTERHEAD_UNIVERSITY_TITLE, headerBannerX, textY, headerBannerOpts)
  textY += 6 * hdrFs

  pdf.setFont("times", "italic")
  pdf.setFontSize(8.2 * hdrFs)
  pdf.text(PVAMU_LETTERHEAD_SYSTEM_LINE, headerBannerX, textY, headerBannerOpts)
  textY += 5 * hdrFs

  const headerBlockBottom = Math.max(logoBottom, textY)
  const dividerY = headerBlockBottom + 3

  pdf.setDrawColor(...GRAY_LINE)
  pdf.setLineWidth(0.15)
  pdf.line(marginMm, dividerY, pageW - marginMm, dividerY)

  let y = dividerY + 9

  const bodyFsMul = clampLetterheadBodyFontScale(input.bodyFontScale, 1)
  const bodyAlign = parseLetterheadBodyTextAlign(input.bodyTextAlign)
  const lineHBase = 5.2 * bodyFsMul
  const paras = letterBody
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  function ensureRoom(minBelowMm: number) {
    if (y > limitY - minBelowMm) {
      pdf.addPage()
      y = marginMm
    }
  }

  writeBodyLine(pdf, input.date, y, {
    bodyAlign,
    fs: 11 * bodyFsMul,
    bold: false,
    margin: marginMm,
    pageW,
    contentW,
  })
  y += 8 * bodyFsMul

  const inside = input.recipientInsideAddressLines
  if (inside?.length) {
    pdf.setFont("times", "normal")
    for (const rawLine of inside) {
      const trimmed = String(rawLine ?? "")
        .replace(/\s+/g, " ")
        .trim()
      if (!trimmed) continue
      ensureRoom(lineHBase * 4)
      const wrappedLines = pdfSplitLines(pdf, trimmed, contentW)
      for (const chunk of wrappedLines) {
        ensureRoom(lineHBase * 2)
        writeBodyLine(pdf, chunk, y, {
          bodyAlign,
          fs: 11 * bodyFsMul,
          bold: false,
          margin: marginMm,
          pageW,
          contentW,
        })
        y += lineHBase
      }
    }
    y += 3 * bodyFsMul
  }

  writeBodyLine(pdf, recipientSalutation(input.recipientName), y, {
    bodyAlign,
    fs: 11 * bodyFsMul,
    bold: true,
    margin: marginMm,
    pageW,
    contentW,
  })
  y += 7 * bodyFsMul

  pdf.setFont("times", "normal")
  pdf.setFontSize(10.5 * bodyFsMul)
  if (input.letterPurpose?.trim()) {
    const reLine =
      input.reLine?.trim() ||
      `Re: Recommendation — ${input.studentName} (${input.letterPurpose})`
    pdf.text(reLine.replace(/\s+/g, " "), bodyAlign === "center" ? pageW / 2 : bodyAlign === "right" ? pageW - marginMm : marginMm, y, {
      ...bodyBlockTextOptions(bodyAlign, contentW),
    })
    y += 7 * bodyFsMul
  }

  pdf.setFontSize(11 * bodyFsMul)
  pdf.setFont("times", "normal")

  const innerLimit = (): void => ensureRoom(lineHBase * 4)

  for (const para of paras) {
    const flat = para.replace(/\s*\n+/g, " ").trim()
    if (!flat) continue
    innerLimit()
    const wrappedLines = pdfSplitLines(pdf, flat, contentW)
    if (wrappedLines.length === 0) continue
    for (const line of wrappedLines) {
      ensureRoom(lineHBase * 2)
      writeBodyLine(pdf, line, y, {
        /* splitTextToSize widths are per line; “justify” applied to each line as left after wrap */
        bodyAlign: bodyAlign === "justify" ? "left" : bodyAlign,
        fs: 11 * bodyFsMul,
        bold: false,
        margin: marginMm,
        pageW,
        contentW,
      })
      y += lineHBase
    }
    y += 2.5 * bodyFsMul
  }

  y += 4 * bodyFsMul
  ensureRoom(26 * bodyFsMul)

  pdf.setFont("times", "normal")
  pdf.setFontSize(11 * bodyFsMul)
  writeBodyLine(pdf, "Sincerely,", y, {
    bodyAlign,
    fs: 11 * bodyFsMul,
    bold: false,
    margin: marginMm,
    pageW,
    contentW,
  })
  y += 7 * bodyFsMul

  if (sig && (sig.format === "PNG" || sig.format === "JPEG")) {
    const { widthMm, heightMm } = fitImageToBoxMm(sig.widthPx, sig.heightPx, sigBoxW, sigBoxH)
    const sigLeft =
      bodyAlign === "center"
        ? pageW / 2 - widthMm / 2
        : bodyAlign === "right"
          ? pageW - marginMm - widthMm
          : marginMm
    innerLimit()
    if (y + heightMm > limitY) {
      pdf.addPage()
      y = marginMm
    }
    try {
      pdf.addImage(sig.dataUrl, sig.format, sigLeft, y, widthMm, heightMm)
      y += heightMm + 2.5 * bodyFsMul
    } catch {
      /* skip */
    }
  }

  pdf.setFontSize(10.5 * bodyFsMul)
  pdf.setFont("times", "bold")
  innerLimit()
  writeBodyLine(pdf, input.instructorName, y, {
    bodyAlign,
    fs: 10.5 * bodyFsMul,
    bold: true,
    margin: marginMm,
    pageW,
    contentW,
  })
  y += 5 * bodyFsMul
  pdf.setFont("times", "normal")
  pdf.setFontSize(10.5 * bodyFsMul)
  const closing = buildLetterheadClosingLines({
    signatoryLine: input.instructorName,
    instructorTitle: input.instructorTitle,
    instructorEmail: input.instructorEmail,
    instructorPhone: input.instructorPhone,
    instructorOffice: input.instructorOffice,
    signatureBlock: input.signatureBlock,
  })

  for (const line of closing) {
    if (y > limitY) {
      pdf.addPage()
      y = marginMm
    }
    pdf.text(
      line,
      bodyAlign === "center" ? pageW / 2 : bodyAlign === "right" ? pageW - marginMm : marginMm,
      y,
      bodyBlockTextOptions(bodyAlign, contentW),
    )
    y += 4.5 * bodyFsMul
  }

  const total = pdf.internal.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p)
    drawFooterBlock(pdf, marginMm)
  }

  return Buffer.from(pdf.output("arraybuffer"))
}

/** @deprecated Prefer buildRecommendationLetterheadPdf with full fields. */
export async function buildRecommendationLetterPdf(input: {
  universityName?: string
  departmentLine?: string
  instructorName: string
  instructorTitleLine?: string
  dateStr: string
  studentName: string
  letterBody: string
  signatureBlock?: string | null
}): Promise<Buffer> {
  return buildRecommendationLetterheadPdf({
    studentName: input.studentName,
    recipientName: null,
    letterPurpose: null,
    letterBody: input.letterBody,
    date: input.dateStr,
    instructorName: input.instructorName,
    instructorTitle: input.instructorTitleLine ?? null,
    instructorEmail: null,
    instructorPhone: null,
    instructorOffice: null,
    logoUrl: null,
    signatureUrl: null,
    logoScale: 1,
    signatureScale: 1,
  })
}
