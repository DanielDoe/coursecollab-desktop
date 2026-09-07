import { type NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import type { StoredCoraConversation } from "@/lib/cora/conversation-storage"
import {
  listCoraWorkspaceThreads,
  upsertCoraWorkspaceThread,
  upsertCoraWorkspaceThreads,
} from "@/lib/cora/workspace-conversations.server"

export const dynamic = "force-dynamic"

function normalizeConversation(raw: unknown): StoredCoraConversation | null {
  if (!raw || typeof raw !== "object") return null
  const c = raw as StoredCoraConversation
  if (!c.id || typeof c.id !== "string") return null
  if (!c.title || typeof c.title !== "string") return null
  if (!Array.isArray(c.messages)) return null
  return {
    id: c.id,
    title: c.title,
    messages: c.messages,
    createdAt: c.createdAt ?? new Date().toISOString(),
    lastUpdated: c.lastUpdated ?? new Date().toISOString(),
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    const conversations = await listCoraWorkspaceThreads(auth.studentDbId)
    return NextResponse.json({ conversations })
  } catch (error) {
    console.error("[cora/workspace-conversations GET]", error)
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    const body = (await request.json()) as {
      conversation?: unknown
      conversations?: unknown[]
    }

    if (Array.isArray(body.conversations)) {
      const normalized = body.conversations
        .map(normalizeConversation)
        .filter((c): c is StoredCoraConversation => c != null)
      const saved = await upsertCoraWorkspaceThreads(auth.studentDbId, normalized)
      return NextResponse.json({ conversations: saved })
    }

    const one = normalizeConversation(body.conversation)
    if (!one) {
      return NextResponse.json({ error: "Invalid conversation payload" }, { status: 400 })
    }

    const saved = await upsertCoraWorkspaceThread(auth.studentDbId, one)
    return NextResponse.json({ conversation: saved })
  } catch (error) {
    console.error("[cora/workspace-conversations PUT]", error)
    return NextResponse.json({ error: "Failed to save conversation" }, { status: 500 })
  }
}
