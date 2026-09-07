/**
 * Structured markdown + LaTeX explanations for lecture sample practice and similar content.
 */

export type MarkdownLatexExplanation = {
  format: "markdown_latex"
  content: string[]
}

export function isMarkdownLatexExplanation(raw: unknown): raw is MarkdownLatexExplanation {
  if (!raw || typeof raw !== "object") return false
  const o = raw as Record<string, unknown>
  return o.format === "markdown_latex" && Array.isArray(o.content)
}

function formatExplanationLine(line: string): string {
  const trimmed = line.trim()
  if (!trimmed) return ""

  const blockMath = trimmed.match(/^\$\$([\s\S]+)\$\$$/)
  if (blockMath) {
    return `$$\n${blockMath[1].trim()}\n$$`
  }

  return trimmed
}

/** Join markdown_latex content lines into markdown for KaTeX-aware renderers. */
export function markdownLatexExplanationToMarkdown(raw: unknown): string | undefined {
  if (typeof raw === "string") {
    const t = raw.trim()
    return t || undefined
  }
  if (!isMarkdownLatexExplanation(raw)) return undefined
  return raw.content
    .map(formatExplanationLine)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
