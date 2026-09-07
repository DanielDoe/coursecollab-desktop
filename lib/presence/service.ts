import { sql } from "@/lib/db"
import { ensurePresenceSchema } from "@/lib/ensure-presence-schema"
import { PRESENCE_IDLE_MS, PRESENCE_ONLINE_MS } from "@/lib/presence/constants"
import type {
  ManualPresenceStatus,
  PresenceRecord,
  PresenceStatus,
} from "@/lib/presence/types"
import type { MessageActor, ParticipantKind } from "@/lib/direct-messages/types"

function resolveEffectiveStatus(
  manualStatus: ManualPresenceStatus | null,
  lastSeenAt: Date | null,
  now = Date.now(),
): PresenceStatus {
  if (manualStatus === "appear_offline") return "offline"
  if (manualStatus === "busy") return "busy"
  if (manualStatus === "dnd") return "dnd"
  if (manualStatus === "away") return "away"
  if (manualStatus === "available") return "available"

  if (!lastSeenAt) return "offline"
  const elapsed = now - lastSeenAt.getTime()
  if (elapsed <= PRESENCE_ONLINE_MS) return "available"
  if (elapsed <= PRESENCE_IDLE_MS) return "away"
  return "offline"
}

function rowToRecord(
  kind: ParticipantKind,
  id: number,
  row: { manual_status: ManualPresenceStatus | null; last_seen_at: string | null } | undefined,
): PresenceRecord {
  const lastSeenAt = row?.last_seen_at ?? null
  const lastSeenDate = lastSeenAt ? new Date(lastSeenAt) : null
  const manualStatus = row?.manual_status ?? null
  return {
    kind,
    id,
    manualStatus,
    lastSeenAt,
    status: resolveEffectiveStatus(manualStatus, lastSeenDate),
  }
}

export async function resetManualPresence(actor: MessageActor): Promise<PresenceRecord> {
  await ensurePresenceSchema()
  const rows = (await sql`
    INSERT INTO user_presence (participant_kind, participant_id, manual_status, last_seen_at, updated_at)
    VALUES (${actor.kind}, ${actor.id}, NULL, NOW(), NOW())
    ON CONFLICT (participant_kind, participant_id)
    DO UPDATE SET manual_status = NULL, last_seen_at = NOW(), updated_at = NOW()
    RETURNING manual_status, last_seen_at
  `) as Array<{ manual_status: ManualPresenceStatus | null; last_seen_at: string }>
  return rowToRecord(actor.kind, actor.id, rows[0])
}

export async function touchPresence(actor: MessageActor): Promise<PresenceRecord> {
  await ensurePresenceSchema()
  const rows = (await sql`
    INSERT INTO user_presence (participant_kind, participant_id, last_seen_at, updated_at)
    VALUES (${actor.kind}, ${actor.id}, NOW(), NOW())
    ON CONFLICT (participant_kind, participant_id)
    DO UPDATE SET last_seen_at = NOW(), updated_at = NOW()
    RETURNING manual_status, last_seen_at
  `) as Array<{ manual_status: ManualPresenceStatus | null; last_seen_at: string }>
  return rowToRecord(actor.kind, actor.id, rows[0])
}

export async function setManualPresence(
  actor: MessageActor,
  manualStatus: ManualPresenceStatus,
): Promise<PresenceRecord> {
  await ensurePresenceSchema()
  const rows = (await sql`
    INSERT INTO user_presence (participant_kind, participant_id, manual_status, last_seen_at, updated_at)
    VALUES (${actor.kind}, ${actor.id}, ${manualStatus}, NOW(), NOW())
    ON CONFLICT (participant_kind, participant_id)
    DO UPDATE SET
      manual_status = ${manualStatus},
      last_seen_at = NOW(),
      updated_at = NOW()
    RETURNING manual_status, last_seen_at
  `) as Array<{ manual_status: ManualPresenceStatus | null; last_seen_at: string }>
  return rowToRecord(actor.kind, actor.id, rows[0])
}

export async function getPresence(kind: ParticipantKind, id: number): Promise<PresenceRecord> {
  await ensurePresenceSchema()
  const rows = (await sql`
    SELECT manual_status, last_seen_at
    FROM user_presence
    WHERE participant_kind = ${kind} AND participant_id = ${id}
    LIMIT 1
  `) as Array<{ manual_status: ManualPresenceStatus | null; last_seen_at: string | null }>
  return rowToRecord(kind, id, rows[0])
}

export async function getPresenceBatch(
  participants: Array<{ kind: ParticipantKind; id: number }>,
): Promise<PresenceRecord[]> {
  if (participants.length === 0) return []
  return Promise.all(participants.map((p) => getPresence(p.kind, p.id)))
}

export { resolveEffectiveStatus }
