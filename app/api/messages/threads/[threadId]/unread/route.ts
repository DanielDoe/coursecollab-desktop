import { type NextRequest, NextResponse } from "next/server"
import { resolveMessageActor } from "@/lib/direct-messages/auth"
import { markThreadUnreadForActor } from "@/lib/direct-messages/service"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteContext = { params: Promise<{ threadId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const actor = await resolveMessageActor(request)
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { threadId: raw } = await context.params
    const threadId = Number(raw)
    if (!Number.isFinite(threadId) || threadId <= 0) {
      return NextResponse.json({ error: "Invalid thread" }, { status: 400 })
    }

    const result = await markThreadUnreadForActor(threadId, actor)
    if (!result) return NextResponse.json({ error: "Thread not found" }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[messages/threads/[threadId]/unread POST]", error)
    return NextResponse.json({ error: "Failed to mark unread" }, { status: 500 })
  }
}
