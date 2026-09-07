/** JSON.parse / loose JSON turns `\t` in `\text`, `\f` in `\frac`, etc. into control chars. */
export function repairLatexDamagedByJsonEscapes(input: string): string {
  if (!input) return input
  return (
    input
      // \text — most common (\\t + ext)
      .replace(/\text\{/g, "\\text{")
      .replace(/\text(?=[A-Za-z])/g, "\\text")
      // \frac, \boxed, \right
      .replace(/\frac\{/g, "\\frac{")
      .replace(/\boxed\{/g, "\\boxed{")
      .replace(/\right\b/g, "\\right")
      // \times, \tau (\\t + imes / au)
      .replace(/\times\b/g, "\\times")
      .replace(/\tau\b/g, "\\tau")
      // stray control chars from bad OCR / PDF extract
      .replace(/\u0003/g, "")
      // corrupted kΩ (vision sometimes emits \text{ k}A)
      .replace(/\\text\{\s*k\}A/g, "\\text{k}\\Omega")
      .replace(/\\text\{\s*m\}A/g, "\\text{mA}")
  )
}

/** Normalize LaTeX delimiters into remark-math $ / $$ form. */
export function normalizeMathDelimiters(input: string): string {
  let t = input.replace(/\\n/g, "\n")
  // Display math must be on its own lines — glued $$…$$ spanning newlines breaks remark-math
  // and shows raw LaTeX (often highlighted as KaTeX errors) in question previews.
  t = t.replace(/\\\[([\s\S]*?)\\\]/g, (_, expr) => `\n$$\n${expr.trim()}\n$$\n`)
  t = t.replace(/\\\(([\s\S]*?)\\\)/g, (_, expr) => `$${expr.trim()}$`)
  // Already-delimited $$ blocks: ensure opening/closing fences are line-broken
  t = t.replace(/\$\$([\s\S]*?)\$\$/g, (_, expr) => `\n$$\n${String(expr).trim()}\n$$\n`)
  t = fixUnbracedMultiCharSubscriptsInMath(t)
  return t.replace(/\n{3,}/g, "\n\n")
}

const LATEX_COMMAND_RE =
  /\\(?:frac|tfrac|cdot|cdotp|times|mathrm|text|mathbf|mathit|Omega|mu|alpha|beta|sqrt|left|right|boxed|Rightarrow|Rightarrow|pm|mp|leq|geq|neq|approx|sum|int|infty|partial|nabla|vec|hat|bar|dot)\b/

function readBalancedBracesEnd(text: string, openIndex: number): number | null {
  if (text[openIndex] !== "{") return null
  let depth = 0
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === "{") depth++
    else if (text[i] === "}") {
      depth--
      if (depth === 0) return i + 1
    }
  }
  return null
}

/** Vision/OCR often emits `\boxed{...}` on its own line without $ delimiters. */
function wrapBareBoxedMath(input: string): string {
  return input
    .split("\n")
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed.startsWith("\\boxed{")) return line

      const braceOpen = trimmed.indexOf("{")
      const end = readBalancedBracesEnd(trimmed, braceOpen)
      if (end === null || trimmed.slice(end).trim()) return line

      return `$$\n${trimmed}\n$$`
    })
    .join("\n")
}

const SUB_SUP_RE = /[_^]\{?[A-Za-z0-9+-]+\}?/

const MATHY_SUBSCRIPT_RE = /[A-Za-z]_[A-Za-z0-9]+/

function looksLikeLatex(expr: string): boolean {
  return (
    LATEX_COMMAND_RE.test(expr) ||
    (SUB_SUP_RE.test(expr) && MATHY_SUBSCRIPT_RE.test(expr)) ||
    /\^\{[^}]+\}/.test(expr)
  )
}

/** LaTeX subscripts without braces only apply to the next character (_rms → subscript r, not rms). */
export function fixUnbracedMultiCharSubscripts(expr: string): string {
  if (!expr) return expr
  return expr.replace(/(?<!\\)_([a-zA-Z0-9]{2,})(?![a-zA-Z0-9])/g, "_{$1}")
}

/** Apply subscript fix inside $…$, $$…$$, and \\(…\\) / \\[…\\] segments only. */
export function fixUnbracedMultiCharSubscriptsInMath(input: string): string {
  if (!input) return input
  const fix = (expr: string) => normalizeInlineLatex(expr)
  let t = input.replace(/\$\$([\s\S]*?)\$\$/g, (_, expr) => `$$${fix(expr)}$$`)
  t = t.replace(/\$([^$\n]+)\$/g, (_, expr) => `$${fix(expr)}$`)
  t = t.replace(/\\\(([\s\S]*?)\\\)/g, (_, expr) => `\\(${fix(expr)}\\)`)
  t = t.replace(/\\\[([\s\S]*?)\\\]/g, (_, expr) => `\\[${fix(expr)}\\]`)
  return t
}

/** Common trig/log names written without a leading backslash inside math. */
export function fixBareTrigFunctions(expr: string): string {
  if (!expr) return expr
  return expr.replace(/(?<!\\)\b(sin|cos|tan|log|ln)\b/g, "\\$1")
}

/** Prepare inline/display LaTeX fragments for KaTeX (subscripts, trig, × shorthand). */
export function normalizeInlineLatex(expr: string): string {
  let t = fixUnbracedMultiCharSubscripts(expr)
  t = fixBareTrigFunctions(t)
  t = fixScientificNotationShorthand(t)
  t = t.replace(/(\d+(?:\.\d+)?)\s+[x×]\s+(\d+(?:\.\d+)?)/gi, "$1 \\times $2")
  t = t.replace(/(\d+(?:\.\d+)?)\s+[x×]\s+(\\?[a-zA-Z]+)/g, "$1 \\times $2")
  t = t.replace(/(\d+(?:\.\d+)?)\s*°/g, "$1^\\circ")
  t = t.replace(/(\d+(?:\.\d+)?)\s*\\deg\b/g, "$1^\\circ")
  return t
}

