import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { saveQuizSolutionFile, savePracticeSolutionFile } from "@/lib/quiz-solution-storage"
import { heicJpegFileName, isHeicMimeOrName } from "@/lib/heic-image"
import { convertHeicBufferToJpeg } from "@/lib/heic-convert-server"
import { requireInstructorGradingAccess } from "@/lib/instructor-grading-auth"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_BYTES_DEFAULT = 12 * 1024 * 1024
const MAX_BYTES_CIRCUIT_SUBMISSION = 25 * 1024 * 1024

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

/** Faculty upload of student solution files (recovery when student submit failed). Allows completed attempts. */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const attemptId = Number(formData.get("attemptId"))
    const questionId = Number(formData.get("questionId"))
    const partId = String(formData.get("partId") ?? "_").trim() || "_"
    const uploadKind = String(formData.get("uploadKind") ?? "").trim()
    const maxBytes = uploadKind === "circuit_submission" ? MAX_BYTES_CIRCUIT_SUBMISSION : MAX_BYTES_DEFAULT

    const file = formData.get("file") as File | null

    if (!Number.isFinite(attemptId) || attemptId <= 0) {
      return NextResponse.json({ error: "attemptId required" }, { status: 400 })
    }
    if (!Number.isFinite(questionId) || questionId <= 0) {
      return NextResponse.json({ error: "questionId required" }, { status: 400 })
    }
    if (!file || file.size <= 0) {
      return NextResponse.json({ error: "file required" }, { status: 400 })
    }
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `File must be ${Math.round(maxBytes / (1024 * 1024))} MB or smaller` },
        { status: 400 },
      )
    }

    const gradingAuth = await requireInstructorGradingAccess(request, { attemptId })
    if (!gradingAuth.ok) return gradingAuth.response

    const mime = inferUploadMime(file)
    if (!mime || !ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { error: "Allowed types: PNG, JPEG, WebP, GIF, PDF, HEIC" },
        { status: 400 },
      )
    }

    let uploadFile: File = file
    let storedMime = mime
    if (isHeicMimeOrName(mime, file.name)) {
      const jpeg = await convertHeicBufferToJpeg(Buffer.from(await file.arrayBuffer()))
      const jpegName = heicJpegFileName(file.name)
      uploadFile = new File([new Uint8Array(jpeg)], jpegName, { type: "image/jpeg" })
      storedMime = "image/jpeg"
    }

    const attemptRows = sqlRows(
      await sql`
        SELECT id, student_id
        FROM quiz_attempts
        WHERE id = ${attemptId}
        LIMIT 1
      `,
    )

    let isPracticeAttempt = false
    let studentDbId: number

    if (attemptRows.length === 0) {
      const practiceRows = sqlRows(
        await sql`
          SELECT id, student_id
          FROM practice_attempts
          WHERE id = ${attemptId}
          LIMIT 1
        `,
      )
      if (practiceRows.length === 0) {
        return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
      }
      isPracticeAttempt = true
      studentDbId = Number(practiceRows[0].student_id)
    } else {
      studentDbId = Number(attemptRows[0].student_id)
    }

    const saved = isPracticeAttempt
      ? await savePracticeSolutionFile(studentDbId, attemptId, questionId, partId, uploadFile)
      : await saveQuizSolutionFile(studentDbId, attemptId, questionId, partId, uploadFile)

    return NextResponse.json({
      url: saved.url,
      name: uploadFile.name,
      mime: storedMime,
      uploaded_at: new Date().toISOString(),
      part_id: partId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 16) || "_",
      uploaded_on_behalf_by: gradingAuth.instructorLabel,
    })
  } catch (e) {
    console.error("[instructor/quiz-solution-upload]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 },
    )
  }
}
