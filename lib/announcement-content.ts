/** Detect stored HTML from the rich-text editor vs legacy plain / markdown. */
export function isAnnouncementHtml(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed) return false
  if (/^\s*</.test(trimmed)) return true
  return /<(p|h[1-6]|ul|ol|li|table|thead|tbody|tr|td|th|blockquote|strong|em|u|a|div|span|hr)\b/i.test(
    content,
  )
}

/** Plain text for previews, notifications, and card excerpts. */
export function announcementPlainText(content: string, maxLength?: number): string {
  if (!content) return ""
  let plain = content
  if (isAnnouncementHtml(content)) {
    plain = content
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
  } else {
    plain = content
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
  }
  plain = plain.replace(/\s+/g, " ").trim()
  if (maxLength != null && plain.length > maxLength) {
    return `${plain.slice(0, maxLength).trim()}…`
  }
  return plain
}

export function isAnnouncementContentEmpty(content: string): boolean {
  return announcementPlainText(content).length === 0
}
