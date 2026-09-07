/**
 * PDF layout helpers for circuit / multi-part questions (diagrams, sub-parts, uploads).
 */
import type { jsPDF } from "jspdf"
import {
  parseSubquestions,
  resolveMultiPartStudentAnswerForDisplay,
  subquestionOptionLabels,
  gradeSubPart,
  type MultiPartSubQuestion,
  type MultiPartSolutionUpload,
} from "@/lib/multi-part-question"
import { hasActiveQuestionMedia, resolveQuestionMedia } from "@/lib/question-media"
import { SOLUTION_UPLOAD_PART_KEY } from "@/lib/multi-part-grading-policy"
import type { QuestionResult } from "@/lib/quiz-results-pdf"
import { getBaseUrl } from "@/lib/get-base-url"
import {
  CIRCUIT_SUBMISSION_RUBRIC_KEYS,
  CIRCUIT_SUBMISSION_RUBRIC_LABELS,
  listCircuitSubmissionFiles,
  parseCircuitSubmissionAnswer,
  parseCircuitSubmissionConfig,
  type CircuitSubmissionRubricScores,
} from "@/lib/circuit-submission"
import { formatRichTextForPdf, splitRichTextParagraphs, parseAiFeedbackIntoPoints } from "@/lib/pdf-rich-text"
import { flattenStoredAiFeedback } from "@/lib/flatten-stored-ai-feedback"
import { isHeicMimeOrName } from "@/lib/heic-image"

export type QuizPdfLayout = {
  pdf: jsPDF
  margin: number
  contentWidth: number
  pageWidth: number
  pageHeight: number
  checkPageBreak: (neededHeight: number) => void
  wrapText: (text: string, maxWidth: number, fontSize: number) => string[]
  sanitizeForPDF: (text: string) => string
}

function toAbsoluteImageUrl(url: string): string {
  const trimmed = url.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const origin =
    (typeof window !== "undefined" && window.location?.origin) || getBaseUrl()
  return new URL(trimmed.startsWith("/") ? trimmed : `/${trimmed}`, origin).href
}

function parseDataUrl(dataUrl: string): { format: "JPEG" | "PNG" | "WEBP"; data: string } | null {
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/i)
  if (!match) return null
  const ext = match[1].toLowerCase()
  const format = ext === "png" ? "PNG" : ext === "webp" ? "WEBP" : "JPEG"
  return { format, data: match[2] }
}

async function loadImageBase64(
  url: string,
  mimeHint?: string,
  nameHint?: string,
): Promise<{ format: "JPEG" | "PNG" | "WEBP"; data: string } | null> {
  if (url.startsWith("data:image")) {
    return parseDataUrl(url)
  }

  if (isHeicMimeOrName(mimeHint, nameHint) || isHeicMimeOrName(null, url)) {
    try {
      const proxyPath = `/api/solution-image?url=${encodeURIComponent(url)}`
      const proxyUrl =
        typeof window !== "undefined"
          ? proxyPath
          : new URL(proxyPath, getBaseUrl()).href
      const res = await fetch(proxyUrl)
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer()
        if (typeof Buffer !== "undefined") {
          return { format: "JPEG", data: Buffer.from(arrayBuffer).toString("base64") }
        }
        const blob = new Blob([arrayBuffer], { type: "image/jpeg" })
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error("Failed to read HEIC proxy image"))
          reader.readAsDataURL(blob)
        })
        return parseDataUrl(dataUrl)
      }
    } catch {
      /* fall through to direct fetch */
    }
  }

  try {
    const res = await fetch(toAbsoluteImageUrl(url))
    if (!res.ok) return null
    const contentType = (res.headers.get("content-type") || "").toLowerCase()
    const format: "JPEG" | "PNG" | "WEBP" = contentType.includes("png")
      ? "PNG"
      : contentType.includes("webp")
        ? "WEBP"
        : "JPEG"

    const arrayBuffer = await res.arrayBuffer()
    if (typeof Buffer !== "undefined") {
      return { format, data: Buffer.from(arrayBuffer).toString("base64") }
    }

    const blob = new Blob([arrayBuffer], { type: contentType || "image/png" })
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error("Failed to read image"))
      reader.readAsDataURL(blob)
    })
    return parseDataUrl(dataUrl)
  } catch {
    return null
  }
}

/** Decode base64 image payload for header parsing (Node + browser). */
function decodeImageBytes(data: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(data, "base64")
  }
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function readUInt16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1]
}

function readUInt32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  )
}

function readPngPixelSize(bytes: Uint8Array): { pxW: number; pxH: number } | null {
  if (bytes.length < 24) return null
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null
  return { pxW: readUInt32BE(bytes, 16), pxH: readUInt32BE(bytes, 20) }
}

