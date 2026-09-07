import { sql } from "@/lib/db"
import type { StoredCoraConversation, StoredCoraMessage } from "@/lib/cora/conversation-storage"

export type CoraWorkspaceThreadRow = {
  id: string
  student_id: number
  title: string
  messages: StoredCoraMessage[] | string
  created_at: string | Date
  updated_at: string | Date
  archived_at?: string | Date | null
  capability_id?: string | null
}

export async function ensureCoraWorkspaceThreadsSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS cora_workspace_threads (
      id TEXT NOT NULL,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'New Cora chat',
      messages JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (student_id, id)
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_cora_workspace_threads_student_updated
      ON cora_workspace_threads (student_id, updated_at DESC)
  `
  await sql`
    ALTER TABLE cora_workspace_threads
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ
  `
  await sql`
    ALTER TABLE cora_workspace_threads
    ADD COLUMN IF NOT EXISTS capability_id TEXT
  `
}

function parseMessages(raw: StoredCoraMessage[] | string): StoredCoraMessage[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as StoredCoraMessage[]
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

export function mapThreadRowToStored(row: CoraWorkspaceThreadRow): StoredCoraConversation {
  return {
    id: row.id,
    title: row.title,
    messages: parseMessages(row.messages),
    createdAt: new Date(row.created_at).toISOString(),
    lastUpdated: new Date(row.updated_at).toISOString(),
    archivedAt: row.archived_at ? new Date(row.archived_at).toISOString() : undefined,
    capabilityId: row.capability_id != null ? String(row.capability_id) : undefined,
  }
}

export async function listCoraWorkspaceThreads(studentDbId: number): Promise<StoredCoraConversation[]> {
  await ensureCoraWorkspaceThreadsSchema()
  const rows = (await sql`
    SELECT id, student_id, title, messages, created_at, updated_at, archived_at, capability_id
    FROM cora_workspace_threads
    WHERE student_id = ${studentDbId}
    ORDER BY updated_at DESC
    LIMIT 200
  `) as CoraWorkspaceThreadRow[]
  return rows.map(mapThreadRowToStored)
}

export async function upsertCoraWorkspaceThread(
  studentDbId: number,
  conversation: StoredCoraConversation,
): Promise<StoredCoraConversation> {
  await ensureCoraWorkspaceThreadsSchema()
  const messagesJson = JSON.stringify(conversation.messages ?? [])
  const createdAt = conversation.createdAt ?? new Date().toISOString()
  const updatedAt = conversation.lastUpdated ?? new Date().toISOString()
  const archivedAt = conversation.archivedAt ?? null
  const capabilityId = conversation.capabilityId ?? null

  const rows = (await sql`
    INSERT INTO cora_workspace_threads (
      id, student_id, title, messages, created_at, updated_at, archived_at, capability_id
    )
    VALUES (
      ${conversation.id},
      ${studentDbId},
      ${conversation.title},
      ${messagesJson}::jsonb,
      ${createdAt}::timestamptz,
      ${updatedAt}::timestamptz,
      ${archivedAt}::timestamptz,
      ${capabilityId}
    )
    ON CONFLICT (student_id, id) DO UPDATE SET
      title = EXCLUDED.title,
      messages = EXCLUDED.messages,
      updated_at = EXCLUDED.updated_at,
      archived_at = EXCLUDED.archived_at,
      capability_id = EXCLUDED.capability_id
    WHERE cora_workspace_threads.updated_at <= EXCLUDED.updated_at
    RETURNING id, student_id, title, messages, created_at, updated_at, archived_at, capability_id
  `) as CoraWorkspaceThreadRow[]

  if (rows[0]) return mapThreadRowToStored(rows[0])

  const existing = (await sql`
    SELECT id, student_id, title, messages, created_at, updated_at, archived_at, capability_id
    FROM cora_workspace_threads
    WHERE student_id = ${studentDbId} AND id = ${conversation.id}
    LIMIT 1
  `) as CoraWorkspaceThreadRow[]

  return existing[0] ? mapThreadRowToStored(existing[0]) : conversation
}

export async function upsertCoraWorkspaceThreads(
  studentDbId: number,
  conversations: StoredCoraConversation[],
): Promise<StoredCoraConversation[]> {
  const results: StoredCoraConversation[] = []
  for (const conversation of conversations) {
    results.push(await upsertCoraWorkspaceThread(studentDbId, conversation))
  }
  return results
}

export async function deleteCoraWorkspaceThread(studentDbId: number, threadId: string): Promise<boolean> {
  await ensureCoraWorkspaceThreadsSchema()
  const rows = await sql`
    DELETE FROM cora_workspace_threads
    WHERE student_id = ${studentDbId} AND id = ${threadId}
    RETURNING id
  `
  return rows.length > 0
}
