/**
 * Server-safe HTML allowlist sanitizer (no jsdom).
 * Use at persist AND render. Cora output is untrusted.
 */

const ALLOWED_TAGS = new Set([
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
  "h4",
  "span",
  "div",
  "code",
  "pre",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "img",
  "hr",
  "sup",
  "sub",
])

const ALLOWED_ATTRS = new Set([
  "href",
  "src",
  "alt",
  "title",
  "target",
  "rel",
  "class",
  "colspan",
  "rowspan",
])

function isSafeHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim())
}

function sanitizeAnchorTag(tag: string): string {
  const hrefMatch = tag.match(/\shref=["']([^"']+)["']/i)
  const href = hrefMatch?.[1]?.trim()
  if (!href || !isSafeHttpUrl(href)) return "<a>"
  const escaped = href.replace(/"/g, "&quot;")
  return `<a href="${escaped}" target="_blank" rel="noopener noreferrer">`
}

function sanitizeImgTag(tag: string): string {
  const srcMatch = tag.match(/\ssrc=["']([^"']+)["']/i)
  const src = srcMatch?.[1]?.trim()
  if (!src || !isSafeHttpUrl(src)) return ""
  const altMatch = tag.match(/\salt=["']([^"']*)["']/i)
  const alt = (altMatch?.[1] ?? "").replace(/"/g, "&quot;")
  return `<img src="${src.replace(/"/g, "&quot;")}" alt="${alt}">`
}

function sanitizeOpenTag(tag: string): string {
  const nameMatch = tag.match(/^<([a-z0-9]+)\b/i)
  const name = nameMatch?.[1]?.toLowerCase()
  if (!name || !ALLOWED_TAGS.has(name)) return ""
  if (name === "br") return "<br>"
  if (name === "hr") return "<hr>"
  if (name === "a") return sanitizeAnchorTag(tag)
  if (name === "img") return sanitizeImgTag(tag)

  const attrs: string[] = []
  for (const attr of ALLOWED_ATTRS) {
    if (attr === "href" || attr === "src") continue
    const attrMatch = tag.match(new RegExp(`\\s${attr}=["']([^"']*)["']`, "i"))
    if (attrMatch) {
      const value = attrMatch[1].replace(/"/g, "&quot;")
      if (/^on/i.test(attr) || /javascript:/i.test(value)) continue
      attrs.push(`${attr}="${value}"`)
    }
  }
  return attrs.length > 0 ? `<${name} ${attrs.join(" ")}>` : `<${name}>`
}

/** Strip scripts, handlers, javascript: URLs, and non-allowlisted markup. */
export function sanitizeUserHtml(html: string | null | undefined): string {
  if (!html) return ""
  let safe = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")

  safe = safe.replace(/<\/?([a-z0-9]+)\b[^>]*>/gi, (match) => {
    if (match.startsWith("</")) {
      const name = match.match(/^<\/([a-z0-9]+)/i)?.[1]?.toLowerCase()
      return name && ALLOWED_TAGS.has(name) ? `</${name}>` : ""
    }
    return sanitizeOpenTag(match)
  })

  return safe.replace(/javascript:/gi, "").replace(/data:/gi, "")
}

export function looksLikeHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value)
}

/** Sanitize HTML; leave plain text / markdown unchanged. */
export function sanitizeStoredContent(value: string | null | undefined): string {
  const raw = String(value ?? "")
  if (!looksLikeHtml(raw)) return raw
  return sanitizeUserHtml(raw)
}
