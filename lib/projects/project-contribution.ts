import type {
  ProjectFieldMeta,
  ProjectFieldTypingFrame,
  SectionContentBlock,
} from "@/lib/projects/project-template-types"

export type MemberInk = {
  dot: string
  chip: string
  bar: string
  edge: string
}

/** Quiet, distinct marks. One color per group member, in roster order. */
export const MEMBER_INKS: MemberInk[] = [
  {
    dot: "bg-sky-500",
    chip: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-800",
    bar: "bg-sky-500",
    edge: "border-l-sky-400",
  },
  {
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800",
    bar: "bg-emerald-500",
    edge: "border-l-emerald-400",
  },
  {
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800",
    bar: "bg-amber-500",
    edge: "border-l-amber-400",
  },
  {
    dot: "bg-violet-500",
    chip: "bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-800",
    bar: "bg-violet-500",
    edge: "border-l-violet-400",
  },
  {
    dot: "bg-rose-500",
    chip: "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-800",
    bar: "bg-rose-500",
    edge: "border-l-rose-400",
  },
  {
    dot: "bg-teal-500",
    chip: "bg-teal-50 text-teal-800 ring-teal-200 dark:bg-teal-950/40 dark:text-teal-200 dark:ring-teal-800",
    bar: "bg-teal-500",
    edge: "border-l-teal-400",
  },
]

export const UNASSIGNED_INK: MemberInk = {
  dot: "bg-slate-400",
  chip: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600",
  bar: "bg-slate-400",
  edge: "border-l-slate-300",
}

export function inkForMember(members: Array<{ id?: number }>, studentId?: number): MemberInk {
  if (studentId == null) return UNASSIGNED_INK
  const index = members.findIndex((member) => member.id === studentId)
  if (index < 0) return MEMBER_INKS[Math.abs(studentId) % MEMBER_INKS.length]
  return MEMBER_INKS[index % MEMBER_INKS.length]
}

function strip(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
}

export function countWords(text: string) {
  const clean = strip(text)
  if (!clean) return 0
  return clean.split(" ").length
}

export function blockPlain(block: SectionContentBlock | undefined) {
  if (!block) return ""
  switch (block.type) {
    case "text":
      return strip(block.html)
    case "code":
      return block.code.trim()
    case "equation":
      return block.latex.trim()
    case "table":
      return strip([...block.headers, ...block.rows.flat()].join(" "))
    case "link":
      return strip(`${block.label} ${block.url}`)
    case "image":
    case "figure":
      return strip(block.caption || "")
    case "file":
      return strip(block.label || "")
    case "diagram":
      return strip(block.description || "")
    default:
      return ""
  }
}

export function blockHasContent(block: SectionContentBlock | undefined) {
  if (!block) return false
  if (block.type === "image" || block.type === "figure" || block.type === "diagram") return Boolean(block.url)
  if (block.type === "file") return block.file_id > 0
  return blockPlain(block).length > 0
}

export function blockWords(block: SectionContentBlock | undefined) {
  return countWords(blockPlain(block))
}

export function blockStamp(block: SectionContentBlock | undefined) {
  if (!block) return ""
  if (block.type === "image" || block.type === "figure" || block.type === "diagram") {
    return `${block.type}:${block.url || ""}:${"caption" in block ? block.caption || "" : ""}`
  }
  if (block.type === "file") return `file:${block.file_id}`
  return `${block.type}:${blockPlain(block)}`
}

export type FieldCredit = { studentId?: number; name: string; last: boolean }

export function fieldCredits(meta: ProjectFieldMeta | undefined): FieldCredit[] {
  if (!meta?.author_name && !meta?.contributors?.length) return []
  const credits: FieldCredit[] = (meta.contributors ?? []).map((row) => ({
    studentId: row.student_id,
    name: row.name,
    last: row.student_id != null && row.student_id === meta.author_student_id,
  }))
  if (meta.author_name && !credits.some((row) => row.name === meta.author_name)) {
    credits.push({ studentId: meta.author_student_id, name: meta.author_name, last: true })
  }
  if (credits.length && !credits.some((row) => row.last)) {
    const match = credits.find((row) => row.studentId != null && row.studentId === meta.author_student_id)
    ;(match ?? credits[credits.length - 1]).last = true
  }
  return credits
}

