import path from "path"
import { isInvalidPersistedAttachmentUrl } from "@/lib/announcement-attachments"

const EXT_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".zip": "application/zip",
}

export const MESSAGE_ATTACHMENT_ALLOWED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
])

export function inferMessageAttachmentMime(fileName: string, declaredType?: string | null): string {
  const trimmed = declaredType?.trim()
  if (trimmed && trimmed !== "application/octet-stream" && MESSAGE_ATTACHMENT_ALLOWED.has(trimmed)) {
    return trimmed
  }
  const ext = path.extname(fileName).toLowerCase()
  const fromExt = EXT_TO_MIME[ext]
  if (fromExt) return fromExt
  return trimmed || "application/octet-stream"
}

export function isMessageImageAttachment(mimeType: string | null | undefined, fileName: string): boolean {
  if (mimeType?.startsWith("image/")) return true
  return /\.(png|jpe?g|gif|webp|heic|heif)$/i.test(fileName)
}

export function isPersistedMessageAttachmentUrl(url: string | null | undefined): boolean {
  if (isInvalidPersistedAttachmentUrl(url)) return false
  if (!url?.trim()) return false
  return url.startsWith("https://") || url.startsWith("http://")
}

export function validateMessageAttachmentInput(att: {
  fileName?: string
  fileUrl?: string
}): string | null {
  if (!att.fileName?.trim()) return "Attachment is missing a file name"
  if (!isPersistedMessageAttachmentUrl(att.fileUrl)) {
    return "One or more attachments did not upload. Remove them and attach again."
  }
  return null
}

export type MessageAttachmentRow = {
  id: number | string
  message_id: number | string
  file_name: string
  file_url: string
  mime_type: string | null
  file_size: number | string | null
}

export type GroupedMessageAttachment = {
  id: number
  fileName: string
  fileUrl: string
  mimeType: string | null
  fileSize: number | null
}

/**
 * Group SQL attachment rows by message id.
 * Neon/pg often returns BIGSERIAL ids as strings — Map keys must be numeric
 * so later `.get(Number(message.id))` finds the attachments.
 */
export function groupAttachmentsByMessageId(
  rows: MessageAttachmentRow[],
): Map<number, GroupedMessageAttachment[]> {
  const map = new Map<number, GroupedMessageAttachment[]>()
  for (const row of rows) {
    const messageId = Number(row.message_id)
    const id = Number(row.id)
    if (!Number.isFinite(messageId) || messageId <= 0) continue
    if (!Number.isFinite(id) || id <= 0) continue
    const fileUrl = String(row.file_url ?? "").trim()
    if (!fileUrl) continue
    const list = map.get(messageId) ?? []
    list.push({
      id,
      fileName: String(row.file_name ?? "").trim() || "Attachment",
      fileUrl,
      mimeType: row.mime_type != null ? String(row.mime_type) : null,
      fileSize: row.file_size != null && Number.isFinite(Number(row.file_size)) ? Number(row.file_size) : null,
    })
    map.set(messageId, list)
  }
  return map
}

export function messageHasVisibleBody(body: string): boolean {
  return Boolean(body.trim())
}

export type MessageAttachmentUploadState = "uploading" | "ready" | "error"

export type MessageAttachmentDraft = {
  fileName: string
  fileUrl: string
  mimeType: string | null
  fileSize: number | null
  uploadState?: MessageAttachmentUploadState
  /** Stable id for in-flight uploads before fileUrl exists */
  localKey?: string
}
