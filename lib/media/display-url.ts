export type MediaDisplaySize = "thumbnail" | "small" | "medium" | "full"

const WIDTH: Record<MediaDisplaySize, number | null> = {
  thumbnail: 64,
  small: 160,
  medium: 640,
  full: null,
}

const BLOB_HOST = /\.blob\.vercel-storage\.com$/i
const NEXT_IMAGE = /[?&]w=\d+/i

/** Serve the smallest suitable variant. Originals stay available via size "full". */
export function mediaDisplayUrl(url: string | null | undefined, size: MediaDisplaySize = "medium"): string {
  if (!url) return ""
  if (size === "full" || NEXT_IMAGE.test(url) || url.startsWith("data:") || url.startsWith("blob:")) {
    return url
  }
  try {
    const parsed = new URL(url, "https://course-collab.com")
    const width = WIDTH[size]
    if (!width) return url
    if (BLOB_HOST.test(parsed.hostname) || parsed.pathname.startsWith("/_next/image")) {
      parsed.searchParams.set("w", String(width))
      parsed.searchParams.set("q", "75")
      return parsed.toString()
    }
    if (url.startsWith("/") || parsed.hostname.endsWith("course-collab.com")) {
      return `/api/media/variant?w=${width}&src=${encodeURIComponent(url)}`
    }
    return url
  } catch {
    return url
  }
}
