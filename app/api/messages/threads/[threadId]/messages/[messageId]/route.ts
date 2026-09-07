import { type NextRequest, NextResponse } from "next/server"
import { resolveMessageActor } from "@/lib/direct-messages/auth"
import {
  deleteMessageForActor,
  editMessageForActor,
} from "@/lib/direct-messages/service"
import type { MessageDeleteMode } from "@/lib/direct-messages/message-lifecycle"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = { params: Promise<{ threadId: string; messageId: string }> }

function parseDeleteMode(value: string | null): MessageDeleteMode {
  return value === "unsend" ? "unsend" : "hide"
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const actor = await resolveMessageActor(request)
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { threadId: threadRaw, messageId: messageRaw } = await context.params
    const threadId = Number(threadRaw)
    const messageId = Number(messageRaw)
    if (!Number.isFinite(threadId) || threadId <= 0 || !Number.isFinite(messageId) || messageId <= 0) {
      return NextResponse.json({ error: "Invalid message" }, { status: 400 })
    }

    const body = (await request.json()) as { body?: string }
    if (!body.body?.trim()) {
      return NextResponse.json({ error: "Message body is required" }, { status: 400 })
    }

    const result = await editMessageForActor(threadId, messageId, actor, body.body)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to edit message"
    const status =
      message === "Message not found" || message === "Thread not found" ? 404 : 400
    console.error("[messages/[messageId] PATCH]", error)
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const actor = await resolveMessageActor(request)
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { threadId: threadRaw, messageId: messageRaw } = await context.params
    const threadId = Number(threadRaw)
    const messageId = Number(messageRaw)
    if (!Number.isFinite(threadId) || threadId <= 0 || !Number.isFinite(messageId) || messageId <= 0) {
      return NextResponse.json({ error: "Invalid message" }, { status: 400 })
    }

    const mode = parseDeleteMode(request.nextUrl.searchParams.get("mode"))
    const result = await deleteMessageForActor(threadId, messageId, actor, mode)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete message"
    const status =
      message === "Message not found" || message === "Thread not found" ? 404 : 400
    console.error("[messages/[messageId] DELETE]", error)
    return NextResponse.json({ error: message }, { status })
  }
}
