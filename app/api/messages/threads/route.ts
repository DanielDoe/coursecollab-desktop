import { type NextRequest, NextResponse } from "next/server"
import { stripHtmlToPlain } from "@/lib/direct-messages/html"
import { resolveMessageActor } from "@/lib/direct-messages/auth"
import { listThreadsForActor, sendDirectMessage } from "@/lib/direct-messages/service"
import type { ParticipantKind } from "@/lib/direct-messages/types"
import { readInstructorOfferingFromRequest } from "@/lib/instructor-session-scope"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveMessageActor(request)
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const threads = await listThreadsForActor(
      actor,
      actor.kind === "instructor" ? readInstructorOfferingFromRequest(request) : null,
    )
    return NextResponse.json({ threads })
  } catch (error) {
    console.error("[messages/threads GET]", error)
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveMessageActor(request)
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = (await request.json()) as {
      recipientKind?: ParticipantKind
      recipientId?: number
      subject?: string | null
      body?: string
      attachments?: Array<{
        fileName: string
        fileUrl: string
        mimeType?: string | null
        fileSize?: number | null
      }>
    }

    if (!body.recipientKind || !body.recipientId) {
      return NextResponse.json({ error: "Recipient is required" }, { status: 400 })
    }

    if (!stripHtmlToPlain(body.body ?? "") && (!body.attachments || body.attachments.length === 0)) {
      return NextResponse.json({ error: "Message body or attachment is required" }, { status: 400 })
    }

    if (body.recipientKind !== "student" && body.recipientKind !== "instructor") {
      return NextResponse.json({ error: "Invalid recipient" }, { status: 400 })
    }

    const result = await sendDirectMessage({
      sender: actor,
      recipientKind: body.recipientKind,
      recipientId: Number(body.recipientId),
      subject: body.subject ?? null,
      body: body.body ?? "",
      attachments: body.attachments,
      offering: actor.kind === "instructor" ? readInstructorOfferingFromRequest(request) : null,
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send message"
    console.error("[messages/threads POST]", error)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
