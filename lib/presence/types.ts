import type { ParticipantKind } from "@/lib/direct-messages/types"

/** Manual status set by the user (Teams-style). */
export type ManualPresenceStatus = "available" | "busy" | "dnd" | "away" | "appear_offline"

/** Resolved status shown on avatars. */
export type PresenceStatus = "available" | "busy" | "dnd" | "away" | "offline"

export type PresenceRecord = {
  kind: ParticipantKind
  id: number
  status: PresenceStatus
  manualStatus: ManualPresenceStatus | null
  lastSeenAt: string | null
}

export type PresenceMap = Record<string, PresenceStatus>

export function presenceKey(kind: ParticipantKind, id: number): string {
  return `${kind}:${id}`
}

export function parsePresenceKey(key: string): { kind: ParticipantKind; id: number } | null {
  const [kind, idRaw] = key.split(":")
  if ((kind !== "student" && kind !== "instructor") || !idRaw) return null
  const id = Number(idRaw)
  if (!Number.isFinite(id) || id <= 0) return null
  return { kind, id }
}
