import { type NextRequest, NextResponse } from "next/server"
import { resolveMessageActor } from "@/lib/direct-messages/auth"
import { toggleMessageReaction } from "@/lib/direct-messages/reactions"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = { params: Promise<{ threadId: string; messageId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const actor = await resolveMessageActor(request)
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { threadId: threadRaw, messageId: messageRaw } = await context.params
    const threadId = Number(threadRaw)
    const messageId = Number(messageRaw)
    if (!Number.isFinite(messageId) || messageId <= 0) {
      return NextResponse.json({ error: "Invalid message" }, { status: 400 })
    }

    const body = (await request.json()) as { emoji?: string }
    if (!body.emoji?.trim()) {
      return NextResponse.json({ error: "Emoji is required" }, { status: 400 })
    }

    const result = await toggleMessageReaction(messageId, actor, body.emoji.trim())
    if (result.threadId !== threadId) {
      return NextResponse.json({ error: "Message not in this thread" }, { status: 400 })
    }

    return NextResponse.json({ messageId, reactions: result.reactions })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to react"
    console.error("[messages/reactions POST]", error)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
