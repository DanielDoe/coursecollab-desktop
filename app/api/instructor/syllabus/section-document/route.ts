import { type NextRequest, NextResponse } from "next/server"
import path from "path"
import { sql } from "@/lib/db"
import { requireCoursePermission } from "@/lib/course-permission-guard"
import { readInstructorSessionScopeFromRequest } from "@/lib/instructor-session-scope"
import { getOrCreateSyllabusForCourse, getSyllabusByCourseId } from "@/lib/syllabus/syllabus-service"
import type { SyllabusSection } from "@/lib/syllabus/types"
import { savePublicUpload } from "@/lib/blob-or-local-public"
import {
  sanitizeSyllabusPdfFileName,
  syllabusUploadRelativeFolder,
  unlinkSyllabusPublicUrl,
} from "@/lib/syllabus/syllabus-pdf"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024
const ALLOWED_SECTION_IDS = new Set(["curriculum-vitae"])

function extFromName(name: string): string {
  return path.extname(name).toLowerCase().replace(/^\./, "")
}

function cvMarkdownForUrl(documentUrl: string): string {
  return `[View Curriculum Vitae (PDF)](${documentUrl})`
}

function updateSectionDocument(
  sections: SyllabusSection[],
  sectionId: string,
  document: { documentUrl: string; documentFileName: string } | null,
): SyllabusSection[] {
  return sections.map((section) => {
    if (section.sectionId !== sectionId) return section
    const nextContent = { ...section.content }
    if (document) {
      nextContent.documentUrl = document.documentUrl
      nextContent.documentFileName = document.documentFileName
      if (sectionId === "curriculum-vitae") {
        nextContent.markdown = cvMarkdownForUrl(document.documentUrl)
      }
    } else {
      delete nextContent.documentUrl
      delete nextContent.documentFileName
      if (sectionId === "curriculum-vitae") {
        delete nextContent.markdown
      }
    }
    return { ...section, content: nextContent }
  })
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireCoursePermission(
      request,
      ["manage_syllabus", "manage_course_settings"],
      "You do not have permission to upload syllabus documents.",
    )
    if (!scope.ok) return scope.response

    const courseId = scope.course.id
    const sessionScope = readInstructorSessionScopeFromRequest(request)
    const sessionId = sessionScope.sessionId
    await getOrCreateSyllabusForCourse(courseId, scope.instructorId, sessionId)

    const formData = await request.formData()
    const file = formData.get("file")
    const sectionId = String(formData.get("sectionId") ?? "").trim()

    if (!sectionId) {
      return NextResponse.json({ error: "sectionId is required" }, { status: 400 })
    }
    if (!ALLOWED_SECTION_IDS.has(sectionId)) {
      return NextResponse.json({ error: "Document upload is not allowed for this section" }, { status: 400 })
    }
    if (!(file instanceof File) || file.size < 1) {
      return NextResponse.json({ error: "PDF file is required" }, { status: 400 })
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      return NextResponse.json({ error: "Document must be 15 MB or smaller" }, { status: 400 })
    }
    if (extFromName(file.name || "") !== "pdf") {
      return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 })
    }

    const existing = await getSyllabusByCourseId(courseId, sessionId)
    const prevSection = existing?.sections.find((s) => s.sectionId === sectionId)
    await unlinkSyllabusPublicUrl(prevSection?.content.documentUrl)

    const origName = file.name || "curriculum-vitae.pdf"
    const destName = sanitizeSyllabusPdfFileName(origName)
    const buffer = Buffer.from(await file.arrayBuffer())
    const relativePath = `${syllabusUploadRelativeFolder(courseId)}/${destName}`
    const documentUrl = await savePublicUpload({
      blobKey: `syllabus-documents/${courseId}/${destName}`,
      relativePublicPath: relativePath,
      bytes: buffer,
      contentType: "application/pdf",
    })

    const sections = updateSectionDocument(existing?.sections ?? [], sectionId, {
      documentUrl,
      documentFileName: origName,
    })

    await sql`
      UPDATE course_syllabi
      SET
        sections = ${JSON.stringify(sections)}::jsonb,
        updated_by = ${scope.instructorId},
        updated_at = NOW()
      WHERE course_id = ${courseId}
        AND (
          (${sessionId}::int IS NULL AND session_id IS NULL)
          OR session_id = ${sessionId}
        )
    `

    const syllabus = await getSyllabusByCourseId(courseId, sessionId)
    return NextResponse.json({
      success: true,
      documentUrl,
      documentFileName: origName,
      syllabus,
    })
  } catch (error) {
    console.error("[Instructor Syllabus Section Document] POST failed:", error)
    return NextResponse.json({ error: "Failed to upload section document" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const scope = await requireCoursePermission(
      request,
      ["manage_syllabus", "manage_course_settings"],
      "You do not have permission to remove syllabus documents.",
    )
    if (!scope.ok) return scope.response

    const courseId = scope.course.id
    const sessionScope = readInstructorSessionScopeFromRequest(request)
    const sessionId = sessionScope.sessionId
    const sectionId = request.nextUrl.searchParams.get("sectionId")?.trim()
    if (!sectionId) {
      return NextResponse.json({ error: "sectionId is required" }, { status: 400 })
    }
    if (!ALLOWED_SECTION_IDS.has(sectionId)) {
      return NextResponse.json({ error: "Document removal is not allowed for this section" }, { status: 400 })
    }

    const existing = await getSyllabusByCourseId(courseId, sessionId)
    if (!existing) {
      return NextResponse.json({ error: "Syllabus not found" }, { status: 404 })
    }

    const prevSection = existing.sections.find((s) => s.sectionId === sectionId)
    await unlinkSyllabusPublicUrl(prevSection?.content.documentUrl)

    const sections = updateSectionDocument(existing.sections, sectionId, null)
    await sql`
      UPDATE course_syllabi
      SET
        sections = ${JSON.stringify(sections)}::jsonb,
        updated_by = ${scope.instructorId},
        updated_at = NOW()
      WHERE course_id = ${courseId}
        AND (
          (${sessionId}::int IS NULL AND session_id IS NULL)
          OR session_id = ${sessionId}
        )
    `

    const syllabus = await getSyllabusByCourseId(courseId, sessionId)
    return NextResponse.json({ success: true, syllabus })
  } catch (error) {
    console.error("[Instructor Syllabus Section Document] DELETE failed:", error)
    return NextResponse.json({ error: "Failed to remove section document" }, { status: 500 })
  }
}
