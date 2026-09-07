import { type NextRequest, NextResponse } from "next/server"
import path from "path"
import { randomUUID } from "crypto"
import { resolveMessageActor } from "@/lib/direct-messages/auth"
import { savePublicUpload } from "@/lib/blob-or-local-public"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
])

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "attachment"
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveMessageActor(request)
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file || file.size <= 0) {
      return NextResponse.json({ error: "File required" }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File must be 10MB or smaller" }, { status: 400 })
    }
    const mime = file.type || "application/octet-stream"
    if (!ALLOWED.has(mime)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 })
    }

    const ext = path.extname(file.name) || ""
    const fname = safeName(`${Date.now()}-${randomUUID().slice(0, 8)}${ext}`)
    const buf = Buffer.from(await file.arrayBuffer())
    const relativePublicPath = `uploads/messages/${actor.id}/${fname}`
    const fileUrl = await savePublicUpload({
      blobKey: `messages/${actor.id}/${fname}`,
      relativePublicPath,
      bytes: buf,
      contentType: mime,
    })

    return NextResponse.json({
      fileName: file.name,
      fileUrl,
      mimeType: mime,
      fileSize: file.size,
    })
  } catch (error) {
    console.error("[messages/attachments POST]", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