function readJpegPixelSize(bytes: Uint8Array): { pxW: number; pxH: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let i = 2
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++
      continue
    }
    const marker = bytes[i + 1]
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { pxH: readUInt16BE(bytes, i + 5), pxW: readUInt16BE(bytes, i + 7) }
    }
    if (marker === 0xd8 || marker === 0xd9) {
      i += 2
      continue
    }
    const segmentLen = readUInt16BE(bytes, i + 2)
    if (segmentLen < 2) break
    i += 2 + segmentLen
  }
  return null
}

function readWebpPixelSize(bytes: Uint8Array): { pxW: number; pxH: number } | null {
  if (bytes.length < 30) return null
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
  if (riff !== "RIFF" || webp !== "WEBP") return null
  const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15])
  if (chunk === "VP8 " && bytes.length >= 30) {
    return { pxW: readUInt16BE(bytes, 26) & 0x3fff, pxH: readUInt16BE(bytes, 28) & 0x3fff }
  }
  if (chunk === "VP8L" && bytes.length >= 25) {
    const bits = readUInt32BE(bytes, 21)
    return { pxW: (bits & 0x3fff) + 1, pxH: ((bits >> 14) & 0x3fff) + 1 }
  }
  if (chunk === "VP8X" && bytes.length >= 30) {
    const pxW = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16))
    const pxH = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16))
    return { pxW, pxH }
  }
  return null
}

function readIntrinsicPixelSize(img: {
  format: "JPEG" | "PNG" | "WEBP"
  data: string
}): { pxW: number; pxH: number } | null {
  const bytes = decodeImageBytes(img.data)
  if (img.format === "PNG") return readPngPixelSize(bytes)
  if (img.format === "JPEG") return readJpegPixelSize(bytes)
  if (img.format === "WEBP") return readWebpPixelSize(bytes)
  return readPngPixelSize(bytes) ?? readJpegPixelSize(bytes) ?? readWebpPixelSize(bytes)
}

/** Scale image to fit max box in mm while preserving aspect ratio. */
function fitImageDimensionsMm(
  pxW: number,
  pxH: number,
  maxWidthMm: number,
  maxHeightMm: number,
): { widthMm: number; heightMm: number } {
  if (pxW <= 0 || pxH <= 0) {
    return {
      widthMm: Math.min(maxWidthMm, maxHeightMm),
      heightMm: Math.min(maxHeightMm, maxWidthMm * 0.75),
    }
  }

  const aspect = pxW / pxH
  let widthMm = maxWidthMm
  let heightMm = widthMm / aspect
  if (heightMm > maxHeightMm) {
    heightMm = maxHeightMm
    widthMm = heightMm * aspect
  }

  return {
    widthMm: Math.max(12, widthMm),
    heightMm: Math.max(10, heightMm),
  }
}

function getImageDimensionsMm(
  img: { format: "JPEG" | "PNG" | "WEBP"; data: string },
  maxWidthMm: number,
  maxHeightMm: number,
): { widthMm: number; heightMm: number } {
  const intrinsic = readIntrinsicPixelSize(img)
  if (!intrinsic) {
    return fitImageDimensionsMm(0, 0, maxWidthMm, maxHeightMm)
  }
  return fitImageDimensionsMm(intrinsic.pxW, intrinsic.pxH, maxWidthMm, maxHeightMm)
}

async function embedImageBlock(
  layout: QuizPdfLayout,
  yPos: number,
  label: string,
  url: string,
  mimeHint?: string,
  maxHeightMm = 48,
  nameHint?: string,
): Promise<number> {
  const { pdf, margin, contentWidth, checkPageBreak, sanitizeForPDF } = layout
  const img = await loadImageBase64(url, mimeHint, nameHint)
  if (!img) {
    checkPageBreak(12)
    pdf.setFontSize(8)
    pdf.setTextColor(100, 116, 139)
    pdf.setFont("helvetica", "italic")
    pdf.text(`${sanitizeForPDF(label)}: (diagram not available in PDF export)`, margin + 8, yPos)
    return yPos + 8
  }

  const maxW = contentWidth - 20
  const { widthMm, heightMm } = getImageDimensionsMm(img, maxW, maxHeightMm)
  const boxW = contentWidth - 16
  const boxH = heightMm + 10
  checkPageBreak(boxH + 14)

  pdf.setFillColor(248, 250, 252)
  pdf.rect(margin + 5, yPos, contentWidth - 10, boxH, "F")
  pdf.setDrawColor(203, 213, 225)
  pdf.rect(margin + 5, yPos, contentWidth - 10, boxH, "S")

  pdf.setFontSize(8)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(51, 65, 85)
  pdf.text(sanitizeForPDF(label), margin + 8, yPos + 5)

  const imgX = margin + 8 + Math.max(0, (boxW - widthMm) / 2)
  try {
    pdf.addImage(img.data, img.format, imgX, yPos + 8, widthMm, heightMm, undefined, "FAST")
  } catch {
    pdf.setFont("helvetica", "italic")
    pdf.setTextColor(148, 163, 184)
    pdf.text("(image could not be embedded)", margin + 8, yPos + 14)
    return yPos + boxH + 6
  }

  return yPos + boxH + 6
}

