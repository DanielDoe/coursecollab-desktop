/**
 * Server-side résumé text extraction:
 * - PDF via pdfjs-dist (selectable text), with vision fallback for scanned PDFs
 * - DOCX via jszip (word/document.xml)
 * - Images via OpenAI vision transcription
 * - Plain text passthrough
 * Mirrors the pdfjs loading approach in lib/pdf-vision-renderer.ts.
 */

import { createRequire } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"
import OpenAI from "openai"
import JSZip from "jszip"
import { renderPdfBufferToVisionDataUrls } from "@/lib/pdf-vision-renderer"
import { resolveCoraDeployment } from "@/lib/cora/models/registry"

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null

const MAX_PDF_PAGES = 20

let pdfjsRootCache: string | null = null

function getPdfjsRoot(): string {
  if (pdfjsRootCache) return pdfjsRootCache
  try {
    const resolved = createRequire(import.meta.url).resolve("pdfjs-dist/package.json")
    if (typeof resolved === "string" && resolved.length > 0) {
      pdfjsRootCache = path.dirname(resolved)
      return pdfjsRootCache
    }
  } catch {
    /* webpack may not resolve package paths during build analysis */
  }
  pdfjsRootCache = path.join(process.cwd(), "node_modules/pdfjs-dist")
  return pdfjsRootCache
}

/** pdf.js on Node needs file:// URLs; bare relative paths fail to load CMaps/fonts. */
function pdfjsNodeAssetBaseUrl(...parts: string[]): string {
  const dir = path.join(getPdfjsRoot(), ...parts)
  return pathToFileURL(dir.endsWith(path.sep) ? dir : `${dir}${path.sep}`).href
}

let pdfjsInit: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null

async function loadPdfJs() {
  if (!pdfjsInit) {
    pdfjsInit = import("pdfjs-dist/legacy/build/pdf.mjs")
  }
  return pdfjsInit
}

type PdfTextItem = { str: string; transform: number[]; hasEOL?: boolean }

/** Extract selectable text from a PDF buffer, preserving line breaks by y-coordinate. */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjs = await loadPdfJs()
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: pdfjsNodeAssetBaseUrl("standard_fonts"),
    cMapUrl: pdfjsNodeAssetBaseUrl("cmaps"),
    cMapPacked: true,
    isEvalSupported: false,
  }).promise

  try {
    const pageCount = Math.min(doc.numPages, MAX_PDF_PAGES)
    const pages: string[] = []

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await doc.getPage(pageNum)
      const content = await page.getTextContent()
      const items = content.items as PdfTextItem[]

      const lines: string[] = []
      let currentLine: string[] = []
      let lastY: number | null = null

      for (const item of items) {
        const str = item.str ?? ""
        const y = Array.isArray(item.transform) ? item.transform[5] : null
        // New line when the baseline moves by more than ~2 units.
        const isNewLine = lastY != null && y != null && Math.abs(y - lastY) > 2
        if (isNewLine && currentLine.length > 0) {
          lines.push(currentLine.join(""))
          currentLine = []
        }
        if (str) currentLine.push(str)
        if (item.hasEOL && currentLine.length > 0) {
          lines.push(currentLine.join(""))
          currentLine = []
          lastY = null
          continue
        }
        if (y != null) lastY = y
      }
      if (currentLine.length > 0) lines.push(currentLine.join(""))

      const pageText = lines
        .map((l) => l.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join("\n")
      if (pageText) pages.push(pageText)
    }

    return pages.join("\n\n").trim()
  } finally {
    await doc.destroy()
  }
}

/** Extract paragraph text from a DOCX buffer by parsing word/document.xml. */
export async function extractDocxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  const docFile = zip.file("word/document.xml")
  if (!docFile) return ""
  const xml = await docFile.async("string")
  return xml
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

