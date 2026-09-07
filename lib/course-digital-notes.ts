import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import type { ModuleContentSessionFilter } from "@/lib/module-content-session-scope"
import { parseCircuitWorkspace, type CircuitWorkspace } from "@/lib/circuit-workspace"
import {
  fetchDisabledModuleTopicsForStudent,
} from "@/lib/module-topic-availability"

export type CourseDigitalNoteRow = {
  id: number
  course_id: number
  instructor_id: number | null
  topic: string | null
  title: string
  body_text: string
  ink_workspace: unknown
  session: string | null
  is_published: boolean
  created_at: string
  updated_at: string
}

export type CourseDigitalNote = {
  id: number
  courseId: number
  instructorId: number | null
  topic: string | null
  title: string
  bodyText: string
  inkWorkspace: CircuitWorkspace | null
  session: string | null
  isPublished: boolean
  createdAt: string
  updatedAt: string
}

export async function ensureCourseDigitalNotesSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS course_digital_notes (
      id SERIAL PRIMARY KEY,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
      topic TEXT,
      title TEXT NOT NULL DEFAULT 'Untitled note',
      body_text TEXT NOT NULL DEFAULT '',
      ink_workspace JSONB,
      session VARCHAR(64),
      is_published BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE course_digital_notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`
}

export function mapCourseDigitalNote(row: CourseDigitalNoteRow): CourseDigitalNote {
  return {
    id: row.id,
    courseId: row.course_id,
    instructorId: row.instructor_id,
    topic: row.topic,
    title: row.title,
    bodyText: row.body_text ?? "",
    inkWorkspace: parseCircuitWorkspace(row.ink_workspace),
    session: row.session,
    isPublished: Boolean(row.is_published),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchCourseDigitalNotesForInstructor(
  courseId: number,
  sessionFilter?: ModuleContentSessionFilter,
): Promise<CourseDigitalNoteRow[]> {
  await ensureCourseDigitalNotesSchema()

  if (sessionFilter?.mode === "section") {
    const variants = sessionFilter.sessionVariants
    const rows = await sql`
      SELECT *
      FROM course_digital_notes
      WHERE course_id = ${courseId}
        AND deleted_at IS NULL
        AND (session IS NULL OR session = ANY(${variants}))
      ORDER BY updated_at DESC
    `
    return rows as CourseDigitalNoteRow[]
  }

  const rows = await sql`
    SELECT *
    FROM course_digital_notes
    WHERE course_id = ${courseId}
      AND deleted_at IS NULL
    ORDER BY updated_at DESC
  `
  return rows as CourseDigitalNoteRow[]
}

export async function fetchCourseDigitalNoteById(
  noteId: number,
  options?: { includeDeleted?: boolean },
): Promise<CourseDigitalNoteRow | null> {
  await ensureCourseDigitalNotesSchema()
  const rows = options?.includeDeleted
    ? await sql`SELECT * FROM course_digital_notes WHERE id = ${noteId} LIMIT 1`
    : await sql`
        SELECT * FROM course_digital_notes
        WHERE id = ${noteId} AND deleted_at IS NULL
        LIMIT 1
      `
  return rows.length > 0 ? (rows[0] as CourseDigitalNoteRow) : null
}

export async function fetchPublishedCourseNotesForStudent(options: {
  courseId: number | null
  session: string | null
}): Promise<CourseDigitalNoteRow[]> {
  const { courseId, session } = options
  if (courseId == null) return []

  await ensureCourseDigitalNotesSchema()

  const sessionTrim = (session ?? "").trim()
  const sessionVariants =
    sessionTrim.length > 0 ? normalizedSectionVariantsForSql(sessionTrim) : []

  const rows =
    sessionVariants.length > 0
      ? await sql`
          SELECT *
          FROM course_digital_notes
          WHERE course_id = ${courseId}
            AND is_published = true
            AND deleted_at IS NULL
            AND (session IS NULL OR session = ANY(${sessionVariants}))
          ORDER BY updated_at DESC
        `
      : await sql`
          SELECT *
          FROM course_digital_notes
          WHERE course_id = ${courseId}
            AND is_published = true
            AND deleted_at IS NULL
            AND session IS NULL
          ORDER BY updated_at DESC
        `

  const disabled = await fetchDisabledModuleTopicsForStudent("course_notes", session)

  return (rows as CourseDigitalNoteRow[]).filter((note) => {
    const topic = note.topic?.trim()
    if (!topic) return true
    return !disabled.has(topic)
  })
}
