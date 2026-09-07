import { type NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import path from "path"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { savePublicUpload } from "@/lib/blob-or-local-public"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BYTES = 25 * 1024 * 1024

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
])

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "File is required" }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds 25MB limit" }, { status: 400 })
    }
    if (file.type && !ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 })
    }

    const ext = path.extname(file.name) || ""
    const safeBase = path.basename(file.name, ext).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80)
    const storedName = `${randomUUID()}-${safeBase}${ext}`
    const courseId = scope.course.id
    const bytes = Buffer.from(await file.arrayBuffer())

    const url = await savePublicUpload({
      blobKey: `announcements/${courseId}/${storedName}`,
      relativePublicPath: `uploads/announcements/${courseId}/${storedName}`,
      bytes,
      contentType: file.type || undefined,
    })

    return NextResponse.json({
      name: file.name,
      url,
      type: file.type || "application/octet-stream",
    })
  } catch (error) {
    console.error("[Announcements upload]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    )
  }
}
