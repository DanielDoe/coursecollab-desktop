/**
 * Server-side PDF → PNG data URLs for OpenAI vision grading.
 */

import { createRequire } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { getBaseUrl } from "@/lib/get-base-url"

const MAX_PDF_PAGES_DEFAULT = 6
const PDF_RENDER_SCALE = 1.75

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

function pdfjsAssetDir(...parts: string[]): string {
  const dir = path.join(getPdfjsRoot(), ...parts)
  return dir.endsWith(path.sep) ? dir : `${dir}${path.sep}`
}

/** pdf.js on Node needs file:// URLs; bare relative paths fail to load CMaps/fonts. */
function pdfjsNodeAssetBaseUrl(...parts: string[]): string {
  const dir = path.join(getPdfjsRoot(), ...parts)
  return pathToFileURL(dir.endsWith(path.sep) ? dir : `${dir}${path.sep}`).href
}

function appOrigin(): string {
  return getBaseUrl()
}

function toAbsoluteAssetUrl(url: string): string {
  const trimmed = (url || "").trim()
  if (!trimmed) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith("data:")) return trimmed
  const origin = appOrigin()
  return new URL(trimmed.startsWith("/") ? trimmed : `/${trimmed}`, origin).href
}

let pdfjsInit: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null

async function loadPdfJs() {
  if (!pdfjsInit) {
    pdfjsInit = import("pdfjs-dist/legacy/build/pdf.mjs")
  }
  return pdfjsInit
}

export function isPdfMimeOrName(mime: string, name: string): boolean {
  const m = (mime || "").toLowerCase()
  if (m.includes("pdf")) return true
  return (name || "").toLowerCase().endsWith(".pdf")
}

export function isImageMimeOrName(mime: string, name: string): boolean {
  const m = (mime || "").toLowerCase()
  if (m.startsWith("image/")) return true
  return /\.(png|jpe?g|gif|webp|bmp|heic|heif|svg)$/i.test(name || "")
}

async function loadPdfBytes(url: string): Promise<Buffer | null> {
  const trimmed = (url || "").trim()
  if (!trimmed) return null

  try {
    const absolute = trimmed.startsWith("http") ? trimmed : toAbsoluteAssetUrl(trimmed)
    const res = await fetch(absolute, { signal: AbortSignal.timeout(45000) })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

/** Rasterize up to `maxPages` of a PDF buffer into PNG data URLs for vision models. */
export async function renderPdfBufferToVisionDataUrls(
  buffer: Buffer,
  maxPages = MAX_PDF_PAGES_DEFAULT,
): Promise<string[]> {
  const pdfjs = await loadPdfJs()
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: pdfjsNodeAssetBaseUrl("standard_fonts"),
    cMapUrl: pdfjsNodeAssetBaseUrl("cmaps"),
    cMapPacked: true,
    isEvalSupported: false,
  }).promise

  const pageCount = Math.min(doc.numPages, Math.max(1, maxPages))
  const out: string[] = []

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await doc.getPage(pageNum)
    const viewport = page.getViewport({ scale: PDF_RENDER_SCALE })
    const width = Math.ceil(viewport.width)
    const height = Math.ceil(viewport.height)
    if (width < 1 || height > 12000 || height < 1) continue

    const { canvas } = doc.canvasFactory.create(width, height)
    await page.render({ canvas, viewport }).promise

    const png =
      typeof canvas.toBuffer === "function"
        ? canvas.toBuffer("image/png")
        : Buffer.from((canvas as HTMLCanvasElement).toDataURL("image/png").split(",")[1]!, "base64")
    out.push(`data:image/png;base64,${png.toString("base64")}`)
  }

  await doc.destroy()
  return out
}

/** Fetch a PDF by URL and render pages for vision grading. */
export async function resolvePdfVisionDataUrls(
  url: string,
  maxPages = MAX_PDF_PAGES_DEFAULT,
): Promise<string[]> {
  const buf = await loadPdfBytes(url)
  if (!buf || buf.length === 0) return []
  try {
    return await renderPdfBufferToVisionDataUrls(buf, maxPages)
  } catch (e) {
    console.error("[pdf-vision-renderer] Failed to render PDF:", url, e)
    return []
  }
}
