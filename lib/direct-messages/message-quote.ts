import { stripHtmlToPlain } from "@/lib/direct-messages/html"

export type MessageQuote = {
  senderName: string | null
  excerpt: string
}

const QUOTE_LINE = /^>\s?(.*)$/
const SENDER_LINE = /^\*\*(.+)\*\*$/

/** Split a stored reply into the quoted message and the text written after it. */
export function parseMessageQuote(body: string): { quote: MessageQuote | null; reply: string } {
  const normalized = body.replace(/\r\n/g, "\n")
  if (!normalized.startsWith(">")) return { quote: null, reply: body }

  const lines = normalized.split("\n")
  const quoted: string[] = []
  let index = 0
  for (; index < lines.length; index += 1) {
    const match = QUOTE_LINE.exec(lines[index] ?? "")
    if (!match) break
    quoted.push(match[1] ?? "")
  }
  if (quoted.length === 0) return { quote: null, reply: body }

  if (lines[index] === "") index += 1
  const reply = lines.slice(index).join("\n").trim()

  let senderName: string | null = null
  let excerptLines = quoted
  const nameMatch = SENDER_LINE.exec(quoted[0]?.trim() ?? "")
  if (nameMatch?.[1]) {
    senderName = nameMatch[1].trim()
    excerptLines = quoted.slice(1)
  }

  const excerpt = excerptLines
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  if (!excerpt) return { quote: null, reply: body }
  return { quote: { senderName, excerpt }, reply }
}

/** Plain excerpt used when starting a reply, without nested quote markup. */
export function quoteExcerptFromBody(body: string): string {
  const plain = stripHtmlToPlain(body) || body.trim()
  const parsed = parseMessageQuote(plain)
  const source = parsed.quote
    ? [parsed.quote.excerpt, parsed.reply].filter(Boolean).join(" ")
    : plain
  return source.replace(/\s+/g, " ").trim().slice(0, 280)
}

export function quoteNamesMatch(
  senderName: string | null | undefined,
  viewerName: string | null | undefined,
): boolean {
  const left = senderName?.trim().toLowerCase()
  const right = viewerName?.trim().toLowerCase()
  if (!left || !right) return false
  return left === right
}

/** Stored form: a named quote block, then a blank line, then the reply. */
export function buildQuotedReply(senderName: string, body: string): string {
  const name = senderName.replace(/\*/g, "").trim() || "Quoted message"
  const excerpt = quoteExcerptFromBody(body) || "Attachment"
  return `> **${name}**\n> ${excerpt}\n\n`
}