export function formatQuestionTypeLabelForPdf(question: QuestionResult): string {
  const t = (question.question_type || "").toLowerCase()
  if (t === "multi_part") return "Multi-part Circuit Problem"
  if (t.startsWith("circuit_")) return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  return question.question_type || "Question"
}

export async function renderQuestionMediaInPdf(
  layout: QuizPdfLayout,
  question: QuestionResult,
  yPos: number,
): Promise<number> {
  const media = resolveQuestionMedia(question)
  if (!hasActiveQuestionMedia(media)) return yPos

  const caption = media.media_caption?.trim() || media.media_alt_text?.trim() || "Circuit diagram"
  const url = (media.media_url || "").trim()

  if (media.media_type === "pdf") {
    layout.checkPageBreak(14)
    layout.pdf.setFontSize(8)
    layout.pdf.setTextColor(51, 65, 85)
    layout.pdf.setFont("helvetica", "bold")
    layout.pdf.text(layout.sanitizeForPDF(caption), layout.margin + 8, yPos)
    yPos += 5
    layout.pdf.setFont("helvetica", "italic")
    layout.pdf.setTextColor(100, 116, 139)
    layout.pdf.text("(PDF diagram — open the online report to view)", layout.margin + 8, yPos)
    return yPos + 8
  }

  return embedImageBlock(layout, yPos, caption, url, undefined, 62)
}

function partLabel(index: number, id: string): string {
  const letter = id.match(/^([a-z])$/i)?.[1]?.toUpperCase()
  if (letter) return `Part (${letter.toLowerCase()})`
  return `Part ${index + 1} (${id})`
}

function formatSubmittedPart(
  sq: MultiPartSubQuestion,
  submitted: string | string[] | undefined,
  labels: { letter: string; text: string }[],
): string {
  const type = sq.type.toLowerCase()
  if (type === "select_all") {
    const ids = Array.isArray(submitted) ? submitted.map((x) => String(x).trim().toUpperCase()) : []
    if (ids.length === 0) return "No selection"
    return ids
      .map((id) => {
        const opt = labels.find((l) => l.letter.toUpperCase() === id)
        return opt ? `${id}. ${opt.text}` : id
      })
      .join("; ")
  }
  const id = String(submitted ?? "").trim().toUpperCase()
  if (!id) return "No answer"
  const opt = labels.find((l) => l.letter.toUpperCase() === id)
  return opt ? `${id}. ${opt.text}` : id
}

function formatCorrectPart(sq: MultiPartSubQuestion, labels: { letter: string; text: string }[]): string {
  const type = sq.type.toLowerCase()
  if (type === "select_all") {
    const ids = (sq.correct_answers ?? []).map((x) => x.toUpperCase())
    if (ids.length === 0) return "—"
    return ids
      .map((id) => {
        const opt = labels.find((l) => l.letter.toUpperCase() === id)
        return opt ? `${id}. ${opt.text}` : id
      })
      .join("; ")
  }
  const id = (sq.correct_answer ?? "").toUpperCase()
  if (!id) return "—"
  const opt = labels.find((l) => l.letter.toUpperCase() === id)
  return opt ? `${id}. ${opt.text}` : id
}

function drawWrappedBlock(
  layout: QuizPdfLayout,
  yPos: number,
  title: string,
  body: string,
  fillRgb: [number, number, number],
  titleRgb: [number, number, number],
  minBoxH = 14,
): number {
  const { pdf, margin, contentWidth, checkPageBreak, wrapText, sanitizeForPDF } = layout
  const lines = wrapText(body || "—", contentWidth - 26, 8)
  const boxH = Math.max(minBoxH, lines.length * 4 + 10)
  checkPageBreak(boxH + 4)

  pdf.setFillColor(...fillRgb)
  pdf.rect(margin + 5, yPos, contentWidth - 10, boxH, "F")

  pdf.setFontSize(9)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(...titleRgb)
  pdf.text(sanitizeForPDF(title), margin + 8, yPos + 5)

  pdf.setFontSize(8)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(30, 41, 59)
  lines.forEach((line, i) => {
    pdf.text(line, margin + 8, yPos + 10 + i * 4)
  })

  return yPos + boxH + 4
}

