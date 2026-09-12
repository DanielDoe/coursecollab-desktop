export type CoraReplySectionVariant = "error" | "fix" | "concept" | "summary" | "default"

export type CoraReplySection = {
  title?: string
  body: string
  variant: CoraReplySectionVariant
}

function inferVariant(text: string): CoraReplySectionVariant {
  const lower = text.toLowerCase()
  if (/error|bug|fault|diagnostic|compiler|mistake|wrong|🔴|⚠️|❌/.test(lower)) return "error"
  if (/fix|solution|correct|patch|repair|hint|🛠|✅|🟢/.test(lower)) return "fix"
  if (/compiler error analysis|error analysis/.test(lower)) return "error"
  if (/concept|understand|learn|why|teach|🧠|💡|📚/.test(lower)) return "concept"
  if (/summary|overview|analysis|🔍|📋/.test(lower)) return "summary"
  return "default"
}

function stripTitleMarkdown(title: string): string {
  return title.replace(/^\*\*|\*\*$/g, "").replace(/^#+\s*/, "").trim()
}

/** Split Cora markdown replies into styled sections for card rendering. */
export function parseCoraReplySections(content: string): CoraReplySection[] {
  const trimmed = content.trim()
  if (!trimmed) return []

  if (/^##\s/m.test(trimmed)) {
    return trimmed
      .split(/\n(?=##\s+)/)
      .map((chunk) => {
        const lines = chunk.trim().split("\n")
        const rawTitle = lines[0]?.replace(/^##\s*/, "").trim()
        const title = rawTitle ? stripTitleMarkdown(rawTitle) : undefined
        const body = lines.slice(1).join("\n").trim()
        const combined = [title, body].filter(Boolean).join("\n")
        return {
          title,
          body: body || combined,
          variant: inferVariant(combined),
        }
      })
      .filter((section) => section.body.trim().length > 0)
  }

  const emojiBlocks = trimmed.split(/\n(?=[\u{1F300}-\u{1FAFF}\u2600-\u26FF\u2700-\u27BF])/u)
  if (emojiBlocks.length > 1) {
    return emojiBlocks
      .map((block) => {
        const lines = block.trim().split("\n")
        const first = lines[0]?.trim() ?? ""
        const titleMatch = first.match(/^([\u{1F300}-\u{1FAFF}\u2600-\u26FF\u2700-\u27BF])\s*(?:\*\*)?(.+?)(?:\*\*)?$/u)
        const title = titleMatch ? `${titleMatch[1]} ${stripTitleMarkdown(titleMatch[2])}` : first || undefined
        const body = (titleMatch ? lines.slice(1) : lines).join("\n").trim()
        const combined = block.trim()
        return {
          title: title && title.length < 120 ? title : undefined,
          body: body || combined,
          variant: inferVariant(combined),
        }
      })
      .filter((section) => section.body.trim().length > 0)
  }

  const boldHeaderBlocks = trimmed.split(/\n(?=\*\*[^*]+\*\*(?:\s*[-—])?\s*$)/m)
  if (boldHeaderBlocks.length > 1) {
    return boldHeaderBlocks
      .map((block) => {
        const lines = block.trim().split("\n")
        const first = lines[0]?.trim() ?? ""
        const title = /^\*\*.+\*\*/.test(first) ? stripTitleMarkdown(first) : undefined
        const body = (title ? lines.slice(1) : lines).join("\n").trim()
        const combined = block.trim()
        return {
          title,
          body: body || combined,
          variant: inferVariant(combined),
        }
      })
      .filter((section) => section.body.trim().length > 0)
  }

  const firstLine = trimmed.split("\n")[0]?.trim() ?? ""
  const hasTitle =
    /^#\s/.test(firstLine) ||
    (/^\*\*.+\*\*/.test(firstLine) && trimmed.includes("\n\n"))

  if (hasTitle) {
    const rest = trimmed.slice(firstLine.length).trim()
    return [
      {
        title: stripTitleMarkdown(firstLine.replace(/^#\s*/, "")),
        body: rest || trimmed,
        variant: inferVariant(trimmed),
      },
    ]
  }

  return [{ body: trimmed, variant: inferVariant(trimmed) }]
}
