/** Convert legacy markdown notes to HTML for the rich editor; detect content type. */

const CORA_EXPORT_MARKERS = [
  /^#\s+Cora chat/m,
  /Exported from Cora workspace/i,
  /^##\s+Cora\b/m,
]

const MARKDOWN_HINT =
  /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s)|\*\*[^*]+\*\*|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$|_[^_]+_/

/** True when note body looks like rich HTML (not markdown). */
export function isNoteHtml(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed) return false
  return /^<[a-z][\s\S]*>/i.test(trimmed)
}

/** True when note body is markdown/KaTeX (e.g. Cora export), not rich HTML. */
export function isMarkdownNoteContent(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed) return false
  if (isNoteHtml(trimmed)) return false
  if (CORA_EXPORT_MARKERS.some((re) => re.test(trimmed))) return true
  return MARKDOWN_HINT.test(trimmed)
}

/** Fix known export glitches before edit/preview/save. */
export function sanitizeMarkdownNoteBody(content: string): string {
  return content.replace(/^## Cora · Invalid Date\s*\n+/gm, "## Cora\n\n")
}

export function noteBodyForEditor(content: string): string {
  const trimmed = content.trim()
  if (!trimmed) return ""
  if (isMarkdownNoteContent(trimmed)) return sanitizeMarkdownNoteBody(trimmed)
  return trimmed
}

export function noteBodyForSave(content: string, originalContent?: string): string {
  const trimmed = content.trim()
  if (!trimmed) return ""
  const source = originalContent?.trim() ?? trimmed
  if (isMarkdownNoteContent(trimmed) || isMarkdownNoteContent(source)) {
    return sanitizeMarkdownNoteBody(trimmed)
  }
  return trimmed
}

export function isLikelyMarkdown(text: string): boolean {
  return isMarkdownNoteContent(text)
}

function inlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function markdownToNoteHtml(md: string): string {
  if (!md.trim()) return "<p></p>"
  if (!isMarkdownNoteContent(md)) return md

  const lines = md.replace(/\r\n/g, "\n").split("\n")
  const blocks: string[] = []
  let listItems: string[] = []
  let orderedItems: string[] = []
  let paraLines: string[] = []
  let codeBlockLines: string[] = []
  let codeBlockLang = ""

  const flushPara = () => {
    if (paraLines.length === 0) return
    blocks.push(`<p>${inlineMarkdown(paraLines.join(" "))}</p>`)
    paraLines = []
  }

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push(`<ul>${listItems.map((li) => `<li>${inlineMarkdown(li)}</li>`).join("")}</ul>`)
      listItems = []
    }
    if (orderedItems.length > 0) {
      blocks.push(
        `<ol>${orderedItems.map((li) => `<li>${inlineMarkdown(li)}</li>`).join("")}</ol>`,
      )
      orderedItems = []
    }
  }

  const flushCodeBlock = () => {
    if (codeBlockLines.length === 0) return
    const langClass = codeBlockLang ? ` class="language-${escapeHtml(codeBlockLang)}"` : ""
    blocks.push(
      `<pre><code${langClass}>${escapeHtml(codeBlockLines.join("\n"))}</code></pre>`,
    )
    codeBlockLines = []
    codeBlockLang = ""
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (codeBlockLines.length > 0 || /^```/.test(trimmed)) {
      flushPara()
      flushList()
      const fenceOpen = /^```(\w*)?$/.exec(trimmed)
      if (fenceOpen) {
        if (codeBlockLines.length > 0) {
          flushCodeBlock()
        } else {
          codeBlockLang = fenceOpen[1] ?? ""
        }
        continue
      }
      codeBlockLines.push(line)
      continue
    }

    if (!trimmed) {
      flushPara()
      flushList()
      continue
    }

    const h1 = /^# (.+)$/.exec(trimmed)
    const h2 = /^## (.+)$/.exec(trimmed)
    const h3 = /^### (.+)$/.exec(trimmed)
    const bullet = /^[-*] (.+)$/.exec(trimmed)
    const ordered = /^\d+\.\s+(.+)$/.exec(trimmed)

    if (h1) {
      flushPara()
      flushList()
      blocks.push(`<h1>${inlineMarkdown(h1[1])}</h1>`)
      continue
    }
    if (h2) {
      flushPara()
      flushList()
      blocks.push(`<h2>${inlineMarkdown(h2[1])}</h2>`)
      continue
    }
    if (h3) {
      flushPara()
      flushList()
      blocks.push(`<h3>${inlineMarkdown(h3[1])}</h3>`)
      continue
    }
    if (bullet) {
      flushPara()
      if (orderedItems.length > 0) flushList()
      listItems.push(bullet[1])
      continue
    }
    if (ordered) {
      flushPara()
      if (listItems.length > 0) flushList()
      orderedItems.push(ordered[1])
      continue
    }

    flushList()
    paraLines.push(trimmed)
  }

  flushCodeBlock()
  flushPara()
  flushList()
  return blocks.join("") || "<p></p>"
}

/**
 * Prepare body for TipTap HTML editing.
 * Markdown/Cora notes are left as markdown — use markdown-native editor mode instead.
 */
export function prepareNoteContentForEditor(bodyText: string): string {
  if (!bodyText.trim()) return ""
  if (isMarkdownNoteContent(bodyText)) return noteBodyForEditor(bodyText)
  return bodyText
}

export function noteContentPreviewText(bodyText: string, maxLen = 120): string {
  const plain = noteContentToPlainText(bodyText)
  return plain.slice(0, maxLen)
}

export function noteContentToPlainText(content: string): string {
  if (!content.trim()) return ""
  if (isMarkdownNoteContent(content)) {
    return content
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/^[-*+]\s+/gm, "• ")
      .replace(/\s+/g, " ")
      .trim()
  }
  if (typeof document === "undefined") {
    return content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  }
  const el = document.createElement("div")
  el.innerHTML = content
  return (el.textContent ?? "").replace(/\s+/g, " ").trim()
}
