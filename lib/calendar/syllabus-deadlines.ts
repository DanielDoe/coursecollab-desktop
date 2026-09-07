import { parseSyllabusDate } from "@/lib/syllabus/calendar-export"
import {
  parseCalendarDeadlines,
  splitMarkdownSubsections,
} from "@/lib/syllabus/markdown-blocks"
import type { CourseSyllabus, SyllabusTableBlock } from "@/lib/syllabus/types"

export type SyllabusDeadlineRow = {
  key: string
  title: string
  dateText: string
  parsedDate: Date | null
  source: string
}

function findDateColumnIndex(columns: string[]): number {
  const index = columns.findIndex((col) => /date|day|when|due/i.test(col))
  return index >= 0 ? index : 1
}

function findTitleColumnIndex(columns: string[]): number {
  const index = columns.findIndex((col) =>
    /assessment|exam|quiz|event|title|name|homework|assignment|lecture/i.test(col),
  )
  return index >= 0 ? index : 0
}

function tableBlocksFromSection(section: CourseSyllabus["sections"][number]): SyllabusTableBlock[] {
  const blocks: SyllabusTableBlock[] = [...(section.content?.tables ?? [])]
  if (section.content?.columns?.length) {
    blocks.push({
      title: section.title,
      columns: section.content.columns,
      rows: section.content.rows ?? [],
    })
  }
  return blocks
}

export function extractSyllabusDeadlines(syllabus: CourseSyllabus): SyllabusDeadlineRow[] {
  const seen = new Set<string>()
  const out: SyllabusDeadlineRow[] = []

  const push = (title: string, dateText: string, source: string) => {
    const t = title.trim()
    const d = dateText.trim()
    if (!t || !d) return
    const key = `${d.toLowerCase()}|${t.toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({
      key,
      title: t,
      dateText: d,
      parsedDate: parseSyllabusDate(d),
      source,
    })
  }

  for (const section of syllabus.sections) {
    if (!section.isVisible) continue
    const markdown = section.content?.markdown ?? ""

    for (const sub of splitMarkdownSubsections(markdown)) {
      const titleLower = sub.title.toLowerCase()
      if (titleLower.includes("academic calendar") || /important dates/i.test(titleLower)) {
        for (const dl of parseCalendarDeadlines(sub.body)) {
          push(dl.label, dl.date, sub.title)
        }
      }
    }

    for (const table of tableBlocksFromSection(section)) {
      if (!table.columns?.length) continue
      const dateCol = findDateColumnIndex(table.columns)
      const titleCol = findTitleColumnIndex(table.columns)
      for (const row of table.rows ?? []) {
        push(row[titleCol] ?? "", row[dateCol] ?? "", table.title || section.title)
      }
    }
  }

  return out.sort((a, b) => {
    const ta = a.parsedDate?.getTime() ?? Number.POSITIVE_INFINITY
    const tb = b.parsedDate?.getTime() ?? Number.POSITIVE_INFINITY
    return ta - tb
  })
}

export function syllabusDeadlineToCalendarTimes(parsedDate: Date): {
  start_time: string
  end_time: string
  all_day: boolean
} {
  const start = new Date(parsedDate)
  start.setHours(23, 59, 0, 0)
  const end = new Date(start)
  end.setHours(23, 59, 59, 999)
  return {
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    all_day: true,
  }
}