function drawSubPartOptions(
  layout: QuizPdfLayout,
  sq: MultiPartSubQuestion,
  submitted: string | string[] | undefined,
  yPos: number,
): number {
  const { pdf, margin, contentWidth, checkPageBreak, wrapText, sanitizeForPDF } = layout
  const labels = subquestionOptionLabels(sq)
  const type = sq.type.toLowerCase()
  const selectedSet = new Set(
    type === "select_all" && Array.isArray(submitted)
      ? submitted.map((x) => String(x).trim().toUpperCase())
      : [String(submitted ?? "").trim().toUpperCase()].filter(Boolean),
  )
  const correctSet = new Set(
    type === "select_all"
      ? (sq.correct_answers ?? []).map((x) => x.toUpperCase())
      : [(sq.correct_answer ?? "").toUpperCase()].filter(Boolean),
  )

  for (const { letter, text } of labels) {
    if (!text?.trim()) continue
    checkPageBreak(10)
    const L = letter.toUpperCase()
    const isCorrect = correctSet.has(L)
    const isSelected = selectedSet.has(L)

    if (isCorrect && isSelected) pdf.setFillColor(209, 250, 229)
    else if (isCorrect) pdf.setFillColor(219, 234, 254)
    else if (isSelected) pdf.setFillColor(254, 226, 226)
    else pdf.setFillColor(248, 250, 252)

    const optLines = wrapText(`${L}. ${text}`, contentWidth - 28, 8)
    const h = Math.max(8, optLines.length * 4 + 4)
    pdf.rect(margin + 10, yPos, contentWidth - 20, h, "F")

    pdf.setFontSize(8)
    pdf.setFont("helvetica", isSelected || isCorrect ? "bold" : "normal")
    if (isCorrect && isSelected) pdf.setTextColor(22, 101, 52)
    else if (isCorrect) pdf.setTextColor(30, 64, 175)
    else if (isSelected) pdf.setTextColor(185, 28, 28)
    else pdf.setTextColor(51, 65, 85)

    optLines.forEach((line, i) => {
      pdf.text(sanitizeForPDF(line), margin + 12, yPos + 4 + i * 4)
    })
    yPos += h + 2
  }

  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(0, 0, 0)
  return yPos
}

async function renderSolutionUpload(
  layout: QuizPdfLayout,
  partTitle: string,
  upload: MultiPartSolutionUpload,
  yPos: number,
): Promise<number> {
  const { pdf, margin, contentWidth, checkPageBreak, sanitizeForPDF } = layout
  checkPageBreak(16)
  pdf.setFontSize(8)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(79, 70, 229)
  pdf.text(sanitizeForPDF(`${partTitle} — Worked solution upload`), margin + 8, yPos)
  yPos += 5

  const name = upload.name || "upload"
  const mime = (upload.mime || "").toLowerCase()
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(100, 116, 139)
  pdf.text(sanitizeForPDF(name), margin + 8, yPos)
  yPos += 5

  if (mime.includes("pdf") || name.toLowerCase().endsWith(".pdf")) {
    pdf.setFont("helvetica", "italic")
    pdf.text("(PDF — view in the online report)", margin + 8, yPos)
    return yPos + 8
  }

  if (upload.url && (mime.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|heif)$/i.test(name))) {
    return embedImageBlock(layout, yPos, "Uploaded solution", upload.url, upload.mime, 110, name)
  }

  if (upload.url) {
    pdf.text(sanitizeForPDF(upload.url), margin + 8, yPos)
    return yPos + 6
  }

  return yPos + 4
}

function drawPdfSectionHeader(
  layout: QuizPdfLayout,
  yPos: number,
  title: string,
  fillRgb: [number, number, number],
  titleRgb: [number, number, number],
): number {
  const { pdf, margin, contentWidth, checkPageBreak, sanitizeForPDF } = layout
  checkPageBreak(12)
  pdf.setFillColor(...fillRgb)
  pdf.rect(margin + 5, yPos, contentWidth - 10, 8, "F")
  pdf.setFontSize(9)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(...titleRgb)
  pdf.text(sanitizeForPDF(title), margin + 8, yPos + 5.5)
  return yPos + 11
}

function drawRichTextBlock(
  layout: QuizPdfLayout,
  yPos: number,
  body: string,
  opts?: { fontSize?: number; indent?: number; lineHeight?: number },
): number {
  const { pdf, margin, contentWidth, checkPageBreak, wrapText } = layout
  const fontSize = opts?.fontSize ?? 9
  const indent = opts?.indent ?? 8
  const lineHeight = opts?.lineHeight ?? 4.8
  const paragraphs = splitRichTextParagraphs(body)

  pdf.setFontSize(fontSize)
  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(30, 41, 59)

  for (const paragraph of paragraphs) {
    const lines = wrapText(paragraph, contentWidth - indent - 8, fontSize)
    checkPageBreak(lines.length * lineHeight + 4)
    for (const line of lines) {
      pdf.text(line, margin + indent, yPos)
      yPos += lineHeight
    }
    yPos += 2
  }

  return yPos
}

function drawFeedbackSubheading(
  layout: QuizPdfLayout,
  yPos: number,
  title: string,
  fillRgb: [number, number, number],
  titleRgb: [number, number, number],
): number {
  const { pdf, margin, contentWidth, checkPageBreak, sanitizeForPDF } = layout
  checkPageBreak(10)
  pdf.setFillColor(...fillRgb)
  pdf.rect(margin + 5, yPos, contentWidth - 10, 7, "F")
  pdf.setFontSize(8)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(...titleRgb)
  pdf.text(sanitizeForPDF(title), margin + 8, yPos + 4.8)
  return yPos + 9
}

