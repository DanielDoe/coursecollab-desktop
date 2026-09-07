/**
 * Light-touch markdown polish for XR curriculum — same facts, clearer structure for CampRichMarkdown.
 */
export function polishXrMarkdown(markdown: string): string {
  let md = markdown.trim()

  md = md.replace(/^## Module goal$/gm, "### Learning objectives")
  md = md.replace(/^### By the end of this module you should:$/gm, "### What you will be able to do")
  md = md.replace(/^### By the end of this program you will be able to$/gm, "### What you will be able to do")

  // Hero / diagram placeholders → styled visual reference callout
  md = md.replace(
    /^\*[^*]*(?:placeholder|Placeholder)[^*]*\*$/gim,
    "> **Visual reference** — Instructor-provided imagery, diagrams, or recordings will appear here. Use the description above as your guide for what to look for in lab.",
  )

  // Opening story: group "Imagine …" lines into a scannable list (same sentences)
  md = md.replace(
    /(### Opening story\n\n)((?:Imagine[^\n]+\n\n)+)/g,
    (_, header: string, imagines: string) => {
      const items = imagines
        .trim()
        .split(/\n\n/)
        .filter((line) => line.startsWith("Imagine"))
        .map((line) => `- ${line}`)
        .join("\n")
      const rest = imagines.replace(/(?:Imagine[^\n]+\n\n)+/g, "").trim()
      return `${header}${items}${rest ? `\n\n${rest}` : ""}\n\n`
    },
  )

  // Inline checkmark lists (✓ A · ✓ B) → bullet list
  md = md.replace(/^([✓✗].+)$/gm, (line) => {
    if (!line.includes(" · ")) return line
    const symbol = line.trimStart().startsWith("✗") ? "✗" : "✓"
    const items = line
      .replace(/^[✓✗]\s*/, "")
      .split(/\s*·\s*/)
      .map((item) => `- ${symbol} ${item.trim()}`)
      .join("\n")
    return items
  })

  // Case study benefits line → table row format
  md = md.replace(
    /^\*\*Benefits:\*\* (.+)$/gm,
    (_, benefits: string) => {
      const parts = benefits.split(/\s*·\s*/).map((p: string) => p.trim())
      return `| Benefit | |\n| --- | --- |\n${parts.map((p: string) => `| ${p} | ✓ |`).join("\n")}`
    },
  )

  // Dot-separated requirement lines → bullet list
  md = md.replace(/^(.+\s·\s.+)$/gm, (line) => {
    if (line.startsWith("|") || line.startsWith("- ") || line.startsWith("##")) return line
    const parts = line.split(/\s·\s/).map((p) => p.trim()).filter(Boolean)
    if (parts.length < 2) return line
    return parts
      .map((p) => {
        const numbered = p.match(/^(\d+)\.\s*(.+)$/)
        return numbered ? `${numbered[1]}. ${numbered[2]}` : `- ${p}`
      })
      .join("\n")
  })

  return md
}
