import { compressUploadImageFile } from "@/lib/media/compress-image-client"
import { isHeicMimeOrName } from "@/lib/heic-image"
import { messageApiFetch } from "@/lib/direct-messages/client"
import {
  inferMessageAttachmentMime,
  isPersistedMessageAttachmentUrl,
  type MessageAttachmentDraft,
} from "@/lib/direct-messages/attachments"
import { stripHtmlToPlain } from "@/lib/direct-messages/html"

function isLikelyImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true
  return /\.(png|jpe?g|gif|webp|heic|heif|bmp)$/i.test(file.name)
}

/** Resize JPEG/PNG/WebP in the browser; HEIC is converted on the server. */
export async function prepareMessageAttachmentFile(file: File): Promise<File> {
  if (isHeicMimeOrName(file.type, file.name)) return file
  if (!isLikelyImageFile(file)) return file
  let work = file
  if (!work.type?.trim()) {
    const inferred = inferMessageAttachmentMime(work.name, null)
    if (inferred.startsWith("image/") && inferred !== "image/heic" && inferred !== "image/heif") {
      work = new File([work], work.name, { type: inferred })
    }
  }
  return compressUploadImageFile(work)
}

type UploadJson = MessageAttachmentDraft & { error?: string }

export async function uploadMessageAttachment(file: File): Promise<MessageAttachmentDraft> {
  const prepared = await prepareMessageAttachmentFile(file)
  const form = new FormData()
  form.append("file", prepared, prepared.name || file.name)

  let lastError = "Upload failed"
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await messageApiFetch("/api/messages/attachments", {
      method: "POST",
      body: form,
    })
    let data: UploadJson
    try {
      data = (await res.json()) as UploadJson
    } catch {
      data = { error: "Upload failed" }
    }

    if (res.ok && isPersistedMessageAttachmentUrl(data.fileUrl) && data.fileName?.trim()) {
      return {
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        mimeType: data.mimeType ?? null,
        fileSize: data.fileSize ?? prepared.size,
        uploadState: "ready",
      }
    }

    lastError = data.error || `Upload failed (${res.status})`
    const retryable = res.status >= 500 || res.status === 408 || res.status === 429
    if (!retryable || attempt === 1) break
    await new Promise((resolve) => setTimeout(resolve, 900))
  }

  throw new Error(lastError)
}

export function composerCanSend(html: string, attachments: MessageAttachmentDraft[]): boolean {
  const hasText = stripHtmlToPlain(html).length > 0
  if (attachments.some((a) => a.uploadState === "uploading")) return false
  const readyAttachments = attachments.filter((a) => isPersistedMessageAttachmentUrl(a.fileUrl))
  if (!hasText && readyAttachments.length === 0) return false
  return attachments.every((a) => !a.fileUrl || isPersistedMessageAttachmentUrl(a.fileUrl))
}

export function attachmentsReadyForSend(attachments: MessageAttachmentDraft[]): MessageAttachmentDraft[] {
  return attachments.filter((a) => isPersistedMessageAttachmentUrl(a.fileUrl))
}
