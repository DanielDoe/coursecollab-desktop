export type MarkdownSubsection = {
  title: string
  level: 2 | 3
  body: string
}

export type CalendarDeadline = {
  date: string
  label: string
}

export type GradeScaleEntry = {
  range: string
  letter: string
  tone: "a" | "b" | "c" | "d" | "f"
}

export function splitMarkdownSubsections(markdown: string): MarkdownSubsection[] {
  if (!markdown?.trim()) return []

  const parts = markdown.split(/(?=^#{2,3}\s)/m).filter(Boolean)
  if (!parts.length) return [{ title: "", level: 2, body: markdown.trim() }]

  return parts.map((part) => {
    const match = part.match(/^(#{2,3})\s+(.+?)(?:\n|$)([\s\S]*)/)
    if (!match) return { title: "", level: 2 as const, body: part.trim() }
    return {
      level: (match[1].length as 2 | 3) ?? 2,
      title: match[2].trim(),
      body: match[3].trim(),
    }
  })
}

export function parseBulletItems(body: string): string[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^-\s+/, "").replace(/\*\*/g, "").trim())
}

export function parseMarkdownBulletsRaw(body: string): string[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^-\s+/, "").trim())
}

export function parseCalendarDeadlines(body: string): CalendarDeadline[] {
  const items = parseMarkdownBulletsRaw(body)
  const deadlines: CalendarDeadline[] = []

  for (const item of items) {
    const match = item.match(/^\*\*(.+?)\*\*\s*[–-]\s*(.+)$/)
    if (match) {
      deadlines.push({ date: match[1].trim(), label: match[2].trim() })
      continue
    }
    const plain = item.match(/^(.+?\d{4})\s*[–-]\s*(.+)$/)
    if (plain) {
      deadlines.push({ date: plain[1].trim(), label: plain[2].trim() })
    }
  }

  return deadlines
}

export function parseGradeScaleEntries(body: string): GradeScaleEntry[] {
  const items = parseMarkdownBulletsRaw(body)
  const entries: GradeScaleEntry[] = []

  for (const item of items) {
    const match = item.match(/^\*\*(.+?)\*\*:?\s*(.+)$/i) ?? item.match(/^(.+?):\s*(.+)$/)
    if (!match) continue

    const range = match[1].replace(/\*\*/g, "").trim()
    const letter = match[2].replace(/\*\*/g, "").trim()
    const lower = range.toLowerCase()

    let tone: GradeScaleEntry["tone"] = "f"
    if (lower.includes("below") || letter.toLowerCase() === "f") tone = "f"
    else if (range.startsWith("9") || letter.includes("A")) tone = "a"
    else if (range.startsWith("7") || letter.includes("B")) tone = "b"
    else if (range.startsWith("6") || letter.includes("C")) tone = "c"
    else if (range.startsWith("5") || letter.includes("D")) tone = "d"

    entries.push({ range, letter, tone })
  }

  return entries
}

export function extractAbetOutcome(text: string): { main: string; abet: string | null } {
  const match = text.match(/^(.+?)\s*\((ABET[^)]+)\)\s*$/i)
  if (!match) return { main: text.replace(/\*\*/g, ""), abet: null }
  return { main: match[1].replace(/\*\*/g, "").trim(), abet: match[2].trim() }
}

export function stripBulletMarkdown(text: string): string {
  return text.replace(/\*\*/g, "").trim()
}
