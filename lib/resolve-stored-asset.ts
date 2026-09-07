import { head } from "@vercel/blob"
import { getBaseUrl } from "@/lib/get-base-url"

/** Map legacy `/uploads/...` DB paths to Vercel Blob pathname candidates. */
export function blobKeyCandidates(storedPath: string): string[] {
  const normalized = storedPath.startsWith("/") ? storedPath.slice(1) : storedPath
  if (!normalized) return []
  const keys = new Set<string>()
  keys.add(normalized)
  if (normalized.startsWith("uploads/")) {
    keys.add(normalized.slice("uploads/".length))
  } else {
    keys.add(`uploads/${normalized}`)
  }
  return [...keys]
}

export function isRemoteStoredAssetUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim())
}

export function isLegacyUploadPath(url: string): boolean {
  return url.trim().startsWith("/uploads/")
}

/** Git-deployed static assets under public/ (served by Vercel CDN, not Blob). */
export function isGitStaticPublicPath(publicPath: string): boolean {
  const p = publicPath.trim()
  if (!p.startsWith("/") || p.includes("..")) return false
  return p.startsWith("/ece2202/") || p.startsWith("/eleg130x/")
}

async function fetchSameOriginPublicBytes(
  publicPath: string,
  requestOrigin?: string | null,
): Promise<Buffer | null> {
  const path = publicPath.startsWith("/") ? publicPath : `/${publicPath}`
  const origin = getBaseUrl(requestOrigin)
  try {
    const res = await fetch(`${origin}${path}`, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "*/*" },
    })
    if (res.ok) {
      const bytes = Buffer.from(await res.arrayBuffer())
      if (bytes.length) return bytes
    }
  } catch {
    /* ignore */
  }
  return null
}

async function readLocalPublicFile(publicPath: string): Promise<Buffer | null> {
  if (process.env.VERCEL) return null
  try {
    const { readFile } = await import("fs/promises")
    const pathMod = await import("path")
    const rel = publicPath.replace(/^\//, "")
    const full = pathMod.join(process.cwd(), "public", rel)
    const bytes = await readFile(full)
    return bytes.length ? bytes : null
  } catch {
    return null
  }
}

async function resolveBlobUrlForPath(publicPath: string): Promise<string | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (!token) return null

  for (const key of blobKeyCandidates(publicPath)) {
    try {
      const meta = await head(key, { token })
      if (meta?.url) return meta.url
    } catch {
      /* try next candidate */
    }
  }
  return null
}

/** Resolve a stored URL (blob https or legacy `/uploads/...`) to a fetchable https URL. */
export async function resolveStoredAssetUrl(storedUrl: string): Promise<string | null> {
  const trimmed = storedUrl.trim()
  if (!trimmed) return null
  if (isRemoteStoredAssetUrl(trimmed)) return trimmed

  if (trimmed.startsWith("/")) {
    const blobUrl = await resolveBlobUrlForPath(trimmed)
    if (blobUrl) return blobUrl

    if (isGitStaticPublicPath(trimmed) || !process.env.VERCEL) {
      const origin = getBaseUrl()
      return `${origin}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`
    }
  }

  return null
}

/** Load bytes for any stored asset — blob first, local public/ only as dev fallback. */
export async function fetchStoredAssetBytes(
  storedUrl: string,
  requestOrigin?: string | null,
): Promise<Buffer | null> {
  const trimmed = storedUrl.trim()
  if (!trimmed) return null

  const resolved = await resolveStoredAssetUrl(trimmed)
  if (resolved && isRemoteStoredAssetUrl(resolved)) {
    try {
      const res = await fetch(resolved, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "*/*" },
      })
      if (res.ok) {
        const bytes = Buffer.from(await res.arrayBuffer())
        if (bytes.length) return bytes
      }
    } catch {
      /* fall through */
    }
  }

  if (trimmed.startsWith("/")) {
    const local = await readLocalPublicFile(trimmed)
    if (local) return local

    if (isGitStaticPublicPath(trimmed) || !process.env.VERCEL) {
      const sameOrigin = await fetchSameOriginPublicBytes(trimmed, requestOrigin)
      if (sameOrigin) return sameOrigin
    }
  }

  return null
}
