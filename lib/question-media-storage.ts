import { inferQuestionMediaType } from "@/lib/question-media"
import { savePublicUpload } from "@/lib/blob-or-local-public"
import { heicJpegFileName, isHeicMimeOrName } from "@/lib/heic-image"
import { convertHeicBufferToJpeg } from "@/lib/heic-convert-server"

const MAX_BYTES = 12 * 1024 * 1024

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
  "image/heic",
  "image/heif",
])

const EXT_FROM_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
}

export function validateQuestionMediaUpload(file: File): string | null {
  if (!file || file.size <= 0) return "file required"
  if (file.size > MAX_BYTES) return "File must be 12 MB or smaller"
  const mime = (file.type || "").toLowerCase()
  if (!ALLOWED_MIME.has(mime) && !isHeicMimeOrName(mime, file.name)) {
    return "Allowed types: PNG, JPEG, WebP, GIF, SVG, PDF, HEIC"
  }
  return null
}

function safeFileName(originalName: string, ext: string): string {
  const rawBase = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "upload"
  const safeBase = rawBase.replace(/\.(png|jpe?g|webp|gif|svg|pdf)$/i, "")
  return `${Date.now()}_${safeBase}.${ext}`
}

async function persistQuestionMedia(
  instructorId: number,
  fname: string,
  bytes: Buffer,
  mime: string,
): Promise<{ url: string; media_type: ReturnType<typeof inferQuestionMediaType> }> {
  const relativePath = `uploads/question-media/${instructorId}/${fname}`
  const url = await savePublicUpload({
    blobKey: `question-media/${instructorId}/${fname}`,
    relativePublicPath: relativePath,
    bytes,
    contentType: mime || undefined,
  })
  return { url, media_type: inferQuestionMediaType(url, mime) }
}

/** Persist diagram media to Vercel Blob; DB stores the returned https URL. */
export async function saveQuestionMediaFile(
  instructorId: number,
  file: File,
): Promise<{ url: string; media_type: ReturnType<typeof inferQuestionMediaType> }> {
  const validationError = validateQuestionMediaUpload(file)
  if (validationError) throw new Error(validationError)

  let mime = (file.type || "").toLowerCase()
  let bytes = Buffer.from(await file.arrayBuffer())
  let originalName = file.name
  if (isHeicMimeOrName(mime, file.name)) {
    bytes = await convertHeicBufferToJpeg(bytes)
    mime = "image/jpeg"
    originalName = heicJpegFileName(file.name)
  }
  const ext = EXT_FROM_MIME[mime] || "bin"
  const fname = safeFileName(originalName, ext)
  return persistQuestionMedia(instructorId, fname, bytes, mime)
}

/** Persist raw image bytes (e.g. client-side crop) with the same storage rules as uploads. */
export async function saveQuestionMediaBytes(
  instructorId: number,
  bytes: Buffer,
  mime: string,
  originalName = "cropped-diagram",
): Promise<{ url: string; media_type: ReturnType<typeof inferQuestionMediaType> }> {
  const normalizedMime = (mime || "").toLowerCase()
  if (!ALLOWED_MIME.has(normalizedMime) || normalizedMime === "application/pdf") {
    throw new Error("Crop supports PNG, JPEG, WebP, and GIF only")
  }
  if (bytes.length <= 0) throw new Error("empty image")
  if (bytes.length > MAX_BYTES) throw new Error("File must be 12 MB or smaller")

  const ext = EXT_FROM_MIME[normalizedMime] || "png"
  const fname = safeFileName(originalName, ext)
  return persistQuestionMedia(instructorId, fname, bytes, normalizedMime)
}