function drawRubricBreakdownBox(
  layout: QuizPdfLayout,
  yPos: number,
  scores: CircuitSubmissionRubricScores,
  totalScore: unknown,
  maxPoints: unknown,
): number {
  const { pdf, margin, contentWidth, checkPageBreak, sanitizeForPDF } = layout
  const rows = CIRCUIT_SUBMISSION_RUBRIC_KEYS.filter((key) => scores[key] != null)
  const rowCount = rows.length + (totalScore != null && maxPoints != null ? 1 : 0)
  if (rowCount === 0) return yPos

  const boxH = 8 + rowCount * 6 + 4
  checkPageBreak(boxH + 4)

  pdf.setFillColor(255, 255, 255)
  pdf.setDrawColor(203, 213, 225)
  pdf.setLineWidth(0.3)
  pdf.rect(margin + 5, yPos, contentWidth - 10, boxH, "FD")

  let innerY = yPos + 5
  pdf.setFontSize(8)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(51, 65, 85)
  pdf.text("Rubric Breakdown", margin + 8, innerY)
  innerY += 6

  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(71, 85, 105)
  for (const key of rows) {
    const earned = scores[key]
    const label = CIRCUIT_SUBMISSION_RUBRIC_LABELS[key]
    pdf.text(sanitizeForPDF(label), margin + 10, innerY)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(30, 41, 59)
    pdf.text(sanitizeForPDF(String(earned)), margin + contentWidth - 28, innerY, { align: "right" })
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(71, 85, 105)
    innerY += 5.5
  }

  if (totalScore != null && maxPoints != null) {
    pdf.setDrawColor(226, 232, 240)
    pdf.line(margin + 8, innerY - 1, margin + contentWidth - 12, innerY - 1)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(30, 64, 175)
    pdf.text("Total score", margin + 10, innerY + 3)
    pdf.text(
      sanitizeForPDF(`${totalScore} / ${maxPoints} pts`),
      margin + contentWidth - 28,
      innerY + 3,
      { align: "right" },
    )
    innerY += 6
  }

  return yPos + boxH + 5
}

function drawNumberedFeedbackPoint(
  layout: QuizPdfLayout,
  yPos: number,
  label: string,
  body: string,
): number {
  const { pdf, margin, contentWidth, checkPageBreak, wrapText, sanitizeForPDF } = layout
  const textWidth = contentWidth - 34
  const lines = wrapText(body, textWidth, 8)
  const boxH = Math.max(12, lines.length * 4.6 + 7)
  checkPageBreak(boxH + 5)

  pdf.setFillColor(255, 255, 255)
  pdf.setDrawColor(226, 232, 240)
  pdf.setLineWidth(0.25)
  pdf.rect(margin + 5, yPos, contentWidth - 10, boxH, "FD")

  pdf.setFillColor(219, 234, 254)
  pdf.rect(margin + 8, yPos + 3, 8, 6, "F")
  pdf.setFontSize(8)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(30, 64, 175)
  pdf.text(sanitizeForPDF(label), margin + 12, yPos + 7, { align: "center" })

  pdf.setFont("helvetica", "normal")
  pdf.setTextColor(30, 41, 59)
  pdf.setFontSize(8)
  let lineY = yPos + 7
  for (const line of lines) {
    pdf.text(line, margin + 20, lineY)
    lineY += 4.6
  }

  return yPos + boxH + 4
}

export function drawStructuredFeedbackPoints(
  layout: QuizPdfLayout,
  yPos: number,
  feedbackText: string,
): number {
  const points = parseAiFeedbackIntoPoints(feedbackText)
  if (points.length === 0) return yPos

  yPos = drawFeedbackSubheading(
    layout,
    yPos,
    "Detailed Evaluation",
    [241, 245, 249],
    [51, 65, 85],
  )

  for (const point of points) {
    if (point.kind === "numbered" && point.label) {
      yPos = drawNumberedFeedbackPoint(layout, yPos, point.label, point.body)
    } else {
      yPos = drawRichTextBlock(layout, yPos, point.body, {
        fontSize: 8,
        indent: 10,
        lineHeight: 4.6,
      })
      yPos += 2
    }
  }

  return yPos + 2
}

