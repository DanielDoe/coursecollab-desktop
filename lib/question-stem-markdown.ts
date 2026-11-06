import { unescapeNewlinesOutsideMath } from "@/lib/math-markdown"

const FENCE_LANG =
  "cpp|c\\+\\+|python|java|javascript|typescript|matlab"
const FENCE_LANG_OR_C = `${FENCE_LANG}|c`
const INLINE_ESCAPE = "\uE000"

/** Keep `\n` / `\t` inside inline code as the characters students must read. */
export function protectInlineEscapeSequences(input: string): string {
  if (!input) return input
  return input.replace(/```[\s\S]*?```|`([^`\n]+)`/g, (full, inline: string | undefined) => {
    if (inline == null) return full
    return (
      "`" +
      inline
        .replace(/\\n/g, `${INLINE_ESCAPE}n`)
        .replace(/\\t/g, `${INLINE_ESCAPE}t`)
        .replace(/\\r/g, `${INLINE_ESCAPE}r`) +
      "`"
    )
  })
}

export function restoreInlineEscapeSequences(input: string): string {
  if (!input) return input
  return input
    .replace(new RegExp(`${INLINE_ESCAPE}n`, "g"), "\\n")
    .replace(new RegExp(`${INLINE_ESCAPE}t`, "g"), "\\t")
    .replace(new RegExp(`${INLINE_ESCAPE}r`, "g"), "\\r")
}

/** Normalize instructor stems so ``` / `` fences render in QuestionTextRenderer. */
export function normalizeQuestionStemMarkdown(input: string): string {
  if (!input) return input

  let t = unescapeNewlinesOutsideMath(input)

  // Double-backtick fences (Word/export): ``cpp → ```cpp — not when already ```cpp
  t = t.replace(new RegExp("(?<!`)``(" + FENCE_LANG + ")\\b", "gi"), "```$1")
  t = t.replace(/(?<!`)``c\b(?![a-z+])/gi, "```c")

  // Opening fence glued to code on same line: ```cpp #include → ```cpp\n#include
  t = t.replace(
    new RegExp(`\`\`\`(${FENCE_LANG})([ \\t]+)(?!\\n)`, "gi"),
    "```$1\n",
  )
  // ```cpp#include (no space) — do not use a bare `|c|` alt here or ```cpp becomes ```c + p
  t = t.replace(
    new RegExp(`\`\`\`(${FENCE_LANG})(?=[#/"'{(\\[]|[A-Za-z_])`, "gi"),
    "```$1\n",
  )
  t = t.replace(/\`\`\`c(?=[#/"'{(\\[])/gi, "```c\n")

  // Legacy: entire stem is "cpp\n#include ..."
  const bareLang = t.match(new RegExp(`^(${FENCE_LANG_OR_C})\\n`, "i"))
  if (bareLang) {
    const language = bareLang[1]
    const codeContent = t.substring(bareLang[0].length)
    t = `\`\`\`${language}\n${codeContent}\n\`\`\``
  }

  const fenceCount = (t.match(/```/g) || []).length
  if (fenceCount % 2 === 1) {
    t = `${t.trimEnd()}\n\`\`\``
  }

  return t
}

export function questionStemHasCodeFence(text: string): boolean {
  return (
    text.includes("```") ||
    text.includes("~~~") ||
    /(?<!`)``(?:cpp|c\+\+|c|python|java|javascript|typescript|matlab)\b/i.test(text)
  )
}

/** True when a fenced block is only default C++ main boilerplate (not the actual problem). */
export function isCppStarterBoilerplate(code: string): boolean {
  const raw = code.replace(/\r/g, "").trim()
  if (!raw) return true

  const noLineComments = raw.replace(/\/\/[^\n]*/g, "")
  const noComments = noLineComments.replace(/\/\*[\s\S]*?\*\//g, "")
  const collapsed = noComments.replace(/\s+/g, " ").trim().toLowerCase()
  if (!collapsed.includes("int main")) return false

  const mainMatch = collapsed.match(/int\s+main\s*\(\s*(?:void\s*)?\)\s*\{([\s\S]*)\}/)
  if (!mainMatch) return false

  let mainBody = mainMatch[1].trim()
  if (!mainBody || mainBody === "return 0;" || mainBody === "return0;") return true

  if (/cout\s*<<[\s\S]*hello[\s\S]*world/i.test(mainBody) && mainBody.length < 160) return true

  const withoutReturn = mainBody.replace(/return\s+0\s*;/g, "").trim()
  if (!withoutReturn) return true
  if (
    /your code|start your code|write your code|goes in here|code here|todo|fixme/i.test(withoutReturn) &&
    !/[a-z_][a-z0-9_]*\s*\(/i.test(withoutReturn)
  ) {
    return true
  }

  return false
}

/** Remove starter/boilerplate code blocks and labels from assessment question stems. */
export function stripStarterBoilerplateFromQuestionStem(text: string): string {
  if (!text?.trim()) return text

  let t = unescapeNewlinesOutsideMath(text)

  t = t.replace(
    /^\s*(?:starter\s*code|boilerplate(?:\s*code)?|template\s*code|sample\s*code|skeleton\s*code)\s*:?\s*$/gim,
    "",
  )
  t = t.replace(
    /(starter\s*code|boilerplate(?:\s*code)?|template\s*code|sample\s*code)\s*:?\s*(?=\n?\s*```)/gim,
    "",
  )

  t = t.replace(/```(?:cpp|c\+\+|c|python|java|javascript|typescript|matlab)?\s*\n([\s\S]*?)```/gi, (full, code) => {
    const lang = (full.match(/```(\w+)/i)?.[1] || "cpp").toLowerCase()
    if (lang === "cpp" || lang === "c++" || lang === "c" || !lang) {
      return isCppStarterBoilerplate(code) ? "\n" : full
    }
    const trimmed = code.trim()
    if (!trimmed) return "\n"
    if (lang === "matlab" && /^(%[^\n]*\n)*\s*disp\s*\(\s*['"]Hello[\s\S]*$/i.test(trimmed)) return "\n"
    return full
  })

  return t.replace(/\n{3,}/g, "\n\n").trim()
}
