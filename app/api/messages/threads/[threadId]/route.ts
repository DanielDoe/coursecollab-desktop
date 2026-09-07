import { type NextRequest, NextResponse } from "next/server"
import { resolveMessageActor } from "@/lib/direct-messages/auth"
import { getThreadForActor, sendDirectMessage } from "@/lib/direct-messages/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = { params: Promise<{ threadId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const actor = await resolveMessageActor(request)
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { threadId: raw } = await context.params
    const threadId = Number(raw)
    if (!Number.isFinite(threadId) || threadId <= 0) {
      return NextResponse.json({ error: "Invalid thread" }, { status: 400 })
    }

    const thread = await getThreadForActor(threadId, actor)
    if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 })

    return NextResponse.json({ thread })
  } catch (error) {
    console.error("[messages/threads/[threadId] GET]", error)
    return NextResponse.json({ error: "Failed to load conversation" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const actor = await resolveMessageActor(request)
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { threadId: raw } = await context.params
    const threadId = Number(raw)
    if (!Number.isFinite(threadId) || threadId <= 0) {
      return NextResponse.json({ error: "Invalid thread" }, { status: 400 })
    }

    const body = (await request.json()) as {
      body?: string
      subject?: string | null
      attachments?: Array<{
        fileName: string
        fileUrl: string
        mimeType?: string | null
        fileSize?: number | null
      }>
    }
    if (!body.body?.trim() && (!body.attachments || body.attachments.length === 0)) {
      return NextResponse.json({ error: "Message body or attachment is required" }, { status: 400 })
    }

    const thread = await getThreadForActor(threadId, actor)
    if (!thread) return NextResponse.json({ error: "Thread not found" }, { status: 404 })

    const result = await sendDirectMessage({
      sender: actor,
      recipientKind: thread.otherParticipant.kind,
      recipientId: thread.otherParticipant.id,
      subject: body.subject ?? thread.subject,
      body: body.body ?? "",
      attachments: body.attachments,
      existingThreadId: threadId,
    })

    const updated = await getThreadForActor(threadId, actor)
    return NextResponse.json({ ...result, thread: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send message"
    console.error("[messages/threads/[threadId] POST]", error)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
