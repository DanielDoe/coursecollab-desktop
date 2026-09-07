/** Client-side Cora workspace conversation persistence (localStorage, per student). */

export type StoredCoraMessageVersion = {
  content: string
  importedQuestion?: unknown
  importedQuestionLabel?: string
  assistantContent?: string
}

export type StoredCoraMessage = {
  id: string
  role: "student" | "ai"
  content: string
  timestamp: string
  topic?: string
  isBookmarked?: boolean
  lessonBlock?: Record<string, string>
  importedQuestion?: unknown
  importedQuestionLabel?: string
  versions?: StoredCoraMessageVersion[]
  activeVersionIndex?: number
  /** Confirm cards — persisted so refresh / cross-device sync keeps them. */
  proposals?: unknown[]
  proposalStatusById?: Record<string, string>
  proposalResultById?: Record<string, unknown>
}

export type StoredCoraConversation = {
  id: string
  title: string
  messages: StoredCoraMessage[]
  createdAt: string
  lastUpdated: string
  archivedAt?: string
  capabilityId?: string
}

const LEGACY_KEY = "aiTutorConversations"

export function coraConversationsStorageKey(studentId: string): string {
  return `coraWorkspaceConversations:${studentId}`
}

function reviveConversation(raw: StoredCoraConversation) {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt),
    lastUpdated: new Date(raw.lastUpdated),
    archivedAt: raw.archivedAt ? new Date(raw.archivedAt) : undefined,
    messages: raw.messages.map((msg) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    })),
  }
}

function readStoredConversations(key: string): StoredCoraConversation[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredCoraConversation[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Merge conversation lists — newest `lastUpdated` wins per id. */
export function mergeCoraConversations<
  T extends { id: string; lastUpdated: Date | string },
>(...lists: T[][]): T[] {
  const byId = new Map<string, T>()
  for (const list of lists) {
    for (const conversation of list) {
      if (!conversation?.id) continue
      const existing = byId.get(conversation.id)
      if (!existing) {
        byId.set(conversation.id, conversation)
        continue
      }
      const existingTime = new Date(existing.lastUpdated).getTime()
      const nextTime = new Date(conversation.lastUpdated).getTime()
      if (nextTime >= existingTime) byId.set(conversation.id, conversation)
    }
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
  )
}

export function loadCoraConversationsFromStorage(studentId: string | undefined | null) {
  if (typeof window === "undefined" || !studentId) return []

  const canonicalKey = coraConversationsStorageKey(studentId)
  const keys = new Set<string>([canonicalKey, LEGACY_KEY])
  const rosterId = sessionStorage.getItem("studentId")
  if (rosterId && rosterId !== studentId) {
    keys.add(coraConversationsStorageKey(rosterId))
  }

  const mergedRaw = mergeCoraConversations(
    ...[...keys].map((key) => readStoredConversations(key)),
  )

  if (mergedRaw.length === 0) return []

  const revived = mergedRaw.map(reviveConversation)
  const canonicalStored = readStoredConversations(canonicalKey)
  if (canonicalStored.length !== mergedRaw.length) {
    localStorage.setItem(canonicalKey, JSON.stringify(mergedRaw))
  }

  return revived
}

export function saveCoraConversationsToStorage(
  studentId: string | undefined | null,
  conversations: StoredCoraConversation[],
) {
  if (typeof window === "undefined" || !studentId) return
  const key = coraConversationsStorageKey(studentId)
  localStorage.setItem(key, JSON.stringify(conversations))
}

export function serializeCoraConversations<
  T extends {
    id: string
    title: string
    messages: Array<{
      id: string
      role: "student" | "ai"
      content: string
      timestamp: Date
      topic?: string
      isBookmarked?: boolean
      lessonBlock?: Record<string, string>
      importedQuestion?: unknown
      importedQuestionLabel?: string
      versions?: StoredCoraMessageVersion[]
      activeVersionIndex?: number
      proposals?: unknown[]
      proposalStatusById?: Record<string, string>
      proposalResultById?: Record<string, unknown>
    }>
    createdAt: Date
    lastUpdated: Date
    archivedAt?: Date | string | null
    capabilityId?: string
  },
>(conversations: T[]): StoredCoraConversation[] {
  return conversations.map((conv) => ({
    id: conv.id,
    title: conv.title,
    createdAt: conv.createdAt.toISOString(),
    lastUpdated: conv.lastUpdated.toISOString(),
    archivedAt: conv.archivedAt
      ? (conv.archivedAt instanceof Date ? conv.archivedAt.toISOString() : conv.archivedAt)
      : undefined,
    capabilityId: conv.capabilityId,
    messages: conv.messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp.toISOString(),
      topic: msg.topic,
      isBookmarked: msg.isBookmarked,
      lessonBlock: msg.lessonBlock,
      importedQuestion: msg.importedQuestion,
      importedQuestionLabel: msg.importedQuestionLabel,
      versions: msg.versions,
      activeVersionIndex: msg.activeVersionIndex,
      ...(msg.proposals?.length ? { proposals: msg.proposals } : {}),
      ...(msg.proposalStatusById ? { proposalStatusById: msg.proposalStatusById } : {}),
      ...(msg.proposalResultById ? { proposalResultById: msg.proposalResultById } : {}),
    })),
  }))
}

export function reviveStoredCoraConversation(stored: StoredCoraConversation) {
  return {
    id: stored.id,
    title: stored.title,
    createdAt: new Date(stored.createdAt),
    lastUpdated: new Date(stored.lastUpdated),
    archivedAt: stored.archivedAt ? new Date(stored.archivedAt) : undefined,
    capabilityId: stored.capabilityId,
    messages: (stored.messages ?? []).map((msg) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    })),
  }
}

export function activeCoraConversations<T extends { archivedAt?: Date | string | null }>(
  conversations: T[],
): T[] {
  return conversations.filter((c) => !c.archivedAt)
}

export function archivedCoraConversations<T extends { archivedAt?: Date | string | null }>(
  conversations: T[],
): T[] {
  return conversations.filter((c) => Boolean(c.archivedAt))
}

export function findCoraConversationForCapability<
  T extends { capabilityId?: string; archivedAt?: Date | string | null; lastUpdated: Date | string },
>(conversations: T[], capabilityId: string): T | undefined {
  const matches = conversations
    .filter((c) => c.capabilityId === capabilityId && !c.archivedAt)
    .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
  return matches[0]
}