export function drawFeedbackBulletSection(
  layout: QuizPdfLayout,
  yPos: number,
  title: string,
  items: string[],
  colors: {
    headerFill: [number, number, number]
    headerText: [number, number, number]
    boxFill: [number, number, number]
    border: [number, number, number]
    bullet: [number, number, number]
    text: [number, number, number]
  },
): number {
  if (!items.length) return yPos

  const { pdf, margin, contentWidth, checkPageBreak, wrapText, sanitizeForPDF } = layout
  const prepared = items
    .map((item) => formatRichTextForPdf(item))
    .filter(Boolean)
  if (!prepared.length) return yPos

  const lineGroups = prepared.map((item) => wrapText(item, contentWidth - 30, 8))
  const contentH = lineGroups.reduce((sum, lines) => sum + lines.length * 4.6 + 2, 0)
  const boxH = 9 + contentH + 4
  checkPageBreak(boxH + 4)

  pdf.setFillColor(...colors.boxFill)
  pdf.setDrawColor(...colors.border)
  pdf.setLineWidth(0.25)
  pdf.rect(margin + 5, yPos, contentWidth - 10, boxH, "FD")

  pdf.setFillColor(...colors.headerFill)
  pdf.rect(margin + 5, yPos, contentWidth - 10, 8, "F")
  pdf.setFontSize(8)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(...colors.headerText)
  pdf.text(sanitizeForPDF(title), margin + 8, yPos + 5.2)

  let innerY = yPos + 12
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(8)
  for (const lines of lineGroups) {
    pdf.setTextColor(...colors.bullet)
    pdf.setFont("helvetica", "bold")
    pdf.text("-", margin + 10, innerY)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(...colors.text)
    for (let i = 0; i < lines.length; i++) {
      pdf.text(sanitizeForPDF(lines[i]), margin + (i === 0 ? 14 : 14), innerY)
      innerY += 4.6
    }
    innerY += 2
  }

  return yPos + boxH + 5
}

/** Structured AI feedback layout (circuit + general code feedback). */
export function renderStructuredAiFeedbackInPdf(
  layout: QuizPdfLayout,
  aiFeedback: Record<string, unknown>,
  yPos: number,
  opts?: {
    title?: string
    skipHeader?: boolean
    skipRubric?: boolean
    includeStrengths?: boolean
    includeImprovements?: boolean
    includeSuggestions?: boolean
  },
): number {
  const normalized = flattenStoredAiFeedback(aiFeedback) ?? aiFeedback
  const feedbackText =
    (typeof normalized.feedback === "string" && normalized.feedback) ||
    (typeof normalized.detailedExplanation === "string" && normalized.detailedExplanation) ||
    ""

  if (!opts?.skipHeader) {
    yPos = drawPdfSectionHeader(
      layout,
      yPos,
      opts?.title ?? "Quiz Master Evaluation Feedback",
      [239, 246, 255],
      [30, 64, 175],
    )
  }

  const rubricScores = normalized.rubricScores as CircuitSubmissionRubricScores | undefined
  const rubricPreview = normalized.rubricScoresPreview as CircuitSubmissionRubricScores | undefined
  const scores = rubricScores ?? rubricPreview
  if (!opts?.skipRubric && scores && typeof scores === "object") {
    yPos = drawRubricBreakdownBox(
      layout,
      yPos,
      scores,
      normalized.totalScore ?? normalized.totalScorePreview,
      normalized.maxPoints,
    )
  }

  if (feedbackText) {
    yPos = drawStructuredFeedbackPoints(layout, yPos, feedbackText)
  }

  const strengths = Array.isArray(normalized.strengths)
    ? normalized.strengths.filter((s): s is string => typeof s === "string")
    : []
  const improvements = Array.isArray(normalized.improvements)
    ? normalized.improvements.filter((s): s is string => typeof s === "string")
    : []

  const showStrengths = opts?.includeStrengths !== false
  const showImprovements = opts?.includeImprovements !== false
  const showSuggestions = opts?.includeSuggestions !== false

  if (showStrengths) {
    yPos = drawFeedbackBulletSection(layout, yPos, "Strengths", strengths, {
      headerFill: [220, 252, 231],
      headerText: [22, 101, 52],
      boxFill: [240, 253, 244],
      border: [167, 243, 208],
      bullet: [22, 163, 74],
      text: [21, 83, 45],
    })
  }

  if (showImprovements) {
    yPos = drawFeedbackBulletSection(layout, yPos, "Areas for Improvement", improvements, {
      headerFill: [254, 243, 199],
      headerText: [180, 83, 9],
      boxFill: [255, 251, 235],
      border: [253, 230, 138],
      bullet: [217, 119, 6],
      text: [146, 64, 14],
    })
  }

  const suggestions = Array.isArray(normalized.suggestions)
    ? normalized.suggestions.filter((s): s is string => typeof s === "string")
    : []
  if (showSuggestions) {
    yPos = drawFeedbackBulletSection(layout, yPos, "Suggestions", suggestions, {
      headerFill: [219, 234, 254],
      headerText: [30, 64, 175],
      boxFill: [239, 246, 255],
      border: [191, 219, 254],
      bullet: [37, 99, 235],
      text: [30, 58, 95],
    })
  }

  if (normalized.expectedAnswerUsed === true) {
    layout.checkPageBreak(10)
    layout.pdf.setFillColor(248, 250, 252)
    layout.pdf.rect(layout.margin + 5, yPos, layout.contentWidth - 10, 7, "F")
    layout.pdf.setFontSize(7)
    layout.pdf.setFont("helvetica", "italic")
    layout.pdf.setTextColor(100, 116, 139)
    layout.pdf.text(
      "Graded using instructor reference solution for verification.",
      layout.margin + 8,
      yPos + 4.5,
    )
    yPos += 10
  }

  return yPos + 4
}