export function claimFieldMeta(
  prev: ProjectFieldMeta | undefined,
  student: { id?: number | null; name?: string },
  words: number,
  typing?: ProjectFieldTypingFrame[],
): ProjectFieldMeta {
  const name = student.name?.trim() || "Member"
  const id = student.id ?? undefined
  const contributors = [...(prev?.contributors ?? [])]
  if (
    prev?.author_name &&
    !contributors.some(
      (row) =>
        (prev.author_student_id != null && row.student_id === prev.author_student_id) || row.name === prev.author_name,
    )
  ) {
    contributors.push({
      student_id: prev.author_student_id,
      name: prev.author_name,
      words: 0,
    })
  }
  const mine =
    id != null
      ? contributors.find((row) => row.student_id === id)
      : contributors.find((row) => row.name === name)
  const at = new Date().toISOString()
  if (mine) {
    mine.name = name
    mine.words = words
    mine.at = at
    if (id != null) mine.student_id = id
  } else {
    contributors.push({ student_id: id, name, words, at })
  }
  return {
    author_student_id: id,
    author_name: name,
    contributors: contributors.slice(-8),
    typing: typing ? typing.slice(-120) : prev?.typing,
  }
}

export type ContributionRow = {
  id: number
  name: string
  words: number
  items: number
  sections: number
  pct: number
}

type ContributionSection = {
  id: number
  current_revision?: {
    content?: { blocks?: SectionContentBlock[]; field_meta?: Record<string, ProjectFieldMeta> }
    created_by_student_id?: number | null
    author_name?: string | null
  } | null
}

/** Field authors, or the member who last saved the section when a field has no name yet. */
export function creditsForBlock(
  section: ContributionSection,
  block: SectionContentBlock | undefined,
): FieldCredit[] {
  if (!block || !blockHasContent(block)) return []
  const credits = fieldCredits(section.current_revision?.content?.field_meta?.[block.id])
  if (credits.length) return credits
  const name = section.current_revision?.author_name?.trim()
  if (!name) return []
  return [{ studentId: section.current_revision?.created_by_student_id ?? undefined, name, last: true }]
}

export function summarizeContributions(
  sections: ContributionSection[],
  members: Array<{ id?: number; full_name?: string }>,
): ContributionRow[] {
  const byId = new Map<number, ContributionRow & { sectionIds: Set<number> }>()
  for (const member of members) {
    if (member.id == null) continue
    byId.set(member.id, {
      id: member.id,
      name: member.full_name || "Member",
      words: 0,
      items: 0,
      sections: 0,
      pct: 0,
      sectionIds: new Set(),
    })
  }

  const touch = (id: number, name: string) => {
    const row = byId.get(id) ?? {
      id,
      name,
      words: 0,
      items: 0,
      sections: 0,
      pct: 0,
      sectionIds: new Set<number>(),
    }
    if (name) row.name = name
    byId.set(id, row)
    return row
  }

  let wordTotal = 0
  let itemTotal = 0
  for (const section of sections) {
    for (const block of section.current_revision?.content?.blocks ?? []) {
      if (!blockHasContent(block)) continue
      const words = blockWords(block)
      const credits = creditsForBlock(section, block)
      const owner = credits.find((credit) => credit.last) ?? credits[0]
      if (!owner) {
        wordTotal += words
        itemTotal += 1
        const loose = touch(0, "Earlier draft")
        loose.words += words
        loose.items += 1
        loose.sectionIds.add(section.id)
        continue
      }
      wordTotal += words
      itemTotal += 1
      for (const credit of credits) {
        const key = credit.studentId ?? -Math.abs(hashName(credit.name))
        const row = touch(key, credit.name)
        row.items += 1
        row.sectionIds.add(section.id)
        if (credit.last) row.words += words
      }
    }
  }

  return [...byId.values()]
    .filter((row) => row.id !== 0 || row.words > 0 || row.items > 0)
    .map((row) => {
      const share = wordTotal > 0 ? row.words / wordTotal : itemTotal > 0 ? row.items / itemTotal : 0
      return {
        id: row.id,
        name: row.name,
        words: row.words,
        items: row.items,
        sections: row.sectionIds.size,
        pct: Math.round(share * 100),
      }
    })
}

function hashName(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return hash || 1
}
