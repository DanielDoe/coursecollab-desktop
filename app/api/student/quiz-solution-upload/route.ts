import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id"
import { saveQuizSolutionFile, savePracticeSolutionFile } from "@/lib/quiz-solution-storage"
import { heicJpegFileName, isHeicMimeOrName } from "@/lib/heic-image"
import { convertHeicBufferToJpeg } from "@/lib/heic-convert-server"

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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const rawStudent = String(formData.get("studentId") ?? formData.get("studentDatabaseId") ?? "").trim()
    const attemptId = Number(formData.get("attemptId"))
    const questionId = Number(formData.get("questionId"))
    const partId = String(formData.get("partId") ?? "_").trim() || "_"
    const uploadKind = String(formData.get("uploadKind") ?? "").trim()
    const maxBytes = uploadKind === "circuit_submission" ? MAX_BYTES_CIRCUIT_SUBMISSION : MAX_BYTES_DEFAULT

    const file = formData.get("file") as File | null

    if (!rawStudent) {
      return NextResponse.json({ error: "studentId required" }, { status: 401 })
    }
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

    const studentDbId = await resolveStudentDatabaseIdFromParam(rawStudent)
    if (studentDbId == null) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const attemptRows = sqlRows(
      await sql`
        SELECT id, student_id, completed_at
        FROM quiz_attempts
        WHERE id = ${attemptId} AND student_id = ${studentDbId}
        LIMIT 1
      `,
    )

    let isPracticeAttempt = false
    if (attemptRows.length === 0) {
      const practiceRows = sqlRows(
        await sql`
          SELECT id, student_id, completed_at
          FROM practice_attempts
          WHERE id = ${attemptId} AND student_id = ${studentDbId}
          LIMIT 1
        `,
      )
      if (practiceRows.length === 0) {
        return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
      }
      isPracticeAttempt = true
      if (practiceRows[0].completed_at) {
        return NextResponse.json({ error: "Attempt already submitted" }, { status: 403 })
      }
    } else if (attemptRows[0].completed_at) {
      return NextResponse.json({ error: "Attempt already submitted" }, { status: 403 })
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
    })
  } catch (e) {
    console.error("[quiz-solution-upload]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 },
    )
  }
}