/** Convert common AI shorthand (6x10^{-3}) into LaTeX (\times). */
export function fixScientificNotationShorthand(expr: string): string {
  return expr
    .replace(/(\d+(?:\.\d+)?)\s*x\s*10(\^\{[^}]+\})/gi, "$1\\times 10$2")
    .replace(/(\d+(?:\.\d+)?)\s*x\s*10\^([+-]?\d+)/gi, "$1\\times 10^{$2}")
}

function protectMathSegments(text: string): { text: string; segments: string[] } {
  const segments: string[] = []
  const protectedText = text.replace(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g, (m) => {
    segments.push(m)
    return `\x00MATH${segments.length - 1}\x00`
  })
  return { text: protectedText, segments }
}

function restoreMathSegments(text: string, segments: string[]): string {
  return text.replace(/\x00MATH(\d+)\x00/g, (_, i) => segments[Number(i)] ?? "")
}

function wrapAsInlineMath(expr: string): string {
  const fixed = fixScientificNotationShorthand(expr.trim())
  return looksLikeLatex(fixed) ? `$${fixed}$` : expr
}

const EQUATION_RE = new RegExp(
  `(?<![$\\\\])([A-Za-z][A-Za-z0-9_]*\\s*=\\s*(?:(?:\\([^)]*\\)|\\\\[a-zA-Z]+(?:\\{[^{}]*\\})*|[A-Za-z0-9_^{}\\s+\\-*/])+))`,
  "g",
)

function wrapBareLatexInPlainText(text: string): string {
  const { text: protectedText, segments } = protectMathSegments(text)
  let t = protectedText

  // Full equations first: v_L=(3I_0+6x10^{-3})\cdot500
  t = t.replace(EQUATION_RE, (match) => wrapAsInlineMath(match))

  // Quoted expressions from AI feedback, e.g. "v_L=(3I_0+6\times 10^{-3})\cdot 500"
  t = t.replace(/"([^"]+)"/g, (_, quoted) => {
    if (quoted.includes("$")) return `"${quoted}"`
    const inner = quoted.replace(EQUATION_RE, (match) => wrapAsInlineMath(match))
    const wrapped = inner.includes("$") ? inner : wrapAsInlineMath(quoted)
    return wrapped === quoted ? `"${quoted}"` : `"${wrapped}"`
  })

  // Standalone display-style fragments already using $$ but glued to text
  t = t.replace(/(\S)\$\$/g, "$1\n$$").replace(/\$\$(\S)/g, "$$\n$1")

  return restoreMathSegments(t, segments)
}

/**
 * Normalize AI / instructor feedback so remark-math + KaTeX can render it.
 * Handles $$...$$, bare LaTeX commands, and engineering shorthand.
 */
export function normalizeAiFeedbackMath(input: string): string {
  if (!input?.trim()) return input

  let t = normalizeMathDelimiters(input.replace(/\\n/g, "\n"))

  // "1) item" → markdown ordered list
  t = t.replace(/^(\d+)\)\s+/gm, "$1. ")

  // Display math on its own lines for reliable parsing
  t = t.replace(/\$\$([\s\S]*?)\$\$/g, (_, expr) => `\n$$\n${expr.trim()}\n$$\n`)

  // AI often indents math and continuation lines under numbered items — dedent so remark-math parses them
  t = t.replace(/^[ \t]+(\$\$)/gm, "$1")
  t = t.replace(/^[ \t]{1,3}(?=[A-Za-z"'(])/gm, "")

  t = wrapBareLatexInPlainText(t)

  return t.trim()
}

export function hasMathContent(input: string): boolean {
  return (
    /\\\([\s\S]*?\\\)/.test(input) ||
    /\\\[[\s\S]*?\\\]/.test(input) ||
    /\$[^$\n]+\$/.test(input) ||
    /\$\$[\s\S]*?\$\$/.test(input) ||
    LATEX_COMMAND_RE.test(input) ||
    (SUB_SUP_RE.test(input) && MATHY_SUBSCRIPT_RE.test(input))
  )
}

/** Normalize step-by-step practice solutions for remark-math + KaTeX (no aggressive re-wrapping). */
export function normalizeExplanationMarkdown(input: string): string {
  if (!input?.trim()) return input
  let t = wrapBareBoxedMath(
    repairLatexDamagedByJsonEscapes(
      normalizeMathDelimiters(input.replace(/\\n/g, "\n")),
    ),
  )
  // remark-math needs display math on its own lines
  t = t.replace(/\$\$([\s\S]*?)\$\$/g, (_, expr) => `\n$$\n${expr.trim()}\n$$\n`)
  return t.replace(/\n{3,}/g, "\n\n").trim()
}

/** True when AI feedback should use the markdown + KaTeX renderer. */
export function shouldRenderFeedbackAsMarkdown(input: string): boolean {
  const normalized = normalizeAiFeedbackMath(input)
  return (
    hasMathContent(input) ||
    hasMathContent(normalized) ||
    /(^|\n)#{1,6}\s/.test(input) ||
    /(^|\n)\d+\.\s/.test(normalized) ||
    /(^|\n)\d+\)\s/.test(input) ||
    /(^|\n)[-*+]\s/.test(normalized)
  )
}
