export type AnnouncementAttachment = {
  name: string
  url: string
  type: string
}

export function isInvalidPersistedAttachmentUrl(url: string | undefined | null): boolean {
  if (!url?.trim()) return true
  return url.startsWith("blob:") || url.startsWith("data:")
}

export function isPdfAttachment(attachment: AnnouncementAttachment): boolean {
  return (
    attachment.type === "application/pdf" ||
    attachment.name?.toLowerCase().endsWith(".pdf")
  )
}

/**
 * Download an announcement attachment with a sensible filename.
 * Uses fetch + blob for cross-origin URLs (e.g. Vercel Blob).
 */
export async function downloadAnnouncementAttachment(
  attachment: AnnouncementAttachment,
): Promise<void> {
  if (isInvalidPersistedAttachmentUrl(attachment.url)) {
    throw new Error(
      `"${attachment.name}" was not saved to the server. Edit the announcement and upload the file again.`,
    )
  }

  const fileName = attachment.name?.trim() || "download"

  try {
    const response = await fetch(attachment.url)
    if (!response.ok) {
      throw new Error(`Download failed (${response.status})`)
    }

    const blob = await response.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = blobUrl
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    window.URL.revokeObjectURL(blobUrl)
    document.body.removeChild(anchor)
  } catch (error) {
    if (error instanceof Error && error.message.includes("was not saved")) {
      throw error
    }
    // Same-origin relative paths or when fetch is blocked — open in new tab as fallback
    const anchor = document.createElement("a")
    anchor.href = attachment.url
    anchor.download = fileName
    anchor.target = "_blank"
    anchor.rel = "noopener noreferrer"
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  }
}

export function openAnnouncementAttachmentPreview(attachment: AnnouncementAttachment): void {
  if (isInvalidPersistedAttachmentUrl(attachment.url)) {
    throw new Error(
      `"${attachment.name}" was not saved to the server. Edit the announcement and upload the file again.`,
    )
  }

  window.open(attachment.url, "_blank", "noopener,noreferrer")
}

/** Parse attachments from JSON/JSONB (including double-encoded strings). */
export function parseAnnouncementAttachments(attachments: unknown): AnnouncementAttachment[] {
  let raw: unknown = attachments

  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw)
    } catch {
      return []
    }
  }

  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw)
    } catch {
      return []
    }
  }

  if (!Array.isArray(raw)) return []

  return raw
    .filter((att): att is AnnouncementAttachment => typeof att?.name === "string")
    .map((att) => ({
      name: att.name,
      url: typeof att.url === "string" ? att.url : "",
      type: typeof att.type === "string" ? att.type : "application/octet-stream",
    }))
}

/** Drop broken blob/data URLs before persisting to the database. */
export function sanitizeAnnouncementAttachments(attachments: unknown): AnnouncementAttachment[] {
  return parseAnnouncementAttachments(attachments).filter(
    (att) => !isInvalidPersistedAttachmentUrl(att.url),
  )
}
