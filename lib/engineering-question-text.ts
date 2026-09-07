import { hasMathContent } from "@/lib/math-markdown"

/** Format engineering notation for readable display (Unicode superscripts, phasor emphasis). */

const SUPERSCRIPT_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹"

function toSuperscript(exp: string): string {
  let out = ""
  for (const ch of exp) {
    if (ch === "-") out += "⁻"
    else if (ch === "+") out += "⁺"
    else if (ch >= "0" && ch <= "9") out += SUPERSCRIPT_DIGITS[+ch]
    else out += ch
  }
  return out
}

/**
 * Converts caret exponents (10^-6), optional "bold X" phasor hints, and i(t) to light markdown.
 * Safe for plain-text display (Unicode superscripts) and QuestionTextRenderer markdown paths.
 */
export function formatEngineeringQuestionText(text: string): string {
  if (!text) return text

  let t = text.replace(/\\n/g, "\n")

  // LaTeX-delimited math (e.g. \(v(t)\)) must not be rewritten to markdown italics.
  if (hasMathContent(t)) return t

  t = t.replace(/(\d+(?:\.\d+)?)\s*[×x]\s*10\^([+-]?\d+)/gi, (_, coef, exp) => {
    return `${coef} × 10${toSuperscript(exp)}`
  })

  t = t.replace(/10\^([+-]?\d+)/g, (_, exp) => `10${toSuperscript(exp)}`)

  t = t.replace(/\bbold\s+([A-Za-z])\b/g, "**$1**")

  t = t.replace(/\b([a-zA-Z])\s*\(\s*t\s*\)/g, "*$1*(t)")

  return t
}

const LETTERED_SUBPART_LINE = /^\(([a-z])\)\s*(.*)$/

/**
 * Turns consecutive "(a) …", "(b) …" lines into a markdown bullet list for readable stems.
 */
export function formatLetteredSubparts(text: string): string {
  if (!text?.trim()) return text

  const lines = text.split("\n")
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const match = lines[i].match(LETTERED_SUBPART_LINE)
    if (!match) {
      out.push(lines[i])
      i++
      continue
    }

    const block: { label: string; body: string }[] = []
    while (i < lines.length) {
      const part = lines[i].match(LETTERED_SUBPART_LINE)
      if (!part) break
      block.push({ label: part[1], body: part[2].trim() })
      i++
    }

    const prev = out.map((l) => l.trim()).filter(Boolean).at(-1) ?? ""
    const shouldFormat = block.length >= 2 || /[:?]\s*$/.test(prev)
    if (!shouldFormat) {
      for (const item of block) {
        out.push(`(${item.label}) ${item.body}`)
      }
      continue
    }

    if (out.length > 0 && out[out.length - 1].trim() !== "") out.push("")
    for (const item of block) {
      out.push(`- **(${item.label})** ${item.body}`)
    }
    out.push("")
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()
}
