const STORAGE_KEY = "guest_cora_conversations_v1"

export type GuestCoraThreadMemory = {
  summary?: string
  lastUserTopic?: string
  lastMatchScore?: number
  lastApplicationId?: number
  updatedAt?: string
}

export type GuestCoraConversation = {
  id: string
  title: string
  updatedAt: string
  messages: Array<{ role: "user" | "assistant"; content: string }>
  memory?: GuestCoraThreadMemory
}

function readAll(): GuestCoraConversation[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as GuestCoraConversation[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(conversations: GuestCoraConversation[]) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.slice(0, 40)))
}

export function listGuestCoraConversations(): GuestCoraConversation[] {
  return readAll().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function getGuestCoraConversation(id: string): GuestCoraConversation | null {
  return readAll().find((c) => c.id === id) ?? null
}

export function saveGuestCoraConversation(conversation: GuestCoraConversation) {
  const all = readAll().filter((c) => c.id !== conversation.id)
  writeAll([conversation, ...all])
}

export function updateGuestCoraThreadMemory(id: string, patch: Partial<GuestCoraThreadMemory>) {
  const conv = getGuestCoraConversation(id)
  if (!conv) return
  saveGuestCoraConversation({
    ...conv,
    memory: {
      ...conv.memory,
      ...patch,
      updatedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  })
}

export function deleteGuestCoraConversation(id: string) {
  writeAll(readAll().filter((c) => c.id !== id))
}

export function createGuestCoraConversation(title = "New conversation"): GuestCoraConversation {
  const conv: GuestCoraConversation = {
    id: `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    updatedAt: new Date().toISOString(),
    messages: [],
    memory: {},
  }
  saveGuestCoraConversation(conv)
  return conv
}