function drawBulletList(
  layout: QuizPdfLayout,
  yPos: number,
  title: string,
  items: string[],
  titleRgb: [number, number, number],
): number {
  if (!items.length) return yPos
  yPos = drawPdfSectionHeader(layout, yPos, title, [248, 250, 252], titleRgb)
  for (const item of items) {
    const formatted = formatRichTextForPdf(item)
    if (!formatted) continue
    const lines = layout.wrapText(`- ${formatted}`, layout.contentWidth - 22, 8)
    layout.checkPageBreak(lines.length * 4.8 + 2)
    layout.pdf.setFontSize(8)
    layout.pdf.setFont("helvetica", "normal")
    layout.pdf.setTextColor(51, 65, 85)
    for (const line of lines) {
      layout.pdf.text(layout.sanitizeForPDF(line), layout.margin + 10, yPos)
      yPos += 4.8
    }
    yPos += 1.5
  }
  return yPos + 2
}

export async function renderCircuitSubmissionInPdf(
  layout: QuizPdfLayout,
  question: QuestionResult & {
    hint?: string | null
    solution_upload_config?: unknown
  },
  yPos: number,
  opts?: { includeTitle?: boolean },
): Promise<number> {
  const { pdf, margin, contentWidth, checkPageBreak, sanitizeForPDF } = layout
  const config = parseCircuitSubmissionConfig(question.solution_upload_config)
  const parsed = parseCircuitSubmissionAnswer(question.selected_answer ?? question.answer_data)
  const files = listCircuitSubmissionFiles(parsed.solution_uploads)
  const title = config.title || question.hint?.trim() || null
  const includeTitle = opts?.includeTitle !== false

  if (includeTitle && title) {
    checkPageBreak(10)
    pdf.setFontSize(10)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(30, 41, 59)
    pdf.text(sanitizeForPDF(title), margin + 5, yPos)
    yPos += 7
  }

  if (config.submission_instructions?.trim()) {
    yPos = drawRichTextBlock(layout, yPos, config.submission_instructions, { fontSize: 8 })
    yPos += 2
  }

  checkPageBreak(14)
  pdf.setFillColor(236, 253, 245)
  pdf.rect(margin + 5, yPos, contentWidth - 10, 9, "F")
  pdf.setFontSize(8)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(22, 101, 52)
  const statusLabel =
    parsed.submission_status === "graded"
      ? "Graded submission"
      : files.length > 0
        ? "Submitted work"
        : "No solution uploaded"
  pdf.text(statusLabel, margin + 8, yPos + 5.5)
  if (files.length > 0) {
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(21, 128, 61)
    pdf.text(`${files.length} file${files.length === 1 ? "" : "s"} attached`, margin + 55, yPos + 5.5)
  }
  yPos += 13

  if (files.length === 0) {
    pdf.setFontSize(9)
    pdf.setFont("helvetica", "italic")
    pdf.setTextColor(180, 83, 9)
    pdf.text("No solution files were uploaded for this question.", margin + 8, yPos)
    return yPos + 10
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const label =
      files.length === 1
        ? "Your uploaded solution"
        : `Your uploaded solution (${i + 1} of ${files.length})`
    yPos = await embedImageBlock(layout, yPos, label, file.url, file.mime, 120, file.name)
  }

  return yPos + 2
}

export function renderCircuitSubmissionAiFeedbackInPdf(
  layout: QuizPdfLayout,
  aiFeedback: Record<string, unknown>,
  yPos: number,
): number {
  return renderStructuredAiFeedbackInPdf(layout, aiFeedback, yPos)
}

