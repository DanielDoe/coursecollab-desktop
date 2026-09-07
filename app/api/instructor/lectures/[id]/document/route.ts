import { NextRequest, NextResponse } from "next/server"
import { mkdir, writeFile, readFile } from "fs/promises"
import path from "path"
import os from "os"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { convertOfficeFileToPdf } from "@/lib/convert-office-to-pdf"
import { savePublicUpload, unlinkPublicUploadUrl } from "@/lib/blob-or-local-public"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const ALLOWED = new Set(["pdf", "ppt", "pptx"])
function extFromName(name: string): string {
  const e = path.extname(name).toLowerCase().replace(/^\./, "")
  return e
}

function sanitizeBaseName(name: string): string {
  const base = path.basename(name, path.extname(name))
  return base.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "deck"
}

async function lectureDocumentWorkDir(lectureId: number): Promise<string> {
  return path.join(os.tmpdir(), "lecture-documents", String(lectureId))
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const { id } = await params
    const lectureId = Number.parseInt(id, 10)
    if (!Number.isFinite(lectureId)) {
      return NextResponse.json({ error: "Invalid lecture id" }, { status: 400 })
    }

    const courseId = scope.course.id

    const existing = await sql`
      SELECT id, pdf_url, original_file_url
      FROM lectures
      WHERE id = ${lectureId}
        AND deleted_at IS NULL
        AND (course_id = ${courseId} OR course_id IS NULL)
      LIMIT 1
    `
    if (existing.length === 0) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File) || file.size < 1) {
      return NextResponse.json({ error: "file required" }, { status: 400 })
    }

    const origName = file.name || "upload"
    const ext = extFromName(origName)
    if (!ALLOWED.has(ext)) {
      return NextResponse.json(
        { error: "Only PDF, PPT, or PPTX files are allowed" },
        { status: 400 },
      )
    }

    const folder = await lectureDocumentWorkDir(lectureId)
    await mkdir(folder, { recursive: true })

    const stamp = Date.now()
    const base = `${sanitizeBaseName(origName)}-${stamp}`

    const buffer = Buffer.from(await file.arrayBuffer())

    let pdfUrl: string
    let originalUrl: string
    let originalType: string
    let contentMode: "pdf" | "ppt_converted_pdf"

    if (ext === "pdf") {
      const destName = `${base}.pdf`
      pdfUrl = await savePublicUpload({
        blobKey: `lecture-documents/${lectureId}/${destName}`,
        relativePublicPath: `uploads/lecture-documents/${lectureId}/${destName}`,
        bytes: buffer,
        contentType: "application/pdf",
      })
      originalUrl = pdfUrl
      originalType = "application/pdf"
      contentMode = "pdf"
    } else {
      const destName = `${base}.${ext}`
      const officePath = path.join(folder, destName)
      await writeFile(officePath, buffer)
      originalType =
        ext === "pptx"
          ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
          : "application/vnd.ms-powerpoint"

      const conv = await convertOfficeFileToPdf(officePath, folder)
      if (!conv.ok) {
        return NextResponse.json(
          {
            error: "Could not convert presentation to PDF. Upload a PDF, or install LibreOffice on the server and set LIBREOFFICE_PATH.",
            details: conv.reason,
          },
          { status: 422 },
        )
      }

      const convBase = path.basename(conv.pdfPath)
      const pdfBytes = await readFile(conv.pdfPath)

      pdfUrl = await savePublicUpload({
        blobKey: `lecture-documents/${lectureId}/${convBase}`,
        relativePublicPath: `uploads/lecture-documents/${lectureId}/${convBase}`,
        bytes: pdfBytes,
        contentType: "application/pdf",
      })
      originalUrl = await savePublicUpload({
        blobKey: `lecture-documents/${lectureId}/${destName}`,
        relativePublicPath: `uploads/lecture-documents/${lectureId}/${destName}`,
        bytes: buffer,
        contentType: originalType,
      })
      contentMode = "ppt_converted_pdf"
    }

    const prev = existing[0] as { pdf_url?: string | null; original_file_url?: string | null }
    await unlinkPublicUploadUrl(prev.pdf_url)
    await unlinkPublicUploadUrl(prev.original_file_url)

    const updated = await sql`
      UPDATE lectures
      SET
        pdf_url = ${pdfUrl},
        original_file_url = ${originalUrl},
        original_file_type = ${originalType},
        content_mode = ${contentMode},
        course_id = ${courseId},
        updated_at = NOW()
      WHERE id = ${lectureId}
        AND (course_id = ${courseId} OR course_id IS NULL)
      RETURNING id, pdf_url, original_file_url, original_file_type, content_mode, allow_download, is_published
    `

    return NextResponse.json({ lecture: updated[0], message: "Lecture document uploaded" })
  } catch (error) {
    console.error("[Lecture document POST]", error)
    return NextResponse.json(
      { error: "Upload failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const { id } = await params
    const lectureId = Number.parseInt(id, 10)
    if (!Number.isFinite(lectureId)) {
      return NextResponse.json({ error: "Invalid lecture id" }, { status: 400 })
    }

    const courseId = scope.course.id

    const rows = await sql`
      SELECT pdf_url, original_file_url
      FROM lectures
      WHERE id = ${lectureId}
        AND deleted_at IS NULL
        AND (course_id = ${courseId} OR course_id IS NULL)
      LIMIT 1
    `
    if (rows.length === 0) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 })
    }

    const row = rows[0] as { pdf_url: string | null; original_file_url: string | null }
    await unlinkPublicUploadUrl(row.pdf_url)
    await unlinkPublicUploadUrl(row.original_file_url)

    const updated = await sql`
      UPDATE lectures
      SET
        pdf_url = NULL,
        original_file_url = NULL,
        original_file_type = NULL,
        thumbnail_url = NULL,
        content_mode = 'html_legacy',
        course_id = ${courseId},
        updated_at = NOW()
      WHERE id = ${lectureId}
        AND (course_id = ${courseId} OR course_id IS NULL)
      RETURNING id, pdf_url, content_mode
    `

    return NextResponse.json({ lecture: updated[0], message: "Lecture document removed" })
  } catch (error) {
    console.error("[Lecture document DELETE]", error)
    return NextResponse.json({ error: "Failed to remove document" }, { status: 500 })
  }
}
