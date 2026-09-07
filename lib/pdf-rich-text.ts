/**
 * Convert LaTeX / markdown / engineering notation into readable plain text for jsPDF.
 * jsPDF Helvetica only supports basic Latin — math is approximated in ASCII.
 */
import { formatEngineeringQuestionText } from "@/lib/engineering-question-text"
import { normalizeMathDelimiters } from "@/lib/math-markdown"

function stripLatexCommands(input: string): string {
  let t = input

  const unwrap = (pattern: RegExp, replacer: (...args: string[]) => string) => {
    let prev = ""
    while (prev !== t) {
      prev = t
      t = t.replace(pattern, replacer)
    }
  }

  unwrap(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_, a, b) => `(${stripLatexCommands(a)})/(${stripLatexCommands(b)})`)
  unwrap(/\\text\s*\{([^{}]*)\}/g, (_, inner) => stripLatexCommands(inner))
  unwrap(/\\mathrm\s*\{([^{}]*)\}/g, (_, inner) => stripLatexCommands(inner))
  unwrap(/\\mathbf\s*\{([^{}]*)\}/g, (_, inner) => stripLatexCommands(inner))

  t = t
    .replace(/\\Omega/g, "ohm")
    .replace(/\\ohm/g, "ohm")
    .replace(/\\times/g, " x ")
    .replace(/\\cdot/g, " * ")
    .replace(/\\ge(?:q)?/g, ">=")
    .replace(/\\le(?:q)?/g, "<=")
    .replace(/\\neq/g, "!=")
    .replace(/\\approx/g, "~")
    .replace(/\\pm/g, "+/-")
    .replace(/\\rightarrow/g, "->")
    .replace(/\\leftarrow/g, "<-")
    .replace(/\\infty/g, "infinity")
    .replace(/\\sqrt\s*\{([^{}]*)\}/g, "sqrt($1)")
    .replace(/\\,/g, " ")
    .replace(/\\:/g, " ")
    .replace(/\\;/g, " ")
    .replace(/\\!/g, "")
    .replace(/\\%/g, "%")
    .replace(/\\#/g, "#")
    .replace(/\\&/g, "&")
    .replace(/\\_/g, "_")
    .replace(/\\{/g, "{")
    .replace(/\\}/g, "}")
    .replace(/\\\[/g, "[")
    .replace(/\\\]/g, "]")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")

  t = t.replace(/_\{([^{}]+)\}/g, "_$1")
  t = t.replace(/\^\{([^{}]+)\}/g, "^$1")
  t = t.replace(/\\([a-zA-Z]+)/g, " $1 ")

  return t
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
}

function extractMathSegments(text: string): string {
  let t = text
  t = t.replace(/\$\$([\s\S]*?)\$\$/g, (_, expr) => stripLatexCommands(expr))
  t = t.replace(/\$([^$\n]+)\$/g, (_, expr) => stripLatexCommands(expr))
  t = t.replace(/\\\(([\s\S]*?)\\\)/g, (_, expr) => stripLatexCommands(expr))
  t = t.replace(/\\\[([\s\S]*?)\\\]/g, (_, expr) => stripLatexCommands(expr))
  return t
}

function stripMarkdownFormatting(text: string): string {
  let t = text
  t = t.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/^```[^\n]*\n?/, "").replace(/```$/, "").trim(),
  )
  t = t.replace(/`([^`]+)`/g, "$1")
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1")
  t = t.replace(/\*([^*]+)\*/g, "$1")
  t = t.replace(/__([^_]+)__/g, "$1")
  t = t.replace(/_([^_]+)_/g, "$1")
  t = t.replace(/(^|\n)#{1,6}\s+/g, "$1")
  t = t.replace(/^\s*[-*+]\s+/gm, "- ")
  return t
}

/** Format rich text (LaTeX, markdown, engineering notation) for PDF output. */
export function formatRichTextForPdf(input: string | null | undefined): string {
  if (input == null || typeof input !== "string") return ""
  let t = normalizeMathDelimiters(formatEngineeringQuestionText(input))
  t = extractMathSegments(t)
  t = stripMarkdownFormatting(t)
  // Bare LaTeX commands outside delimiters (e.g. "1 \Omega resistor")
  t = stripLatexCommands(t)
  t = t
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim()

  // Add breathing room before numbered feedback items (1) 2. etc.)
  t = t.replace(/\n(\d+[\).]\s)/g, "\n\n$1")

  return t
}

/** Split rich text into PDF-friendly wrapped paragraphs. */
export function splitRichTextParagraphs(text: string): string[] {
  const formatted = formatRichTextForPdf(text)
  if (!formatted) return []
  return formatted.split(/\n{2,}/).map((p) => p.replace(/\n/g, " ").trim()).filter(Boolean)
}

export type AiFeedbackPoint = {
  kind: "numbered" | "paragraph"
  label?: string
  body: string
}

/** Split AI feedback prose into numbered evaluation points for structured PDF layout. */
export function parseAiFeedbackIntoPoints(text: string | null | undefined): AiFeedbackPoint[] {
  if (!text?.trim()) return []

  const raw = text.replace(/\r\n/g, "\n")
  const chunks = raw
    .split(/(?=(?:^|\n)\s*\d+[\).]\s)/)
    .map((s) => s.trim())
    .filter(Boolean)

  if (chunks.length === 0) {
    return [{ kind: "paragraph", body: formatRichTextForPdf(text) }]
  }

  if (chunks.length === 1 && !/^\d+[\).]\s/.test(chunks[0])) {
    return [{ kind: "paragraph", body: formatRichTextForPdf(text) }]
  }

  const points: AiFeedbackPoint[] = []
  for (const chunk of chunks) {
    const bodyMatch = chunk.match(/^(\d+)[\).]\s+([\s\S]*)$/)
    if (bodyMatch) {
      const body = formatRichTextForPdf(bodyMatch[2]).replace(/\n+/g, " ").trim()
      if (body) points.push({ kind: "numbered", label: bodyMatch[1], body })
    } else {
      const body = formatRichTextForPdf(chunk).replace(/\n+/g, " ").trim()
      if (body) points.push({ kind: "paragraph", body })
    }
  }

  return points
}
