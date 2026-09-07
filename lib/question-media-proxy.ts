/** Allowed question diagram sources for same-origin proxy (campus networks often block Blob CDN). */
export function normalizeQuestionMediaPath(url: string): string {
  const trimmed = (url || "").trim()
  if (!trimmed) return ""
  if (trimmed.startsWith("/public/")) {
    return trimmed.replace(/^\/public/, "") || trimmed
  }
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const parsed = new URL(trimmed)
      const path = `${parsed.pathname}${parsed.search}`
      if (path.startsWith("/uploads/") || path.startsWith("/ece2202/")) {
        return path
      }
    }
  } catch {
    /* keep original */
  }
  return trimmed
}

export function isAllowedQuestionMediaUrl(url: string): boolean {
  const normalized = normalizeQuestionMediaPath(url)
  if (!normalized) return false
  // Same-origin static figures (textbook extracts, classroom handouts, uploads)
  if (normalized.startsWith("/uploads/")) return true
  if (normalized.startsWith("/ece2202/")) return true
  // Vercel Blob public URLs (campus networks often block direct CDN access)
  if (/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(normalized)) {
    return true
  }
  return false
}

/** Millisecond timestamp embedded in upload filenames (`{ts}_name.png`). */
export function questionMediaCacheToken(url: string | null | undefined): string | undefined {
  const trimmed = (url || "").trim()
  if (!trimmed) return undefined
  const match = trimmed.match(/\/(\d{13})_[^/?#]+/)
  return match?.[1]
}

/**
 * Browser-safe URL for question diagrams — serves Blob / uploads via same-origin proxy.
 * Relative `/uploads/...` paths are proxied too so production always hits a live asset.
 */
export function questionMediaDisplayUrl(
  url: string | null | undefined,
  version?: string | number,
): string {
  const trimmed = normalizeQuestionMediaPath((url || "").trim())
  if (!trimmed) return ""
  if (isAllowedQuestionMediaUrl(trimmed)) {
    const base = `/api/question-media?url=${encodeURIComponent(trimmed)}`
    const v = version ?? questionMediaCacheToken(trimmed)
    return v != null && String(v) !== "" ? `${base}&v=${encodeURIComponent(String(v))}` : base
  }
  return trimmed
}
