/**
 * Shared announcement list — used by Cora tools and instructor APIs.
 * Do not invent a parallel query path inside the agent loop.
 */

import { sql } from "@/lib/db"
import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"

export type ListCourseAnnouncementsInput = {
  instructorId: number
  courseId: number
  /** Max rows to return (default 12, max 40). */
  limit?: number
  /** Optional case-insensitive title/body filter. */
  query?: string | null
}

export type ListedAnnouncement = {
  id: number
  title: string
  contentPreview: string
  pinned: boolean
  createdAt: string
  authorName: string | null
}

function previewContent(raw: unknown, max = 180): string {
  const text = String(raw ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

export async function listCourseAnnouncements(
  input: ListCourseAnnouncementsInput,
): Promise<ListedAnnouncement[]> {
  const allowed = await instructorCanAccessCourse(input.instructorId, input.courseId)
  if (!allowed) {
    throw new Error("Instructor cannot list announcements for this course.")
  }

  const limit = Math.min(Math.max(Number(input.limit) || 12, 1), 40)
  const query = String(input.query ?? "").trim()

  const rows = query
    ? ((await sql`
        SELECT
          a.id,
          a.title,
          a.content,
          a.pinned,
          a.created_at,
          i.name as author_name
        FROM announcements a
        LEFT JOIN instructors i ON a.author_id = i.id
        WHERE a.course_id = ${input.courseId}
          AND (
            a.title ILIKE ${"%" + query + "%"}
            OR a.content ILIKE ${"%" + query + "%"}
          )
        ORDER BY a.pinned DESC NULLS LAST, a.created_at DESC
        LIMIT ${limit}
      `) as Array<Record<string, unknown>>)
    : ((await sql`
        SELECT
          a.id,
          a.title,
          a.content,
          a.pinned,
          a.created_at,
          i.name as author_name
        FROM announcements a
        LEFT JOIN instructors i ON a.author_id = i.id
        WHERE a.course_id = ${input.courseId}
        ORDER BY a.pinned DESC NULLS LAST, a.created_at DESC
        LIMIT ${limit}
      `) as Array<Record<string, unknown>>)

  return rows.map((row) => ({
    id: Number(row.id),
    title: String(row.title ?? "Untitled"),
    contentPreview: previewContent(row.content),
    pinned: Boolean(row.pinned),
    createdAt: new Date(String(row.created_at)).toISOString(),
    authorName: row.author_name != null ? String(row.author_name) : null,
  }))
}

export function formatListedAnnouncementsForCora(
  items: ListedAnnouncement[],
  courseLabel: string,
): string {
  if (!items.length) {
    return `No announcements found for **${courseLabel}**.`
  }
  const lines = [
    `Recent announcements for **${courseLabel}** (${items.length}):`,
    ...items.map((item, index) => {
      const when = item.createdAt.slice(0, 10)
      const pin = item.pinned ? " · pinned" : ""
      const author = item.authorName ? ` · ${item.authorName}` : ""
      return `${index + 1}. **${item.title}** (${when}${pin}${author})\n   ${item.contentPreview}`
    }),
  ]
  return lines.join("\n")
}
