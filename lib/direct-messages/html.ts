const MESSAGE_ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "a",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "span",
])

const MESSAGE_ALLOWED_ATTRS = new Set(["href", "target", "rel", "class"])

/** Server-safe HTML → plain text (no jsdom / DOMPurify — works on Vercel). */
function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

export function stripHtmlToPlain(html: string): string {
  const plain = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<\/div>/gi, " ")
    .replace(/<[^>]+>/g, " ")

  return decodeBasicEntities(plain).replace(/\s+/g, " ").trim()
}

function sanitizeAnchorTag(tag: string): string {
  const hrefMatch = tag.match(/\shref=["']([^"']+)["']/i)
  const href = hrefMatch?.[1]?.trim()
  if (!href || !/^https?:\/\//i.test(href)) return "<a>"
  const escaped = href.replace(/"/g, "&quot;")
  return `<a href="${escaped}" target="_blank" rel="noopener noreferrer">`
}

function sanitizeOpenTag(tag: string): string {
  const nameMatch = tag.match(/^<([a-z0-9]+)\b/i)
  const name = nameMatch?.[1]?.toLowerCase()
  if (!name || !MESSAGE_ALLOWED_TAGS.has(name)) return ""

  if (name === "br") return "<br>"

  if (name === "a") return sanitizeAnchorTag(tag)

  const attrs: string[] = []
  for (const attr of MESSAGE_ALLOWED_ATTRS) {
    if (attr === "href") continue
    const attrMatch = tag.match(new RegExp(`\\s${attr}=["']([^"']*)["']`, "i"))
    if (attrMatch) {
      const value = attrMatch[1].replace(/"/g, "&quot;")
      attrs.push(`${attr}="${value}"`)
    }
  }

  return attrs.length > 0 ? `<${name} ${attrs.join(" ")}>` : `<${name}>`
}

/** Server-safe sanitizer for TipTap message HTML (no jsdom — works on Vercel). */
export function sanitizeMessageHtml(html: string): string {
  let safe = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")

  safe = safe.replace(/<\/?([a-z0-9]+)\b[^>]*>/gi, (match) => {
    if (match.startsWith("</")) {
      const name = match.match(/^<\/([a-z0-9]+)/i)?.[1]?.toLowerCase()
      return name && MESSAGE_ALLOWED_TAGS.has(name) ? `</${name}>` : ""
    }
    return sanitizeOpenTag(match)
  })

  return safe.replace(/javascript:/gi, "")
}

export function messagePreviewText(body: string, max = 400): string {
  const text = stripHtmlToPlain(body) || body.trim()
  if (text.length <= max) return text
  return `${text.slice(0, max)}…`
}

export function looksLikeHtml(body: string): boolean {
  return /<[a-z][\s\S]*>/i.test(body)
}
