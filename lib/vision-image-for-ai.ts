/**
 * Resolve student / question images for OpenAI vision (requires data URLs or public HTTPS).
 * Local `/uploads/...` paths are read from disk; remote URLs are fetched server-side.
 */

import { fetchStoredAssetBytes, resolveStoredAssetUrl } from "@/lib/resolve-stored-asset"
import { getBaseUrl } from "@/lib/get-base-url"
import { isHeicMimeOrName } from "@/lib/heic-image"
import {
  isImageMimeOrName,
  isPdfMimeOrName,
  resolvePdfVisionDataUrls,
} from "@/lib/pdf-vision-renderer"

export { isImageMimeOrName, isPdfMimeOrName } from "@/lib/pdf-vision-renderer"

function appOrigin(): string {
  return getBaseUrl()
}

export function toAbsoluteAssetUrl(url: string): string {
  const trimmed = (url || "").trim()
  if (!trimmed) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith("data:")) return trimmed
  const origin = appOrigin()
  return new URL(trimmed.startsWith("/") ? trimmed : `/${trimmed}`, origin).href
}

function mimeFromPath(p: string): string {
  const lower = p.toLowerCase()
  if (lower.endsWith(".heic")) return "image/heic"
  if (lower.endsWith(".heif")) return "image/heif"
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".gif")) return "image/gif"
  return "image/jpeg"
}

async function toVisionDataUrl(buf: Buffer, mime: string, sourceLabel: string): Promise<string | null> {
  let out = buf
  let outMime = mime
  if (isHeicMimeOrName(mime, sourceLabel)) {
    try {
      const { convertHeicBufferToJpeg } = await import("@/lib/heic-convert-server")
      out = await convertHeicBufferToJpeg(buf)
      outMime = "image/jpeg"
    } catch (e) {
      console.error("[vision-image-for-ai] HEIC convert failed:", sourceLabel, e)
      return null
    }
  }
  if (!outMime.startsWith("image/")) return null
  return `data:${outMime};base64,${out.toString("base64")}`
}

/** Returns data URLs suitable for OpenAI `input_image`, or empty if unreadable. */
export async function resolveVisionAssetDataUrls(
  url: string,
  opts?: { mime?: string; name?: string; maxPdfPages?: number },
): Promise<string[]> {
  const mime = opts?.mime ?? ""
  const name = opts?.name ?? ""
  if (isPdfMimeOrName(mime, name)) {
    return resolvePdfVisionDataUrls(url, opts?.maxPdfPages)
  }
  const single = await resolveVisionImageDataUrl(url)
  return single ? [single] : []
}

/** Returns a data URL suitable for OpenAI `input_image`, or null if unreadable. */
export async function resolveVisionImageDataUrl(url: string): Promise<string | null> {
  const trimmed = (url || "").trim()
  if (!trimmed) return null
  if (trimmed.startsWith("data:image")) return trimmed

  try {
    const resolved = (await resolveStoredAssetUrl(trimmed)) ?? toAbsoluteAssetUrl(trimmed)
    const buf =
      (await fetchStoredAssetBytes(trimmed)) ??
      (await (async () => {
        const res = await fetch(resolved, { signal: AbortSignal.timeout(30000) })
        if (!res.ok) return null
        return Buffer.from(await res.arrayBuffer())
      })())
    if (!buf?.length) return null
    const mime = mimeFromPath(trimmed)
    return toVisionDataUrl(buf, mime, trimmed)
  } catch {
    return null
  }
}
