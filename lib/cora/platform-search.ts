import { sql } from "@/lib/db"
import { searchPlatformCatalog, type PlatformCatalogEntry } from "@/lib/cora/platform-catalog"
import {
  listPracticeTopicsForCourse,
  resolveStudentPracticeContextFromParams,
} from "@/lib/student-practice-scope"
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope"

export type PlatformSearchResult =
  | { kind: "page"; label: string; href: string; group: string }
  | { kind: "practice_topic"; label: string; questionCount: number }
  | { kind: "lecture"; label: string; href: string; week?: number | null }
  | { kind: "announcement"; label: string; href: string; createdAt?: string }

function fuzzyIncludes(haystack: string, needle: string): boolean {
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase().trim()
  return h.includes(n) || n.split(" ").every((w) => w.length > 2 && h.includes(w))
}

export function matchPracticeTopicName(query: string, topics: { name: string }[]): string | null {
  const q = query.trim().toLowerCase()
  if (!q) return null

  const exact = topics.find((t) => t.name.toLowerCase() === q)
  if (exact) return exact.name

  const partial = topics.filter(
    (t) => t.name.toLowerCase().includes(q) || q.includes(t.name.toLowerCase()),
  )
  if (partial.length === 1) return partial[0]!.name

  const scored = topics
    .map((t) => {
      const name = t.name.toLowerCase()
      let score = 0
      if (name.includes(q)) score += 50
      for (const word of q.split(/\s+/)) {
        if (word.length > 2 && name.includes(word)) score += 15
      }
      return { name: t.name, score }
    })
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored[0]?.name ?? null
}

export async function searchPlatformForStudent(
  studentDbId: number,
  query: string,
): Promise<{ query: string; results: PlatformSearchResult[]; pages: PlatformCatalogEntry[] }> {
  const trimmed = query.trim()
  const pages = searchPlatformCatalog(trimmed, 6)
  const results: PlatformSearchResult[] = pages
    .filter((p) => p.href)
    .map((p) => ({
      kind: "page" as const,
      label: p.label,
      href: p.href!,
      group: p.group,
    }))

  const ctx = await resolveStudentCourseContextByDbId(studentDbId)
  if (!ctx) {
    return { query: trimmed, results, pages }
  }

  const practiceScope = await resolveStudentPracticeContextFromParams(
    String(studentDbId),
    null,
    String(ctx.courseId),
  )

  if (practiceScope.ok) {
    const topics = (await listPracticeTopicsForCourse(
      practiceScope.ctx.courseId,
      practiceScope.ctx.practiceSession,
      practiceScope.ctx.sessionVariants,
    )) as { name: string; question_count: number }[]
    for (const topic of topics) {
      if (fuzzyIncludes(topic.name, trimmed)) {
        results.push({
          kind: "practice_topic",
          label: topic.name,
          questionCount: Number(topic.question_count ?? 0),
        })
      }
    }
  }

  const lectures = (await sql`
    SELECT id, title, week
    FROM lectures
    WHERE course_id = ${ctx.courseId}
    ORDER BY week ASC NULLS LAST, title ASC
    LIMIT 80
  `) as { id: number; title: string; week: number | null }[]

  for (const row of lectures) {
    if (fuzzyIncludes(row.title, trimmed) || (row.week != null && trimmed.includes(String(row.week)))) {
      results.push({
        kind: "lecture",
        label: row.title,
        href: `/student/dashboard-v2/lectures/${row.id}`,
        week: row.week,
      })
    }
  }

  const announcements = (await sql`
    SELECT id, title, created_at
    FROM announcements
    WHERE course_id = ${ctx.courseId}
    ORDER BY created_at DESC
    LIMIT 40
  `) as { id: number; title: string; created_at: string }[]

  for (const row of announcements) {
    if (fuzzyIncludes(row.title, trimmed)) {
      results.push({
        kind: "announcement",
        label: row.title,
        href: `/student/dashboard-v2/announcements`,
        createdAt: row.created_at,
      })
    }
  }

  return { query: trimmed, results: results.slice(0, 12), pages }
}

export function formatPlatformSearchMarkdown(
  query: string,
  results: PlatformSearchResult[],
): string {
  if (results.length === 0) {
    return `No results found for **"${query}"**. Try "search for grades", "go to practice hub", or "open calendar".`
  }

  const sections: string[] = [`Found **${results.length}** result${results.length === 1 ? "" : "s"} for **"${query}"**:`, ""]

  const pages = results.filter((r) => r.kind === "page")
  if (pages.length) {
    sections.push("**Pages**")
    for (const p of pages) {
      sections.push(`- [${p.label}](${p.href}) — ${p.group}`)
    }
    sections.push("")
  }

  const topics = results.filter((r) => r.kind === "practice_topic")
  if (topics.length) {
    sections.push("**Practice topics**")
    for (const t of topics) {
      sections.push(`- ${t.label} (${t.questionCount} questions) — say *start a quiz on ${t.label}*`)
    }
    sections.push("")
  }

  const lectures = results.filter((r) => r.kind === "lecture")
  if (lectures.length) {
    sections.push("**Lectures**")
    for (const l of lectures) {
      const week = l.week != null ? ` · Week ${l.week}` : ""
      sections.push(`- [${l.label}](${l.href})${week}`)
    }
    sections.push("")
  }

  const announcements = results.filter((r) => r.kind === "announcement")
  if (announcements.length) {
    sections.push("**Announcements**")
    for (const a of announcements) {
      sections.push(`- [${a.label}](${a.href})`)
    }
  }

  return sections.join("\n").trim()
}
