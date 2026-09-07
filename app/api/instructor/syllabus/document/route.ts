import { type NextRequest, NextResponse } from "next/server"
import path from "path"
import { sql } from "@/lib/db"
import { requireCoursePermission } from "@/lib/course-permission-guard"
import { readInstructorSessionScopeFromRequest } from "@/lib/instructor-session-scope"
import { getOrCreateSyllabusForCourse } from "@/lib/syllabus/syllabus-service"
import { savePublicUpload } from "@/lib/blob-or-local-public"
import {
  sanitizeSyllabusPdfFileName,
  syllabusUploadRelativeFolder,
  unlinkSyllabusPublicUrl,
} from "@/lib/syllabus/syllabus-pdf"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function extFromName(name: string): string {
  return path.extname(name).toLowerCase().replace(/^\./, "")
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireCoursePermission(
      request,
      ["manage_syllabus", "manage_course_settings"],
      "You do not have permission to upload a syllabus PDF.",
    )
    if (!scope.ok) return scope.response

    const courseId = scope.course.id
    const sessionScope = readInstructorSessionScopeFromRequest(request)
    const sessionId = sessionScope.sessionId
    await getOrCreateSyllabusForCourse(courseId, scope.instructorId, sessionId)

    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File) || file.size < 1) {
      return NextResponse.json({ error: "PDF file is required" }, { status: 400 })
    }

    const origName = file.name || "syllabus.pdf"
    if (extFromName(origName) !== "pdf") {
      return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 })
    }

    const existing = await sql`
      SELECT pdf_url FROM course_syllabi
      WHERE course_id = ${courseId}
        AND (
          (${sessionId}::int IS NULL AND session_id IS NULL)
          OR session_id = ${sessionId}
        )
      LIMIT 1
    `
    const prevUrl = (existing[0] as { pdf_url?: string | null } | undefined)?.pdf_url

    const destName = sanitizeSyllabusPdfFileName(origName)
    const buffer = Buffer.from(await file.arrayBuffer())
    const relativePath = `${syllabusUploadRelativeFolder(courseId)}/${destName}`
    const pdfUrl = await savePublicUpload({
      blobKey: `syllabus-documents/${courseId}/${destName}`,
      relativePublicPath: relativePath,
      bytes: buffer,
      contentType: "application/pdf",
    })
    await unlinkSyllabusPublicUrl(prevUrl)

    await sql`
      UPDATE course_syllabi
      SET
        pdf_url = ${pdfUrl},
        pdf_file_name = ${origName},
        content_mode = 'pdf',
        updated_by = ${scope.instructorId},
        updated_at = NOW()
      WHERE course_id = ${courseId}
        AND (
          (${sessionId}::int IS NULL AND session_id IS NULL)
          OR session_id = ${sessionId}
        )
    `

    const { getSyllabusByCourseId } = await import("@/lib/syllabus/syllabus-service")
    const syllabus = await getSyllabusByCourseId(courseId, sessionId)

    return NextResponse.json({ success: true, syllabus, pdfUrl })
  } catch (error) {
    console.error("[Instructor Syllabus Document] POST failed:", error)
    return NextResponse.json({ error: "Failed to upload syllabus PDF" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const scope = await requireCoursePermission(
      request,
      ["manage_syllabus", "manage_course_settings"],
      "You do not have permission to remove the syllabus PDF.",
    )
    if (!scope.ok) return scope.response

    const courseId = scope.course.id
    const sessionScope = readInstructorSessionScopeFromRequest(request)
    const sessionId = sessionScope.sessionId
    const existing = await sql`
      SELECT pdf_url FROM course_syllabi
      WHERE course_id = ${courseId}
        AND (
          (${sessionId}::int IS NULL AND session_id IS NULL)
          OR session_id = ${sessionId}
        )
      LIMIT 1
    `
    if (!existing.length) {
      return NextResponse.json({ error: "Syllabus not found" }, { status: 404 })
    }

    const prevUrl = (existing[0] as { pdf_url?: string | null }).pdf_url
    await unlinkSyllabusPublicUrl(prevUrl)

    await sql`
      UPDATE course_syllabi
      SET
        pdf_url = NULL,
        pdf_file_name = NULL,
        content_mode = 'structured',
        updated_by = ${scope.instructorId},
        updated_at = NOW()
      WHERE course_id = ${courseId}
        AND (
          (${sessionId}::int IS NULL AND session_id IS NULL)
          OR session_id = ${sessionId}
        )
    `

    const { getSyllabusByCourseId } = await import("@/lib/syllabus/syllabus-service")
    const syllabus = await getSyllabusByCourseId(courseId, sessionId)

    return NextResponse.json({ success: true, syllabus })
  } catch (error) {
    console.error("[Instructor Syllabus Document] DELETE failed:", error)
    return NextResponse.json({ error: "Failed to remove syllabus PDF" }, { status: 500 })
  }
}
