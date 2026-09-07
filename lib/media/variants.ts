export const MEDIA_VARIANT_WIDTH = {
  thumb: 64,
  small: 160,
  medium: 480,
  full: 1200,
} as const

export type MediaVariant = keyof typeof MEDIA_VARIANT_WIDTH

const ALLOWED_HOSTS = new Set([
  "course-collab.com",
  "www.course-collab.com",
])

export function isVariantSafeSrc(src: string): boolean {
  if (!src) return false
  if (src.startsWith("/") && !src.startsWith("//")) return true
  try {
    const url = new URL(src)
    if (url.protocol !== "https:" && url.protocol !== "http:") return false
    if (ALLOWED_HOSTS.has(url.hostname)) return true
    return url.hostname.endsWith(".public.blob.vercel-storage.com")
  } catch {
    return false
  }
}

/** Display URL for thumbnails. Uses the variant API only for allowlisted hosts. */
export function sizedMediaUrl(src: string | null | undefined, variant: MediaVariant = "thumb"): string {
  if (!src) return ""
  if (src.startsWith("data:") || src.startsWith("blob:")) return src
  if (!isVariantSafeSrc(src)) return src
  const w = MEDIA_VARIANT_WIDTH[variant]
  return `/api/media/variant?w=${w}&src=${encodeURIComponent(src)}`
}
