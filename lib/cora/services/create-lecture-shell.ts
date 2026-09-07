/**
 * Shared lecture-shell create — Web UI and Cora confirm both call this.
 */

import { sql } from "@/lib/db"
import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"
import { replaceLectureSessionAccessFromRecord } from "@/lib/lecture-session-access-sync"

export type CreateLectureShellInput = {
  instructorId: number
  courseId: number
  title: string
  week: number
  description?: string | null
  objectives?: string[]
  /** Default false — shell stays unpublished until faculty publishes. */
  publish?: boolean
}

export type CreateLectureShellResult = {
  lectureId: number
  title: string
  week: number
  published: boolean
}

export async function createLectureShell(
  input: CreateLectureShellInput,
): Promise<CreateLectureShellResult> {
  const title = String(input.title ?? "").trim()
  if (!title) throw new Error("Lecture title is required.")

  const week = Number(input.week)
  if (!Number.isFinite(week) || week < 0) throw new Error("Valid week number is required.")

  const allowed = await instructorCanAccessCourse(input.instructorId, input.courseId)
  if (!allowed) throw new Error("Instructor cannot create lectures for this course.")

  const published = input.publish === true
  const objectives = Array.isArray(input.objectives) ? input.objectives : []
  const description = input.description != null ? String(input.description) : ""

  const rows = await sql`
    INSERT INTO lectures (
      title, week, description, learning_objectives,
      course_id, session_access, is_published, content_mode, allow_download,
      created_at, updated_at
    ) VALUES (
      ${title}, ${week}, ${description},
      ${objectives.length ? JSON.stringify(objectives) : null},
      ${input.courseId}, ${null},
      ${published}, ${"pdf"}, ${false}, NOW(), NOW()
    ) RETURNING id, title, week, is_published
  `

  const row = rows[0] as {
    id: number
    title: string
    week: number
    is_published: boolean
  }

  await replaceLectureSessionAccessFromRecord(sql, row.id, null)

  return {
    lectureId: Number(row.id),
    title: String(row.title),
    week: Number(row.week),
    published: Boolean(row.is_published),
  }
}
