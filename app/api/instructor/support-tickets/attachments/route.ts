import { type NextRequest, NextResponse } from "next/server"
import path from "path"
import { randomUUID } from "crypto"
import { loadInstructorActor } from "@/lib/instructor-actor-scope"
import { savePublicUpload } from "@/lib/blob-or-local-public"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const MAX_BYTES = 15 * 1024 * 1024
const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"])

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "attachment"
}

export async function POST(request: NextRequest) {
  try {
    const instructorIdRaw = request.headers.get("x-instructor-id")
    const instructorId = Number(instructorIdRaw)
    if (!Number.isFinite(instructorId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const actor = await loadInstructorActor(instructorId)
    if (!actor || actor.role === "ta") {
      return NextResponse.json({ error: "Instructor access required" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file || file.size <= 0) {
      return NextResponse.json({ error: "File required" }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File must be 15MB or smaller" }, { status: 400 })
    }
    const mime = (file.type || "").toLowerCase().split(";")[0]?.trim() || "application/octet-stream"
    if (!ALLOWED.has(mime)) {
      return NextResponse.json({ error: "Allowed types: PNG, JPEG, WebP, PDF" }, { status: 400 })
    }

    const ext = path.extname(file.name) || ""
    const fname = safeName(`${Date.now()}-${randomUUID()}${ext}`)
    const buf = Buffer.from(await file.arrayBuffer())
    const fileUrl = await savePublicUpload({
      blobKey: `support-tickets/instructor/${instructorId}/${fname}`,
      relativePublicPath: `uploads/support-tickets/instructor/${instructorId}/${fname}`,
      bytes: buf,
      contentType: mime,
    })

    return NextResponse.json({
      url: fileUrl,
      name: file.name,
      mime,
      size: file.size,
    })
  } catch (error) {
    console.error("[instructor/support-tickets/attachments POST]", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
