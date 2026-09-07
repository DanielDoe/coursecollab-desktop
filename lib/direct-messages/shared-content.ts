import type { ThreadMessage } from "@/lib/direct-messages/types"

export type SharedContentKind = "photo" | "video" | "document" | "link" | "other"

export type SharedContentItem = {
  id: string
  kind: SharedContentKind
  title: string
  url: string
  mimeType: string | null
  fileSize: number | null
  messageId: number
  createdAt: string
  senderName: string
}

export type SharedContentFilter = "all" | SharedContentKind

const URL_REGEX = /https?:\/\/[^\s<>"']+/gi

function attachmentKind(mimeType: string | null): SharedContentKind {
  if (!mimeType) return "other"
  if (mimeType.startsWith("image/")) return "photo"
  if (mimeType.startsWith("video/")) return "video"
  if (
    mimeType.startsWith("application/pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("word") ||
    mimeType.includes("sheet") ||
    mimeType.includes("presentation") ||
    mimeType.startsWith("text/")
  ) {
    return "document"
  }
  return "other"
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

/** Extract http(s) links from message HTML and plain text. */
export function extractLinksFromMessageBody(body: string): Array<{ href: string; label: string }> {
  const found = new Map<string, string>()

  const anchorRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = anchorRegex.exec(body)) !== null) {
    const href = match[1]?.trim()
    if (!href || !/^https?:\/\//i.test(href)) continue
    const label = match[2]?.replace(/<[^>]+>/g, "").trim() || href
    found.set(href, label)
  }

  const plain = body.replace(/<[^>]+>/g, " ")
  for (const href of plain.match(URL_REGEX) ?? []) {
    if (!found.has(href)) found.set(href, href)
  }

  return [...found.entries()].map(([href, label]) => ({ href, label }))
}

export function buildSharedContentFromMessages(messages: ThreadMessage[]): SharedContentItem[] {
  const items: SharedContentItem[] = []

  for (const message of messages) {
    for (const attachment of message.attachments) {
      items.push({
        id: `att-${attachment.id}`,
        kind: attachmentKind(attachment.mimeType),
        title: attachment.fileName,
        url: attachment.fileUrl,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize,
        messageId: message.id,
        createdAt: message.createdAt,
        senderName: message.senderName,
      })
    }

    for (const link of extractLinksFromMessageBody(message.body)) {
      items.push({
        id: `link-${message.id}-${link.href}`,
        kind: "link",
        title: link.label,
        url: normalizeUrl(link.href),
        mimeType: null,
        fileSize: null,
        messageId: message.id,
        createdAt: message.createdAt,
        senderName: message.senderName,
      })
    }
  }

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function filterSharedContent(
  items: SharedContentItem[],
  filter: SharedContentFilter,
): SharedContentItem[] {
  if (filter === "all") return items
  return items.filter((item) => item.kind === filter)
}

export function sharedContentCounts(items: SharedContentItem[]): Record<SharedContentFilter, number> {
  return {
    all: items.length,
    photo: items.filter((i) => i.kind === "photo").length,
    video: items.filter((i) => i.kind === "video").length,
    document: items.filter((i) => i.kind === "document").length,
    link: items.filter((i) => i.kind === "link").length,
    other: items.filter((i) => i.kind === "other").length,
  }
}

export function formatFileSize(bytes: number | null): string | null {
  if (bytes == null || bytes <= 0) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function linkHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}