export async function renderMultiPartQuestionInPdf(
  layout: QuizPdfLayout,
  question: QuestionResult,
  yPos: number,
): Promise<number> {
  const { pdf, margin, contentWidth, checkPageBreak, wrapText, sanitizeForPDF, pageWidth } = layout
  const subs = parseSubquestions(question.subquestions)
  if (subs.length === 0) {
    checkPageBreak(12)
    pdf.setFontSize(9)
    pdf.setTextColor(180, 83, 9)
    pdf.text("Multi-part question: no sub-parts configured.", margin + 8, yPos)
    return yPos + 10
  }

  const parsed = resolveMultiPartStudentAnswerForDisplay(
    question.selected_answer,
    question.answer_data,
    subs,
  )
  const uploads = parsed.solution_uploads ?? {}

  checkPageBreak(14)
  pdf.setFillColor(241, 245, 249)
  pdf.rect(margin + 5, yPos, contentWidth - 10, 8, "F")
  pdf.setFontSize(9)
  pdf.setFont("helvetica", "bold")
  pdf.setTextColor(30, 41, 59)
  pdf.text(`Sub-parts (${subs.length})`, margin + 8, yPos + 5)
  yPos += 12

  for (let idx = 0; idx < subs.length; idx++) {
    const sq = subs[idx]
    const labels = subquestionOptionLabels(sq)
    const submitted = parsed.parts[sq.id]
    const { fraction, isFullyCorrect } = gradeSubPart(sq, submitted)
    const maxPts = sq.points && sq.points > 0 ? sq.points : 1
    const earnedPts = Math.round(fraction * maxPts * 100) / 100

    checkPageBreak(28)
    pdf.setDrawColor(203, 213, 225)
    pdf.setLineWidth(0.2)
    pdf.line(margin + 5, yPos, margin + contentWidth - 5, yPos)
    yPos += 4

    pdf.setFontSize(9)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(30, 41, 59)
    const header = `${partLabel(idx, sq.id)} · ${maxPts} pt${maxPts === 1 ? "" : "s"}`
    pdf.text(sanitizeForPDF(header), margin + 8, yPos)

    pdf.setFontSize(8)
    pdf.setFont("helvetica", "bold")
    if (isFullyCorrect) pdf.setTextColor(22, 163, 74)
    else if (fraction > 0) pdf.setTextColor(217, 119, 6)
    else pdf.setTextColor(220, 38, 38)
    pdf.text(
      `${earnedPts}/${maxPts} pts`,
      pageWidth - layout.margin - 28,
      yPos,
    )
    yPos += 6

    const promptLines = wrapText(sq.prompt, contentWidth - 20, 9)
    pdf.setFontSize(9)
    pdf.setFont("helvetica", "normal")
    pdf.setTextColor(51, 65, 85)
    promptLines.forEach((line) => {
      checkPageBreak(5)
      pdf.text(sanitizeForPDF(line), margin + 8, yPos)
      yPos += 4.5
    })
    yPos += 2

    const typeLabel =
      sq.type.toLowerCase() === "select_all" ? "Select all that apply" : "Multiple choice"
    pdf.setFontSize(7)
    pdf.setTextColor(100, 116, 139)
    pdf.text(typeLabel, margin + 8, yPos)
    yPos += 5

    yPos = drawSubPartOptions(layout, sq, submitted, yPos)

    yPos = drawWrappedBlock(
      layout,
      yPos,
      "Your answer:",
      formatSubmittedPart(sq, submitted, labels),
      [254, 242, 242],
      [127, 29, 29],
    )

    yPos = drawWrappedBlock(
      layout,
      yPos,
      "Correct answer:",
      formatCorrectPart(sq, labels),
      [219, 234, 254],
      [30, 64, 175],
    )

    if (sq.explanation?.trim()) {
      yPos = drawWrappedBlock(
        layout,
        yPos,
        "Explanation:",
        sq.explanation,
        [254, 249, 195],
        [133, 77, 14],
      )
    }

    const upload = uploads[sq.id]
    if (upload?.url) {
      yPos = await renderSolutionUpload(layout, partLabel(idx, sq.id), upload, yPos)
    }

    yPos += 4
  }

  const rootUpload = uploads[SOLUTION_UPLOAD_PART_KEY]
  if (rootUpload?.url) {
    yPos = await renderSolutionUpload(layout, "Worked solution", rootUpload, yPos)
  }

  const uploadKeys = Object.keys(uploads)
  if (uploadKeys.length > 0) {
    checkPageBreak(10)
    pdf.setFontSize(8)
    pdf.setTextColor(100, 116, 139)
    pdf.setFont("helvetica", "italic")
    let bonus: number | null = null
    if (question.answer_data != null) {
      try {
        const ad =
          typeof question.answer_data === "string"
            ? JSON.parse(question.answer_data)
            : question.answer_data
        if (ad && typeof ad === "object" && (ad as Record<string, unknown>).solution_upload_bonus != null) {
          bonus = Number((ad as Record<string, unknown>).solution_upload_bonus)
        }
      } catch {
        /* ignore */
      }
    }
    if (bonus != null && Number(bonus) > 0) {
      pdf.text(
        sanitizeForPDF(`Solution upload bonus applied: +${Number(bonus)} pts (subject to instructor review)`),
        margin + 8,
        yPos,
      )
      yPos += 6
    }
  }

  if (question.requires_review) {
    checkPageBreak(10)
    pdf.setFillColor(254, 243, 199)
    pdf.rect(margin + 5, yPos, contentWidth - 10, 8, "F")
    pdf.setFontSize(8)
    pdf.setFont("helvetica", "bold")
    pdf.setTextColor(180, 83, 9)
    pdf.text("Pending instructor / AI review (worked solutions)", margin + 8, yPos + 5)
    yPos += 12
  }

  return yPos
}
