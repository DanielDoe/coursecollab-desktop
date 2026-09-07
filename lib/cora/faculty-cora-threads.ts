import { sql } from "@/lib/db"
import type {
  FacultyCoraChatThread,
  FacultyCoraStoredMessage,
} from "@/lib/cora/faculty-cora-thread-types"

export type {
  FacultyCoraChatThread,
  FacultyCoraStoredMessage,
} from "@/lib/cora/faculty-cora-thread-types"

const MAX_THREADS = 40

let schemaReady: Promise<void> | null = null

export function ensureFacultyCoraThreadsSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS instructor_cora_threads (
          id TEXT PRIMARY KEY,
          instructor_id INTEGER NOT NULL,
          course_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          preview TEXT NOT NULL DEFAULT '',
          capability_id TEXT,
          messages JSONB NOT NULL DEFAULT '[]'::jsonb,
          title_is_custom BOOLEAN NOT NULL DEFAULT false,
          archived_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          is_active BOOLEAN NOT NULL DEFAULT false
        )
      `
      await sql`
        CREATE INDEX IF NOT EXISTS instructor_cora_threads_scope_idx
        ON instructor_cora_threads (instructor_id, course_id, updated_at DESC)
      `
    })()
  }
  return schemaReady
}

function mapRow(row: Record<string, unknown>): FacultyCoraChatThread {
  const messages = Array.isArray(row.messages) ? (row.messages as FacultyCoraStoredMessage[]) : []
  return {
    id: String(row.id),
    title: String(row.title ?? "Cora conversation"),
    preview: String(row.preview ?? ""),
    capabilityId: row.capability_id != null ? String(row.capability_id) : undefined,
    messages,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    titleIsCustom: Boolean(row.title_is_custom),
    archivedAt: row.archived_at ? new Date(String(row.archived_at)).toISOString() : undefined,
  }
}

export async function listFacultyCoraThreads(input: {
  instructorId: number
  courseId: number
}): Promise<{ threads: FacultyCoraChatThread[]; activeThreadId: string | null }> {
  await ensureFacultyCoraThreadsSchema()
  const rows = (await sql`
    SELECT *
    FROM instructor_cora_threads
    WHERE instructor_id = ${input.instructorId}
      AND course_id = ${input.courseId}
    ORDER BY updated_at DESC
    LIMIT ${MAX_THREADS}
  `) as Array<Record<string, unknown>>
  const threads = rows.map((row) => mapRow(row))
  const active = rows.find((row) => Boolean(row.is_active))
  return {
    threads,
    activeThreadId: active ? String(active.id) : threads[0]?.id ?? null,
  }
}

export async function upsertFacultyCoraThread(input: {
  instructorId: number
  courseId: number
  thread: FacultyCoraChatThread
  setActive?: boolean
}): Promise<FacultyCoraChatThread> {
  await ensureFacultyCoraThreadsSchema()
  const { thread } = input
  const createdAt = thread.createdAt || new Date().toISOString()
  const updatedAt = thread.updatedAt || new Date().toISOString()

  if (input.setActive) {
    await sql`
      UPDATE instructor_cora_threads
      SET is_active = false
      WHERE instructor_id = ${input.instructorId}
        AND course_id = ${input.courseId}
        AND is_active = true
    `
  }

  await sql`
    INSERT INTO instructor_cora_threads (
      id, instructor_id, course_id, title, preview, capability_id, messages,
      title_is_custom, archived_at, created_at, updated_at, is_active
    )
    VALUES (
      ${thread.id},
      ${input.instructorId},
      ${input.courseId},
      ${thread.title},
      ${thread.preview},
      ${thread.capabilityId ?? null},
      ${JSON.stringify(thread.messages ?? [])}::jsonb,
      ${Boolean(thread.titleIsCustom)},
      ${thread.archivedAt ?? null},
      ${createdAt},
      ${updatedAt},
      ${Boolean(input.setActive)}
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      preview = EXCLUDED.preview,
      capability_id = EXCLUDED.capability_id,
      messages = EXCLUDED.messages,
      title_is_custom = EXCLUDED.title_is_custom,
      archived_at = EXCLUDED.archived_at,
      updated_at = EXCLUDED.updated_at,
      is_active = CASE
        WHEN ${Boolean(input.setActive)} THEN true
        ELSE instructor_cora_threads.is_active
      END
  `

  const rows = (await sql`
    SELECT * FROM instructor_cora_threads WHERE id = ${thread.id} LIMIT 1
  `) as Array<Record<string, unknown>>
  return mapRow(rows[0] ?? {})
}

export async function deleteFacultyCoraThread(input: {
  instructorId: number
  courseId: number
  threadId: string
}): Promise<void> {
  await ensureFacultyCoraThreadsSchema()
  await sql`
    DELETE FROM instructor_cora_threads
    WHERE id = ${input.threadId}
      AND instructor_id = ${input.instructorId}
      AND course_id = ${input.courseId}
  `
}

export async function setActiveFacultyCoraThread(input: {
  instructorId: number
  courseId: number
  threadId: string
}): Promise<void> {
  await ensureFacultyCoraThreadsSchema()
  await sql`
    UPDATE instructor_cora_threads
    SET is_active = false
    WHERE instructor_id = ${input.instructorId}
      AND course_id = ${input.courseId}
      AND is_active = true
  `
  await sql`
    UPDATE instructor_cora_threads
    SET is_active = true
    WHERE id = ${input.threadId}
      AND instructor_id = ${input.instructorId}
      AND course_id = ${input.courseId}
  `
}
