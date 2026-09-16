import katex from "katex"
import { normalizeInlineLatex } from "@/lib/math-markdown"
import { sanitizeUserHtml } from "@/lib/security/sanitize-html"

const CPP_STD_HEADER_TAGS =
  /<\/?(?:iostream|string|vector|map|set|algorithm|cmath|cstdlib|cstring|sstream|fstream|iomanip|stdexcept|memory|utility|functional|numeric|limits|bitset|queue|stack|deque|list|array|unordered_map|unordered_set)\s*>/gi

/** True when the string contains HTML element tags (rich-text / WYSIWYG question stems). */
export function hasHtmlTags(text: string): boolean {
  const withoutCppHeaders = text.replace(CPP_STD_HEADER_TAGS, "")
  return /<[a-z][\s\S]*?>/i.test(withoutCppHeaders)
}

/**
 * Detect markdown syntax in the non-HTML portions of a string.
 * Avoids false positives from `<sup>*</sup>` and similar HTML markup.
 */
export function hasMarkdownOutsideHtml(text: string): boolean {
  if (text.includes("```") || text.includes("~~~")) return true
  if (/``(?:cpp|c\+\+|c|python|java|javascript|typescript|matlab)\b/i.test(text)) return true
  const withoutTags = text.replace(/<[^>]+>/g, " ")
  if (/\*\*[^*]+\*\*/.test(withoutTags)) return true
  if (/(?:^|\n)#{1,6}\s/.test(withoutTags)) return true
  if (/(?:^|\n)[-*+]\s/.test(withoutTags)) return true
  if (/(?:^|\n)\d+\.\s/.test(withoutTags)) return true
  if (/`[^`\n]+`/.test(withoutTags)) return true
  return false
}

function decodeBasicEntities(fragment: string): string {
  return fragment
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
}

/** Convert inline HTML sub/sup markup inside <code> blocks to LaTeX subscripts/superscripts. */
export function htmlInlineToLatex(fragment: string): string {
  return decodeBasicEntities(fragment)
    .replace(/<sub>([\s\S]*?)<\/sub>/gi, "_{$1}")
    .replace(/<sup>([\s\S]*?)<\/sup>/gi, "^{$1}")
    .replace(/<[^>]+>/g, "")
    .trim()
}

function tryRenderKatex(latex: string): string | null {
  if (!latex) return null
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode: false,
      strict: "ignore",
    })
  } catch {
    return null
  }
}

/** Replace <code>…</code> segments that contain math with KaTeX-rendered spans. */
export function enrichHtmlWithKatex(html: string): string {
  return html.replace(/<code>([\s\S]*?)<\/code>/gi, (full, inner: string) => {
    const latex = normalizeInlineLatex(htmlInlineToLatex(inner))
    if (!/\\[a-zA-Z]|[_^{}]/.test(latex)) return full
    const rendered = tryRenderKatex(latex)
    return rendered ? `<span class="katex-inline">${rendered}</span>` : full
  })
}

/** Sanitize rich-text question HTML and render embedded formula/code math. */
export function prepareHtmlQuestionText(raw: string): string {
  return enrichHtmlWithKatex(sanitizeUserHtml(raw))
}
