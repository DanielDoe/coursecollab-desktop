/** A holder older than this has stopped heartbeating. Another device may enter. */
export const LIVE_HOLDER_FRESH_MS = 12_000

export type LiveEditorHoldSnapshot = {
  clientId: string | null
  seenAtMs: number | null
  left: boolean
}

export type LiveEditorHeldBy = {
  assignmentId: number
  clientId: string | null
  clientLabel: string
}

export function cleanLiveClientId(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim().slice(0, 80)
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(trimmed)) return null
  return trimmed
}

export function cleanLiveClientLabel(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim().slice(0, 40)
  return trimmed || null
}

/**
 * Another device is in this live editor. A normal join must not take it.
 * `claim` is the explicit "move it here" confirmation.
 * A seat with no client id has not been stamped yet, so the editor already in
 * the room can take it on its next heartbeat. After that stamp, a second device is asked.
 */
export function liveHoldBlocksJoin(input: {
  hold: LiveEditorHoldSnapshot | null
  myClientId: string | null
  now: number
  claim: boolean
}): boolean {
  if (input.claim) return false
  const hold = input.hold
  if (!hold || hold.left) return false
  if (hold.seenAtMs == null || !Number.isFinite(hold.seenAtMs)) return false
  if (input.now - hold.seenAtMs > LIVE_HOLDER_FRESH_MS) return false
  if (!hold.clientId) return false
  if (input.myClientId && hold.clientId === input.myClientId) return false
  return true
}

/**
 * A leave from a device that no longer holds the editor must not mark the
 * student as gone after the session moved.
 */
export function leaveShouldReleaseHolder(holderClientId: string | null, leavingClientId: string | null): boolean {
  if (!holderClientId) return true
  if (!leavingClientId) return false
  return holderClientId === leavingClientId
}

export function heldByFromRow(input: {
  assignmentId: number
  clientId: string | null
  clientLabel: string | null
}): LiveEditorHeldBy {
  return {
    assignmentId: input.assignmentId,
    clientId: input.clientId,
    clientLabel: input.clientLabel?.trim() || "another device",
  }
}
