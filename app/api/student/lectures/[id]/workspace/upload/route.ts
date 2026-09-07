import { type NextRequest, NextResponse } from "next/server"
import { saveLectureWorkspaceSolutionFile } from "@/lib/quiz-solution-storage"
import { isLectureAccessibleToStudent } from "@/lib/student-lecture-access"
import { requireStudentLectureCaller } from "@/lib/require-student-lecture-auth"
import { heicJpegFileName, isHeicMimeOrName } from "@/lib/heic-image"
import { convertHeicBufferToJpeg } from "@/lib/heic-convert-server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_BYTES = 25 * 1024 * 1024

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "image/heic",
  "image/heif",
])

function inferUploadMime(file: File): string {
  const fromType = (file.type || "").toLowerCase().split(";")[0]?.trim()
  if (fromType && ALLOWED_MIME.has(fromType)) return fromType
  const name = (file.name || "").toLowerCase()
  if (name.endsWith(".png")) return "image/png"
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg"
  if (name.endsWith(".webp")) return "image/webp"
  if (name.endsWith(".gif")) return "image/gif"
  if (name.endsWith(".pdf")) return "application/pdf"
  if (name.endsWith(".heic")) return "image/heic"
  if (name.endsWith(".heif")) return "image/heif"
  return fromType || ""
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const lectureId = Number.parseInt(id, 10)
    if (!Number.isFinite(lectureId)) {
      return NextResponse.json({ error: "Invalid lecture id" }, { status: 400 })
    }

    const formData = await request.formData()
    const rawStudent = String(formData.get("studentId") ?? formData.get("studentDatabaseId") ?? "").trim()
    const workspaceQuestionId = String(formData.get("workspaceQuestionId") ?? "").trim()
    const partId = String(formData.get("partId") ?? "_").trim() || "_"
    const file = formData.get("file") as File | null

    const auth = await requireStudentLectureCaller(request, rawStudent || null)
    if (!auth.ok) return auth.response
    if (!workspaceQuestionId) {
      return NextResponse.json({ error: "workspaceQuestionId required" }, { status: 400 })
    }
    if (!file || file.size <= 0) {
      return NextResponse.json({ error: "file required" }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File must be 25 MB or smaller" }, { status: 400 })
    }

    const mime = inferUploadMime(file)
    if (!mime || !ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { error: "Allowed types: PNG, JPEG, WebP, GIF, PDF, HEIC" },
        { status: 400 },
      )
    }

    const studentDbId = auth.studentDbId
    const allowed = await isLectureAccessibleToStudent(auth.sessionRow.student_id, lectureId)
    if (!allowed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    let uploadFile: File = file
    let storedMime = mime
    if (isHeicMimeOrName(mime, file.name)) {
      const buf = Buffer.from(await file.arrayBuffer())
      const jpeg = await convertHeicBufferToJpeg(buf)
      storedMime = "image/jpeg"
      uploadFile = new File([jpeg], heicJpegFileName(file.name), { type: storedMime })
    }

    const saved = await saveLectureWorkspaceSolutionFile(
      studentDbId,
      lectureId,
      workspaceQuestionId,
      partId,
      uploadFile,
    )

    return NextResponse.json({
      url: saved.url,
      name: saved.name,
      mime: saved.mime,
      uploaded_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[Student lecture workspace upload]", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
