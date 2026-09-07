import { fetchPublicAssetBytes } from "@/lib/public-asset-bytes"

export type LoadedImage = {
  dataUrl: string
  format: "PNG" | "JPEG"
  widthPx: number
  heightPx: number
}

function readPngSize(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24 || buf[0] !== 0x89) return null
  if (buf.subarray(1, 4).toString("ascii") !== "PNG") return null
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}

function readJpegSize(buf: Buffer): { w: number; h: number } | null {
  let i = 0
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) {
      i++
      continue
    }
    const marker = buf[i + 1]
    if (marker === 0xc0 || marker === 0xc2) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
    }
    if (marker === 0xd8 || marker === 0xd9 || marker === 0xda) {
      i += 2
      continue
    }
    const len = buf.readUInt16BE(i + 2)
    i += 2 + len
  }
  return null
}

export function fitImageToBoxMm(
  widthPx: number,
  heightPx: number,
  maxWidthMm: number,
  maxHeightMm: number,
): { widthMm: number; heightMm: number } {
  if (widthPx <= 0 || heightPx <= 0) {
    return { widthMm: maxWidthMm, heightMm: maxHeightMm * 0.35 }
  }
  const ratio = widthPx / heightPx
  let w = maxWidthMm
  let h = maxWidthMm / ratio
  if (h > maxHeightMm) {
    h = maxHeightMm
    w = maxHeightMm * ratio
  }
  return { widthMm: w, heightMm: h }
}

/** Prefer a cream-flattened JPEG sibling for PDF (jsPDF renders PNG alpha as black). */
export function pdfFlattenedImagePath(publicPath: string): string | null {
  const p = publicPath.trim()
  if (!p.startsWith("/")) return null
  if (/\.(png|webp)$/i.test(p)) return p.replace(/\.(png|webp)$/i, "-pdf.jpg")
  return null
}

/** Resolve `/uploads/...` (or other public paths) via static asset URL — avoids tracing public/ into lambdas. */
export async function loadPublicImageDataUrl(publicPath: string | null | undefined): Promise<LoadedImage | null> {
  const p = publicPath?.trim()
  if (!p?.startsWith("/")) return null

  const buf = await fetchPublicAssetBytes(p)
  if (!buf?.length) return null

  const lower = p.toLowerCase()
  let format: LoadedImage["format"] = "PNG"
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) format = "JPEG"
  else if (!lower.endsWith(".png")) format = "JPEG"
  if (isWebpBuffer(buf)) return null

  let dims = readPngSize(buf)
  if (!dims) dims = readJpegSize(buf)
  const widthPx = dims?.w ?? 800
  const heightPx = dims?.h ?? 200

  const mime = format === "PNG" ? "image/png" : "image/jpeg"
  const dataUrl = `data:${mime};base64,${buf.toString("base64")}`
  return { dataUrl, format, widthPx, heightPx }
}

const MAX_LETTERHEAD_IMAGE_BYTES = 6 * 1024 * 1024

function isWebpBuffer(buf: Buffer): boolean {
  return (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  )
}

function detectImageFormatFromBytes(buf: Buffer): LoadedImage["format"] | null {
  if (isWebpBuffer(buf)) return null
  if (buf.length >= 4 && buf[0] === 0x89 && buf.subarray(1, 4).toString("ascii") === "PNG") return "PNG"
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8) return "JPEG"
  return null
}

function bufferToLoadedImage(buf: Buffer): LoadedImage | null {
  const format = detectImageFormatFromBytes(buf)
  if (!format) return null
  let dims = readPngSize(buf)
  if (!dims) dims = readJpegSize(buf)
  const widthPx = dims?.w ?? 800
  const heightPx = dims?.h ?? 200
  const mime = format === "PNG" ? "image/png" : "image/jpeg"
  const dataUrl = `data:${mime};base64,${buf.toString("base64")}`
  return { dataUrl, format, widthPx, heightPx }
}

/** Block obvious SSRF targets for instructor-controlled remote logo/signature URLs. */
function isBlockedLetterheadImageHost(hostname: string): boolean {
  const h = hostname.toLowerCase().trim()
  if (!h) return true
  if (h === "localhost" || h.endsWith(".localhost")) return true
  if (h === "0.0.0.0" || h === "[::1]") return true
  if (h === "metadata.google.internal" || h.includes("metadata.google")) return true
  if (h === "169.254.169.254") return true
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    if (a === 10) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 0) return true
  }
  return false
}

async function loadRemoteLetterheadImageDataUrl(rawUrl: string): Promise<LoadedImage | null> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return null
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
  if (isBlockedLetterheadImageHost(parsed.hostname)) return null

  const res = await fetch(parsed.toString(), {
    method: "GET",
    cache: "no-store",
    redirect: "follow",
    headers: { Accept: "image/png,image/jpeg,*/*" },
  })
  if (!res.ok) return null

  let finalUrl: URL
  try {
    finalUrl = new URL(res.url)
  } catch {
    return null
  }
  if (finalUrl.protocol !== "http:" && finalUrl.protocol !== "https:") return null
  if (isBlockedLetterheadImageHost(finalUrl.hostname)) return null

  const ab = await res.arrayBuffer()
  if (ab.byteLength === 0 || ab.byteLength > MAX_LETTERHEAD_IMAGE_BYTES) return null
  const buf = Buffer.from(ab)

  if (!detectImageFormatFromBytes(buf)) return null

  return bufferToLoadedImage(buf)
}

/**
 * Load logo/signature for PDF generation: local `/…` paths under `public/`, or remote `http(s)` URLs.
 * Always re-reads from disk / network so finalized letters pick up template and asset changes on each download.
 */
export async function loadLetterheadImageDataUrl(url: string | null | undefined): Promise<LoadedImage | null> {
  const p = url?.trim()
  if (!p) return null
  if (p.startsWith("/")) return loadPublicImageDataUrl(p)
  if (/^https?:\/\//i.test(p)) return loadRemoteLetterheadImageDataUrl(p)
  return null
}
