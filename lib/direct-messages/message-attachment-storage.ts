import path from "path"
import { randomUUID } from "crypto"
import { savePublicUpload } from "@/lib/blob-or-local-public"
import { convertHeicBufferToJpeg } from "@/lib/heic-convert-server"
import { heicJpegFileName, isHeicMimeOrName } from "@/lib/heic-image"
import { jpegFileName, replacePathImageExt } from "@/lib/media/compress-image"
import { compressUploadImageBuffer } from "@/lib/media/compress-image-server"
import { inferMessageAttachmentMime, MESSAGE_ATTACHMENT_ALLOWED } from "@/lib/direct-messages/attachments"
import type { MessageActor } from "@/lib/direct-messages/types"
import { registerStagedMessageUpload } from "@/lib/direct-messages/upload-staging"

const MAX_BYTES = 10 * 1024 * 1024

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "attachment"
}

export async function saveMessageAttachmentFile(
  actor: MessageActor,
  file: File,
): Promise<{ fileName: string; fileUrl: string; mimeType: string; fileSize: number }> {
  let mime = inferMessageAttachmentMime(file.name, file.type)
  if (!MESSAGE_ATTACHMENT_ALLOWED.has(mime)) {
    throw new Error("File type not allowed")
  }

  let bytes = Buffer.from(await file.arrayBuffer())
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error("File must be 10MB or smaller")
  }

  let displayName = file.name.trim() || "attachment"

  if (isHeicMimeOrName(mime, file.name)) {
    bytes = await convertHeicBufferToJpeg(bytes)
    mime = "image/jpeg"
    displayName = heicJpegFileName(file.name)
  }

  let ext = path.extname(displayName) || path.extname(file.name) || ""
  if (!ext && mime === "image/jpeg") ext = ".jpg"

  try {
    const compressed = await compressUploadImageBuffer(bytes, mime)
    if (compressed) {
      bytes = compressed.bytes
      mime = compressed.mime
      displayName = jpegFileName(displayName)
      ext = `.${compressed.ext}`
    }
  } catch (err) {
    console.warn("[messages/attachments] compress skipped", err)
  }

  const fname = safeName(`${Date.now()}-${randomUUID().slice(0, 8)}${ext}`)
  let blobKey = `messages/${actor.id}/${fname}`
  let relativePublicPath = `uploads/messages/${actor.id}/${fname}`

  if (mime === "image/jpeg" && !fname.toLowerCase().endsWith(".jpg")) {
    blobKey = replacePathImageExt(blobKey, "jpg")
    relativePublicPath = replacePathImageExt(relativePublicPath, "jpg")
  }

  const fileUrl = await savePublicUpload({
    blobKey,
    relativePublicPath,
    bytes,
    contentType: mime,
  })

  const saved = {
    fileName: displayName,
    fileUrl,
    mimeType: mime,
    fileSize: bytes.byteLength,
  }

  await registerStagedMessageUpload(actor, saved)

  return saved
}
