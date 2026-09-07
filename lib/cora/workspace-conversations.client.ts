"use client"

import { getStudentAuthHeaders } from "@/lib/auth"
import type { StoredCoraConversation } from "@/lib/cora/conversation-storage"

function reviveStoredConversation(raw: StoredCoraConversation) {
  return {
    ...raw,
    createdAt: raw.createdAt,
    lastUpdated: raw.lastUpdated,
    messages: (raw.messages ?? []).map((msg) => ({
      ...msg,
      timestamp: typeof msg.timestamp === "string" ? msg.timestamp : new Date(msg.timestamp).toISOString(),
    })),
  }
}

export async function fetchCoraWorkspaceConversationsFromApi(): Promise<StoredCoraConversation[]> {
  const res = await fetch("/api/cora/workspace-conversations", {
    headers: getStudentAuthHeaders(),
    credentials: "include",
  })
  if (res.status === 401) return []
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? "Failed to load Cora conversations")
  }
  const data = (await res.json()) as { conversations?: StoredCoraConversation[] }
  return (data.conversations ?? []).map(reviveStoredConversation)
}

export async function syncCoraWorkspaceConversationToApi(
  conversation: StoredCoraConversation,
): Promise<void> {
  const res = await fetch("/api/cora/workspace-conversations", {
    method: "PUT",
    headers: {
      ...getStudentAuthHeaders(),
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ conversation: reviveStoredConversation(conversation) }),
  })
  if (res.status === 401) return
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? "Failed to save Cora conversation")
  }
}

export async function syncCoraWorkspaceConversationsToApi(
  conversations: StoredCoraConversation[],
): Promise<void> {
  if (conversations.length === 0) return
  const res = await fetch("/api/cora/workspace-conversations", {
    method: "PUT",
    headers: {
      ...getStudentAuthHeaders(),
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      conversations: conversations.map(reviveStoredConversation),
    }),
  })
  if (res.status === 401) return
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? "Failed to sync Cora conversations")
  }
}

export async function deleteCoraWorkspaceConversationFromApi(threadId: string): Promise<void> {
  const res = await fetch(`/api/cora/workspace-conversations/${encodeURIComponent(threadId)}`, {
    method: "DELETE",
    headers: getStudentAuthHeaders(),
    credentials: "include",
  })
  if (res.status === 401) return
  if (!res.ok && res.status !== 404) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? "Failed to delete Cora conversation")
  }
}
