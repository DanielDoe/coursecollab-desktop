import { createHash, randomUUID } from "node:crypto"
import { sql } from "@/lib/db"

const seen = new Map<string, { at: number; result: unknown }>()
const TTL_MS = 24 * 60 * 60 * 1000
const STALE_PENDING_MS = 2 * 60 * 1000

let schemaReady = false

export function createCoraActionId(): string {
  return `cora_${randomUUID()}`
}

export function hashCoraActionKey(parts: {
  userId: number
  tool: string
  resourceHint?: string
  actionId?: string
}): string {
  const raw = [parts.userId, parts.tool, parts.resourceHint ?? "", parts.actionId ?? ""].join(":")
  return createHash("sha256").update(raw).digest("hex")
}

export async function ensureCoraActionIdempotencySchema(): Promise<void> {
  if (schemaReady) return
  await sql`
    CREATE TABLE IF NOT EXISTS cora_action_idempotency (
      user_id INTEGER NOT NULL,
      action_id TEXT NOT NULL,
      tool TEXT NOT NULL,
      result_json JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'complete',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, action_id)
    )
  `
  await sql`
    ALTER TABLE cora_action_idempotency
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'complete'
  `
  schemaReady = true
}

function prune() {
  const now = Date.now()
  for (const [key, value] of seen) {
    if (now - value.at > TTL_MS) seen.delete(key)
  }
}

function memKey(userId: number, actionId: string): string {
  return `${userId}:${actionId}`
}

/** Durable peek — completed confirms only. */
export async function peekCoraConfirmedAction(
  userId: number,
  actionId: string,
): Promise<unknown | undefined> {
  const key = memKey(userId, actionId)
  prune()
  const cached = seen.get(key)
  if (cached) return cached.result

  try {
    await ensureCoraActionIdempotencySchema()
    const rows = (await sql`
      SELECT result_json
      FROM cora_action_idempotency
      WHERE user_id = ${userId}
        AND action_id = ${actionId}
        AND status = 'complete'
      LIMIT 1
    `) as Array<{ result_json: unknown }>
    const row = rows[0]
    if (!row) return undefined
    seen.set(key, { at: Date.now(), result: row.result_json })
    return row.result_json
  } catch {
    return seen.get(key)?.result
  }
}

export type CoraConfirmClaim =
  | { status: "won" }
  | { status: "replay"; result: unknown }
  | { status: "in_progress" }

/** Insert a pending claim first. Only the winner may execute the mutation. */
export async function claimCoraConfirmedAction(args: {
  userId: number
  actionId: string
  tool: string
}): Promise<CoraConfirmClaim> {
  prune()
  const key = memKey(args.userId, args.actionId)
  const cached = seen.get(key)
  if (cached) return { status: "replay", result: cached.result }

  await ensureCoraActionIdempotencySchema()
  const inserted = (await sql`
    INSERT INTO cora_action_idempotency (user_id, action_id, tool, result_json, status)
    VALUES (${args.userId}, ${args.actionId}, ${args.tool}, '{}'::jsonb, 'pending')
    ON CONFLICT (user_id, action_id) DO NOTHING
    RETURNING action_id
  `) as Array<{ action_id: string }>
  if (inserted[0]) return { status: "won" }

  const rows = (await sql`
    SELECT status, result_json, created_at
    FROM cora_action_idempotency
    WHERE user_id = ${args.userId} AND action_id = ${args.actionId}
    LIMIT 1
  `) as Array<{ status: string; result_json: unknown; created_at: string | Date }>

  const row = rows[0]
  if (!row) return { status: "in_progress" }
  if (row.status === "complete") {
    seen.set(key, { at: Date.now(), result: row.result_json })
    return { status: "replay", result: row.result_json }
  }

  const created = new Date(row.created_at).getTime()
  if (Number.isFinite(created) && Date.now() - created > STALE_PENDING_MS) {
    const takeover = (await sql`
      UPDATE cora_action_idempotency
      SET created_at = CURRENT_TIMESTAMP, tool = ${args.tool}
      WHERE user_id = ${args.userId}
        AND action_id = ${args.actionId}
        AND status = 'pending'
        AND created_at < NOW() - INTERVAL '2 minutes'
      RETURNING action_id
    `) as Array<{ action_id: string }>
    if (takeover[0]) return { status: "won" }
  }
  return { status: "in_progress" }
}

export async function completeCoraConfirmedAction(args: {
  userId: number
  actionId: string
  tool: string
  result: unknown
}): Promise<void> {
  const key = memKey(args.userId, args.actionId)
  prune()
  seen.set(key, { at: Date.now(), result: args.result })
  try {
    await ensureCoraActionIdempotencySchema()
    await sql`
      UPDATE cora_action_idempotency
      SET
        status = 'complete',
        tool = ${args.tool},
        result_json = ${JSON.stringify(args.result)}::jsonb
      WHERE user_id = ${args.userId} AND action_id = ${args.actionId}
    `
  } catch (error) {
    console.warn("[cora.idempotency] complete failed", error)
  }
}

export async function releaseCoraConfirmedActionClaim(args: {
  userId: number
  actionId: string
}): Promise<void> {
  seen.delete(memKey(args.userId, args.actionId))
  try {
    await ensureCoraActionIdempotencySchema()
    await sql`
      DELETE FROM cora_action_idempotency
      WHERE user_id = ${args.userId}
        AND action_id = ${args.actionId}
        AND status = 'pending'
    `
  } catch (error) {
    console.warn("[cora.idempotency] release failed", error)
  }
}

/** Persist a successful confirm so Vercel retries cannot double-write. */
export async function rememberCoraConfirmedAction(args: {
  userId: number
  actionId: string
  tool: string
  result: unknown
}): Promise<void> {
  await completeCoraConfirmedAction(args)
}
