import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { saveClassroomSolutionFile } from "@/lib/quiz-solution-storage"
import { heicJpegFileName, isHeicMimeOrName } from "@/lib/heic-image"
import { convertHeicBufferToJpeg } from "@/lib/heic-convert-server"
import { isClassroomSolutionAssignment } from "@/lib/classroom-solution-submission"
import { CLASSROOM_SUBMISSION_IS_ACTIVE_SQL } from "@/lib/classroom-submission-availability-sql"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"

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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const rawStudent = String(formData.get("studentId") ?? formData.get("studentDatabaseId") ?? "").trim()
    const assignmentIdRaw = String(formData.get("assignmentId") ?? formData.get("attemptId") ?? "").trim()
    const partId = String(formData.get("partId") ?? "_").trim() || "_"
    const file = formData.get("file") as File | null

    const access = await requireBoundStudentCaller(request, rawStudent)
    if (!access.ok) return access.response
    const studentDbId = access.studentDbId

    const assignmentId = Number.parseInt(assignmentIdRaw, 10)
    if (!Number.isFinite(assignmentId)) {
      return NextResponse.json({ error: "assignmentId required" }, { status: 400 })
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

    try {
      await sql`ALTER TABLE classroom_point_submissions ADD COLUMN IF NOT EXISTS submission_kind TEXT NOT NULL DEFAULT 'code'`
    } catch {
      /* ignore */
    }

    const rows = await sql`
      SELECT id, submission_kind, duration_hours, created_at, due_at
      FROM classroom_point_submissions
      WHERE id = ${assignmentId}
        AND (${sql.unsafe(CLASSROOM_SUBMISSION_IS_ACTIVE_SQL)})
      LIMIT 1
    `
    if (rows.length === 0) {
      return NextResponse.json({ error: "Assignment not found or expired" }, { status: 404 })
    }
    if (!isClassroomSolutionAssignment((rows[0] as { submission_kind?: string }).submission_kind)) {
      return NextResponse.json({ error: "Not a solution submission assignment" }, { status: 400 })
    }

    let uploadFile: File = file
    let storedMime = mime
    if (isHeicMimeOrName(mime, file.name)) {
      const buf = Buffer.from(await file.arrayBuffer())
      const jpeg = await convertHeicBufferToJpeg(buf)
      storedMime = "image/jpeg"
      uploadFile = new File([jpeg], heicJpegFileName(file.name), { type: storedMime })
    }

    const saved = await saveClassroomSolutionFile(studentDbId, assignmentId, partId, uploadFile)

    return NextResponse.json({
      url: saved.url,
      name: saved.name,
      mime: saved.mime,
      uploaded_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[Classroom solution upload]", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
