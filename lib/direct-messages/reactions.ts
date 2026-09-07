import { sql } from "@/lib/db"
import { ensureDirectMessagesSchema } from "@/lib/ensure-direct-messages-schema"
import {
  isValidMessageReactionEmoji,
  normalizeMessageReactionEmoji,
} from "@/lib/direct-messages/reaction-constants"
import type { MessageActor, MessageReactionGroup, ParticipantKind } from "@/lib/direct-messages/types"


export async function loadReactionsForMessages(
  messageIds: number[],
  actor: MessageActor,
): Promise<Map<number, MessageReactionGroup[]>> {
  const map = new Map<number, MessageReactionGroup[]>()
  if (messageIds.length === 0) return map

  await ensureDirectMessagesSchema()

  const rows = (await sql`
    SELECT
      message_id,
      emoji,
      COUNT(*)::int AS reaction_count,
      BOOL_OR(reactor_kind = ${actor.kind} AND reactor_id = ${actor.id}) AS reacted_by_me
    FROM dm_message_reactions
    WHERE message_id = ANY(${messageIds})
    GROUP BY message_id, emoji
    ORDER BY message_id, MIN(created_at) ASC
  `) as Array<{
    message_id: number
    emoji: string
    reaction_count: number
    reacted_by_me: boolean
  }>

  for (const row of rows) {
    const messageId = Number(row.message_id)
    const list = map.get(messageId) ?? []
    list.push({
      emoji: row.emoji,
      count: Number(row.reaction_count),
      reactedByMe: Boolean(row.reacted_by_me),
    })
    map.set(messageId, list)
  }

  return map
}

async function assertActorCanAccessMessage(
  messageId: number,
  actor: MessageActor,
): Promise<number> {
  const rows = (await sql`
    SELECT m.thread_id
    FROM dm_messages m
    INNER JOIN dm_participants p ON p.thread_id = m.thread_id
    WHERE m.id = ${messageId}
      AND p.participant_kind = ${actor.kind}
      AND p.participant_id = ${actor.id}
    LIMIT 1
  `) as Array<{ thread_id: number }>

  if (rows.length === 0) {
    throw new Error("Message not found")
  }

  return Number(rows[0].thread_id)
}

export async function toggleMessageReaction(
  messageId: number,
  actor: MessageActor,
  emoji: string,
): Promise<{ reactions: MessageReactionGroup[]; threadId: number }> {
  const normalized = normalizeMessageReactionEmoji(emoji)
  if (!isValidMessageReactionEmoji(normalized)) {
    throw new Error("Reaction not allowed")
  }

  await ensureDirectMessagesSchema()
  const threadId = await assertActorCanAccessMessage(messageId, actor)

  const existing = (await sql`
    SELECT id, emoji
    FROM dm_message_reactions
    WHERE message_id = ${messageId}
      AND reactor_kind = ${actor.kind}
      AND reactor_id = ${actor.id}
    LIMIT 1
  `) as Array<{ id: number; emoji: string }>

  if (existing.length === 0) {
    await sql`
      INSERT INTO dm_message_reactions (message_id, reactor_kind, reactor_id, emoji)
      VALUES (${messageId}, ${actor.kind}, ${actor.id}, ${normalized})
    `
  } else if (existing[0].emoji === normalized) {
    await sql`DELETE FROM dm_message_reactions WHERE id = ${existing[0].id}`
  } else {
    await sql`
      UPDATE dm_message_reactions
      SET emoji = ${normalized}, created_at = NOW()
      WHERE id = ${existing[0].id}
    `
  }

  const reactionMap = await loadReactionsForMessages([messageId], actor)
  return {
    threadId,
    reactions: reactionMap.get(Number(messageId)) ?? [],
  }
}

export type { ParticipantKind }
