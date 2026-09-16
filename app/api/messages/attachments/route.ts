import { type NextRequest, NextResponse } from "next/server"
import { resolveMessageActor } from "@/lib/direct-messages/auth"
import { saveMessageAttachmentFile } from "@/lib/direct-messages/message-attachment-storage"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveMessageActor(request)
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file || file.size <= 0) {
      return NextResponse.json({ error: "File required" }, { status: 400 })
    }

    const saved = await saveMessageAttachmentFile(actor, file)
    return NextResponse.json(saved)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed"
    console.error("[messages/attachments POST]", error)
    const status = message.includes("not allowed") || message.includes("10MB") ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