const VISION_TRANSCRIBE_PROMPT =
  "Transcribe every piece of text in this résumé image exactly as written, preserving section headings, bullet points, and line breaks. Output plain text only — no commentary, no markdown fences."

/** Transcribe résumé images (or rendered PDF pages) to plain text with OpenAI vision. */
async function transcribeImagesWithVision(dataUrls: string[]): Promise<string> {
  if (!openai || dataUrls.length === 0) return ""
  const model = resolveCoraDeployment("vision").model
  const response = await openai.chat.completions.create({
    model,
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: VISION_TRANSCRIBE_PROMPT },
          ...dataUrls.map((url) => ({ type: "image_url" as const, image_url: { url, detail: "high" as const } })),
        ],
      },
    ],
  })
  try {
    const { recordModelCall } = await import("@/lib/cora/ai")
    await recordModelCall({
      context: {
        actor: { userId: 0, userRole: "guest" },
        feature: "DOCUMENT_ANALYSIS",
        module: "career-resume-vision",
        billable: false,
      },
      model,
      rawResponse: response,
    })
  } catch {
    /* accounting must not block extract */
  }
  return (response.choices[0]?.message?.content ?? "").trim()
}

function bufferToDataUrl(buffer: Buffer, mime: string): string {
  return `data:${mime || "image/png"};base64,${buffer.toString("base64")}`
}

function isPdf(mime: string, fileName: string): boolean {
  return (mime || "").toLowerCase().includes("pdf") || /\.pdf$/i.test(fileName || "")
}

function isPlainText(mime: string, fileName: string): boolean {
  return (mime || "").toLowerCase().startsWith("text/") || /\.txt$/i.test(fileName || "")
}

function isDocx(mime: string, fileName: string): boolean {
  const m = (mime || "").toLowerCase()
  return m.includes("wordprocessingml") || m.includes("officedocument.word") || /\.docx$/i.test(fileName || "")
}

function isImage(mime: string, fileName: string): boolean {
  return (mime || "").toLowerCase().startsWith("image/") || /\.(png|jpe?g|webp|gif|heic|heif|bmp)$/i.test(fileName || "")
}

/** A page of extracted text this short usually means a scanned/image-only PDF. */
const MIN_MEANINGFUL_TEXT_CHARS = 120

/**
 * Route a résumé file to the right text extractor.
 * Returns "" only when every strategy fails — callers can still store the raw
 * file and let the user paste text as an optional supplement.
 */
export async function extractResumeText(args: {
  buffer: Buffer
  mime: string
  fileName: string
}): Promise<string> {
  const { buffer, mime, fileName } = args
  if (buffer.length === 0) return ""

  if (isPdf(mime, fileName)) {
    let text = ""
    try {
      text = await extractPdfText(buffer)
    } catch (e) {
      console.error("[extract-resume-text] PDF extraction failed:", fileName, e)
    }
    if (text.length >= MIN_MEANINGFUL_TEXT_CHARS) return text
    // Scanned/image-only PDF — rasterize pages and transcribe with vision.
    try {
      const pages = await renderPdfBufferToVisionDataUrls(buffer, 6)
      const visionText = await transcribeImagesWithVision(pages)
      if (visionText.length > text.length) return visionText
    } catch (e) {
      console.error("[extract-resume-text] PDF vision fallback failed:", fileName, e)
    }
    return text
  }

  if (isDocx(mime, fileName)) {
    try {
      return await extractDocxText(buffer)
    } catch (e) {
      console.error("[extract-resume-text] DOCX extraction failed:", fileName, e)
      return ""
    }
  }

  if (isImage(mime, fileName)) {
    try {
      return await transcribeImagesWithVision([bufferToDataUrl(buffer, mime)])
    } catch (e) {
      console.error("[extract-resume-text] image transcription failed:", fileName, e)
      return ""
    }
  }

  if (isPlainText(mime, fileName)) {
    return buffer.toString("utf8").trim()
  }
  return ""
}
