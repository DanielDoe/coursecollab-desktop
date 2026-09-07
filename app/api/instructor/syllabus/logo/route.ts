import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCoursePermission } from "@/lib/course-permission-guard"
import { readInstructorSessionScopeFromRequest } from "@/lib/instructor-session-scope"
import { getOrCreateSyllabusForCourse, getSyllabusByCourseId } from "@/lib/syllabus/syllabus-service"
import { savePublicUpload } from "@/lib/blob-or-local-public"
import {
  isAllowedSyllabusImage,
  sanitizeSyllabusImageFileName,
} from "@/lib/syllabus/syllabus-image"
import {
  syllabusLogoRelativeFolder,
  unlinkSyllabusLogoUrl,
} from "@/lib/syllabus/syllabus-logo"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_LOGO_BYTES = 5 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const scope = await requireCoursePermission(
      request,
      ["manage_syllabus", "manage_course_settings"],
      "You do not have permission to upload a syllabus logo.",
    )
    if (!scope.ok) return scope.response

    const courseId = scope.course.id
    const sessionScope = readInstructorSessionScopeFromRequest(request)
    const sessionId = sessionScope.sessionId
    await getOrCreateSyllabusForCourse(courseId, scope.instructorId, sessionId)

    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File) || file.size < 1) {
      return NextResponse.json({ error: "Logo image is required" }, { status: 400 })
    }
    if (file.size > MAX_LOGO_BYTES) {
      return NextResponse.json({ error: "Logo must be 5 MB or smaller" }, { status: 400 })
    }
    if (!isAllowedSyllabusImage(file.name, file.type)) {
      return NextResponse.json({ error: "Only image files (JPG, PNG, WebP, GIF) are allowed" }, { status: 400 })
    }

    const existing = await getSyllabusByCourseId(courseId, sessionId)
    await unlinkSyllabusLogoUrl(existing?.logoUrl)

    const destName = sanitizeSyllabusImageFileName(file.name)
    const buffer = Buffer.from(await file.arrayBuffer())
    const relativePath = `${syllabusLogoRelativeFolder(courseId)}/${destName}`
    const logoUrl = await savePublicUpload({
      blobKey: `syllabus-logos/${courseId}/${destName}`,
      relativePublicPath: relativePath,
      bytes: buffer,
      contentType: file.type || undefined,
    })
    await sql`
      UPDATE course_syllabi
      SET
        logo_url = ${logoUrl},
        logo_file_name = ${file.name},
        updated_by = ${scope.instructorId},
        updated_at = NOW()
      WHERE course_id = ${courseId}
        AND (
          (${sessionId}::int IS NULL AND session_id IS NULL)
          OR session_id = ${sessionId}
        )
    `

    const syllabus = await getSyllabusByCourseId(courseId, sessionId)
    return NextResponse.json({ success: true, logoUrl, logoFileName: file.name, syllabus })
  } catch (error) {
    console.error("[Instructor Syllabus Logo] POST failed:", error)
    return NextResponse.json({ error: "Failed to upload logo" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const scope = await requireCoursePermission(
      request,
      ["manage_syllabus", "manage_course_settings"],
      "You do not have permission to remove the syllabus logo.",
    )
    if (!scope.ok) return scope.response

    const courseId = scope.course.id
    const sessionScope = readInstructorSessionScopeFromRequest(request)
    const sessionId = sessionScope.sessionId
    const existing = await getSyllabusByCourseId(courseId, sessionId)
    if (!existing) {
      return NextResponse.json({ error: "Syllabus not found" }, { status: 404 })
    }

    await unlinkSyllabusLogoUrl(existing.logoUrl)

    await sql`
      UPDATE course_syllabi
      SET
        logo_url = NULL,
        logo_file_name = NULL,
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
    console.error("[Instructor Syllabus Logo] DELETE failed:", error)
    return NextResponse.json({ error: "Failed to remove logo" }, { status: 500 })
  }
}
