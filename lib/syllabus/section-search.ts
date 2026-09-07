import type { SyllabusSection } from "@/lib/syllabus/types"

export function sectionSearchText(section: SyllabusSection): string {
  const parts: string[] = [section.title]
  const c = section.content

  if (c.markdown) parts.push(c.markdown)
  if (c.items) parts.push(...c.items)
  if (c.fields) parts.push(...Object.entries(c.fields).flat())
  if (c.rows) parts.push(...c.rows.flat())
  if (c.columns) parts.push(...c.columns)
  if (c.imageCaption) parts.push(c.imageCaption)
  if (c.tables) {
    for (const table of c.tables) {
      if (table.title) parts.push(table.title)
      parts.push(...table.columns)
      parts.push(...(table.rows ?? []).flat())
    }
  }

  return parts.join(" ").toLowerCase()
}

export function filterSectionsByQuery(sections: SyllabusSection[], query: string): SyllabusSection[] {
  const q = query.trim().toLowerCase()
  if (!q) return sections
  return sections.filter((s) => sectionSearchText(s).includes(q))
}
