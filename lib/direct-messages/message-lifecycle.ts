/** iMessage-style windows for undo send and edit. */
export const DM_UNSEND_WINDOW_MS = 2 * 60 * 1000
export const DM_EDIT_WINDOW_MS = 15 * 60 * 1000

export type MessageDeleteMode = "unsend" | "hide"

export function messageAgeMs(createdAt: string, now = Date.now()): number {
  const ts = new Date(createdAt).getTime()
  if (!Number.isFinite(ts)) return Number.POSITIVE_INFINITY
  return Math.max(0, now - ts)
}

export function canUnsendMessage(params: {
  createdAt: string
  isMine: boolean
  unsentAt?: string | null
  hasAttachments?: boolean
  now?: number
}): boolean {
  if (!params.isMine || params.unsentAt) return false
  if (params.hasAttachments) return false
  return messageAgeMs(params.createdAt, params.now) <= DM_UNSEND_WINDOW_MS
}

export function canEditMessage(params: {
  createdAt: string
  isMine: boolean
  unsentAt?: string | null
  hasAttachments?: boolean
  now?: number
}): boolean {
  if (!params.isMine || params.unsentAt) return false
  if (params.hasAttachments) return false
  return messageAgeMs(params.createdAt, params.now) <= DM_EDIT_WINDOW_MS
}

export function unsentAuditLabel(isMine: boolean, senderName?: string): string {
  if (isMine) return "You unsent a message"
  const name = senderName?.trim()
  return name ? `${name} unsent a message` : "Message unsent"
}
