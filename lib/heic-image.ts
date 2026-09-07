import { mediaDisplayUrl } from "@/lib/media/display-url"

const HEIC_MIMES = new Set(["image/heic", "image/heif"])

export function isHeicMimeOrName(mime?: string | null, name?: string | null): boolean {
  const m = (mime || "").toLowerCase().split(";")[0]?.trim()
  if (HEIC_MIMES.has(m)) return true
  return /\.heic$|\.heif$/i.test(name || "")
}

export function heicJpegFileName(originalName: string): string {
  const base = (originalName || "photo")
    .replace(/\.(heic|heif)$/i, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 60)
  return `${base || "photo"}.jpg`
}

/** Browser-safe image URL (HEIC is proxied; others use a sized variant, not full-res). */
export function solutionImageDisplayUrl(
  url: string,
  mime?: string | null,
  name?: string | null,
): string {
  if (!url) return url
  if (isHeicMimeOrName(mime, name) || isHeicMimeOrName(null, url)) {
    return `/api/solution-image?url=${encodeURIComponent(url)}`
  }
  return mediaDisplayUrl(url, "medium")
}
