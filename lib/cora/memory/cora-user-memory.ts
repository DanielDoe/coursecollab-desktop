/**
 * Cora dual-scope memory:
 * - global: learns the user across all chats (preferences, standing facts)
 * - thread: notes scoped to one conversation
 *
 * Injected into system prompts; also writable via remember_fact tool.
 */

import { sql } from "@/lib/db"

export type CoraMemoryRole = "student" | "instructor" | "admin" | "guest"
export type CoraMemoryScope = "global" | "thread"

export type CoraMemoryEntry = {
  id: number
  role: CoraMemoryRole
  userId: number
  courseId: number | null
  scope: CoraMemoryScope
  threadId: string | null
  kind: string
  content: string
  source: string | null
  createdAt: string
  updatedAt: string
}

let schemaReady: Promise<void> | null = null

export function ensureCoraMemorySchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS cora_user_memory (
          id SERIAL PRIMARY KEY,
          role TEXT NOT NULL,
          user_id INTEGER NOT NULL,
          course_id INTEGER,
          scope TEXT NOT NULL DEFAULT 'global',
          thread_id TEXT,
          kind TEXT NOT NULL DEFAULT 'fact',
          content TEXT NOT NULL,
          source TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
      await sql`
        CREATE INDEX IF NOT EXISTS cora_user_memory_user_idx
        ON cora_user_memory (role, user_id, course_id, updated_at DESC)
      `
      await sql`
        CREATE INDEX IF NOT EXISTS cora_user_memory_thread_idx
        ON cora_user_memory (thread_id, updated_at DESC)
        WHERE thread_id IS NOT NULL
      `
    })()
  }
  return schemaReady
}

function mapRow(row: Record<string, unknown>): CoraMemoryEntry {
  return {
    id: Number(row.id),
    role: String(row.role) as CoraMemoryRole,
    userId: Number(row.user_id),
    courseId: row.course_id != null ? Number(row.course_id) : null,
    scope: String(row.scope) === "thread" ? "thread" : "global",
    threadId: row.thread_id != null ? String(row.thread_id) : null,
    kind: String(row.kind ?? "fact"),
    content: String(row.content ?? ""),
    source: row.source != null ? String(row.source) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  }
}

export async function rememberCoraFact(input: {
  role: CoraMemoryRole
  userId: number
  courseId?: number | null
  scope?: CoraMemoryScope
  threadId?: string | null
  kind?: string
  content: string
  source?: string | null
}): Promise<CoraMemoryEntry> {
  await ensureCoraMemorySchema()
  const content = String(input.content ?? "").trim().slice(0, 2000)
  if (!content) throw new Error("Memory content is required.")

  const scope: CoraMemoryScope = input.scope === "thread" ? "thread" : "global"
  const threadId = scope === "thread" ? String(input.threadId ?? "").trim() || null : null
  if (scope === "thread" && !threadId) {
    throw new Error("threadId is required for thread-scoped memory.")
  }

  const rows = (await sql`
    INSERT INTO cora_user_memory (
      role, user_id, course_id, scope, thread_id, kind, content, source
    )
    VALUES (
      ${input.role},
      ${input.userId},
      ${input.courseId ?? null},
      ${scope},
      ${threadId},
      ${String(input.kind ?? "fact").slice(0, 64)},
      ${content},
      ${input.source ?? null}
    )
    RETURNING *
  `) as Array<Record<string, unknown>>

  return mapRow(rows[0]!)
}

export async function listCoraMemory(input: {
  role: CoraMemoryRole
  userId: number
  courseId?: number | null
  threadId?: string | null
  limit?: number
}): Promise<{ global: CoraMemoryEntry[]; thread: CoraMemoryEntry[] }> {
  await ensureCoraMemorySchema()
  const limit = Math.min(Math.max(Number(input.limit) || 24, 1), 60)

  const globalRows = (await sql`
    SELECT *
    FROM cora_user_memory
    WHERE role = ${input.role}
      AND user_id = ${input.userId}
      AND scope = 'global'
      AND (
        course_id IS NULL
        OR ${input.courseId ?? null}::int IS NULL
        OR course_id = ${input.courseId ?? null}
      )
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `) as Array<Record<string, unknown>>

  let threadRows: Array<Record<string, unknown>> = []
  const threadId = String(input.threadId ?? "").trim()
  if (threadId) {
    threadRows = (await sql`
      SELECT *
      FROM cora_user_memory
      WHERE role = ${input.role}
        AND user_id = ${input.userId}
        AND scope = 'thread'
        AND thread_id = ${threadId}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `) as Array<Record<string, unknown>>
  }

  return {
    global: globalRows.map(mapRow),
    thread: threadRows.map(mapRow),
  }
}

/** Compact block for system prompts. */
export function formatCoraMemoryPrompt(memory: {
  global: CoraMemoryEntry[]
  thread: CoraMemoryEntry[]
}): string {
  const lines: string[] = []
  if (memory.global.length) {
    lines.push("GLOBAL USER MEMORY (across chats — durable preferences/facts):")
    for (const entry of memory.global.slice(0, 16)) {
      lines.push(`- ${entry.content}`)
    }
  }
  if (memory.thread.length) {
    lines.push("THREAD MEMORY (this conversation only):")
    for (const entry of memory.thread.slice(0, 12)) {
      lines.push(`- ${entry.content}`)
    }
  }
  if (!lines.length) return ""
  lines.push(
    "Use memory to personalize answers. Call remember_fact for lasting preferences the user states clearly. Prefer tools over guessing when platform data is needed.",
  )
  return lines.join("\n")
}
