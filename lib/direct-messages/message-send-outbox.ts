import type { MessageAttachmentDraft } from "@/lib/direct-messages/attachments"

const OUTBOX_KEY = "cc-dm-send-outbox-v1"

export type MessageSendOutboxEntry = {
  id: string
  createdAt: string
  threadId: number | null
  recipientKind?: "student" | "instructor"
  recipientId?: number
  subject?: string | null
  bodyHtml: string
  attachments: MessageAttachmentDraft[]
  sendUrl: string
}

function readOutbox(): MessageSendOutboxEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(OUTBOX_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as MessageSendOutboxEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeOutbox(entries: MessageSendOutboxEntry[]): void {
  if (typeof window === "undefined") return
  try {
    if (entries.length === 0) {
      window.localStorage.removeItem(OUTBOX_KEY)
      return
    }
    window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(entries.slice(0, 5)))
  } catch {
    // ignore quota
  }
}

export function listMessageSendOutbox(): MessageSendOutboxEntry[] {
  return readOutbox()
}

export function saveMessageSendOutbox(entry: Omit<MessageSendOutboxEntry, "id" | "createdAt">): void {
  const next: MessageSendOutboxEntry = {
    ...entry,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}`,
    createdAt: new Date().toISOString(),
  }
  writeOutbox([next, ...readOutbox().filter((e) => e.id !== next.id)].slice(0, 5))
}

export function clearMessageSendOutbox(id: string): void {
  writeOutbox(readOutbox().filter((e) => e.id !== id))
}

export function clearAllMessageSendOutbox(): void {
  writeOutbox([])
}
