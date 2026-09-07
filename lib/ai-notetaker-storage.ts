import { del, get, head, put } from "@vercel/blob"
import { existsSync } from "fs"
import { mkdir, readFile, unlink, writeFile } from "fs/promises"
import path from "path"
import { hasBlobToken, useBlobStorage } from "@/lib/blob-or-local-public"

const LOCAL_ROOT = path.join(process.cwd(), "uploads", "private", "ai-notetaker")
/** Blob pathname prefix — not world-linked; playback stays behind authenticated API routes. */
const BLOB_PREFIX = "private/ai-notetaker"

function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || undefined
}

function mimeForExt(ext: string): string {
  const e = ext.replace(/^\./, "").toLowerCase()
  if (e === "m4a" || e === "mp4") return "audio/mp4"
  if (e === "mp3") return "audio/mpeg"
  if (e === "wav") return "audio/wav"
  if (e === "webm") return "audio/webm"
  if (e === "ogg") return "audio/ogg"
  return "application/octet-stream"
}

export function buildAudioStorageKey(studentId: number, noteId: number, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9.]/gi, "").slice(0, 8) || "webm"
  return `${studentId}/${noteId}.${safeExt}`
}

/** @deprecated Local dev only — production uses Vercel Blob private paths. */
export function absolutePathForStorageKey(key: string): string {
  return path.join(LOCAL_ROOT, key.replace(/^\/+/, ""))
}

function blobPathnameForKey(key: string): string {
  const trimmed = key.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed
  const normalized = trimmed.replace(/^\/+/, "")
  if (normalized.startsWith(`${BLOB_PREFIX}/`)) return normalized
  return `${BLOB_PREFIX}/${normalized}`
}

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const arrayBuffer = await new Response(stream).arrayBuffer()
  return Buffer.from(arrayBuffer)
}

async function readFromBlob(key: string): Promise<Buffer | null> {
  const token = blobToken()
  if (!token) return null
  const target = blobPathnameForKey(key)

  if (target.startsWith("http://") || target.startsWith("https://")) {
    try {
      const res = await fetch(target, { cache: "no-store" })
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer())
        return buf.length ? buf : null
      }
    } catch {
      /* fall through */
    }
  }

  try {
    const meta = await head(target, { token })
    if (meta?.url) {
      const res = await fetch(meta.url, { cache: "no-store" })
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer())
        return buf.length ? buf : null
      }
    }
  } catch {
    /* fall through */
  }

  try {
    const result = await get(target, {
      access: "public",
      token,
      useCache: false,
    })
    if (!result?.stream) return null
    const buf = await streamToBuffer(result.stream)
    return buf.length ? buf : null
  } catch {
    return null
  }
}

async function readFromLocal(key: string): Promise<Buffer | null> {
  const full = absolutePathForStorageKey(key)
  if (!existsSync(full)) return null
  const buf = await readFile(full)
  return buf.length ? buf : null
}

export async function saveNotetakerAudioBuffer(
  studentId: number,
  noteId: number,
  buffer: Buffer,
  ext: string,
): Promise<string> {
  const key = buildAudioStorageKey(studentId, noteId, ext)

  if (useBlobStorage()) {
    const token = blobToken()
    if (!token) {
      throw new Error(
        "BLOB_READ_WRITE_TOKEN is required for AI Notetaker uploads in production.",
      )
    }
    await put(blobPathnameForKey(key), buffer, {
      access: "public",
      contentType: mimeForExt(ext),
      addRandomSuffix: false,
      allowOverwrite: true,
      token,
    })
    return key
  }

  const full = absolutePathForStorageKey(key)
  await mkdir(path.dirname(full), { recursive: true })
  await writeFile(full, buffer)
  return key
}

export async function readNotetakerAudioIfExists(key: string): Promise<Buffer | null> {
  if (!key?.trim()) return null

  if (useBlobStorage()) {
    const fromBlob = await readFromBlob(key)
    if (fromBlob) return fromBlob
  }

  return readFromLocal(key)
}

export async function deleteNotetakerAudioIfExists(key: string | null): Promise<void> {
  if (!key) return

  if (useBlobStorage()) {
    const token = blobToken()
    if (token) {
      try {
        await del(blobPathnameForKey(key), { token })
      } catch {
        /* ignore missing blob */
      }
    }
  }

  const full = absolutePathForStorageKey(key)
  if (existsSync(full)) {
    try {
      await unlink(full)
    } catch {
      /* ignore */
    }
  }
}

/** Whether production blob storage is configured (for diagnostics). */
export function notetakerUsesBlobStorage(): boolean {
  return hasBlobToken()
}
