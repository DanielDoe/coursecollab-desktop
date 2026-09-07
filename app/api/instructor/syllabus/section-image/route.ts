import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCoursePermission } from "@/lib/course-permission-guard"
import { readInstructorSessionScopeFromRequest } from "@/lib/instructor-session-scope"
import { getOrCreateSyllabusForCourse, getSyllabusByCourseId } from "@/lib/syllabus/syllabus-service"
import type { SyllabusSection } from "@/lib/syllabus/types"
import { savePublicUpload } from "@/lib/blob-or-local-public"
import {
  isAllowedSyllabusImage,
  sanitizeSyllabusImageFileName,
  syllabusImagePublicUrl,
  syllabusImageRelativeFolder,
  unlinkSyllabusImageUrl,
} from "@/lib/syllabus/syllabus-image"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

function updateSectionImage(
  sections: SyllabusSection[],
  sectionId: string,
  image: { imageUrl?: string; imageFileName?: string; imageCaption?: string } | null,
): SyllabusSection[] {
  return sections.map((section) => {
    if (section.sectionId !== sectionId) return section
    const nextContent = { ...section.content }
    if (image?.imageUrl) {
      nextContent.imageUrl = image.imageUrl
      nextContent.imageFileName = image.imageFileName
      if (image.imageCaption !== undefined) nextContent.imageCaption = image.imageCaption
    } else {
      delete nextContent.imageUrl
      delete nextContent.imageFileName
    }
    return { ...section, content: nextContent }
  })
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireCoursePermission(
      request,
      ["manage_syllabus", "manage_course_settings"],
      "You do not have permission to upload syllabus images.",
    )
    if (!scope.ok) return scope.response

    const courseId = scope.course.id
    const sessionScope = readInstructorSessionScopeFromRequest(request)
    const sessionId = sessionScope.sessionId
    await getOrCreateSyllabusForCourse(courseId, scope.instructorId, sessionId)

    const formData = await request.formData()
    const file = formData.get("file")
    const sectionId = String(formData.get("sectionId") ?? "").trim()
    const caption = String(formData.get("caption") ?? "").trim()

    if (!sectionId) {
      return NextResponse.json({ error: "sectionId is required" }, { status: 400 })
    }
    if (!(file instanceof File) || file.size < 1) {
      return NextResponse.json({ error: "Image file is required" }, { status: 400 })
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image must be 10 MB or smaller" }, { status: 400 })
    }
    if (!isAllowedSyllabusImage(file.name, file.type)) {
      return NextResponse.json({ error: "Only image files (JPG, PNG, WebP, GIF) are allowed" }, { status: 400 })
    }

    const existing = await getSyllabusByCourseId(courseId, sessionId)
    const prevSection = existing?.sections.find((s) => s.sectionId === sectionId)
    await unlinkSyllabusImageUrl(prevSection?.content.imageUrl)

    const destName = sanitizeSyllabusImageFileName(file.name)
    const buffer = Buffer.from(await file.arrayBuffer())
    const relativePath = `${syllabusImageRelativeFolder(courseId, sectionId)}/${destName}`
    const imageUrl = await savePublicUpload({
      blobKey: `syllabus-images/${courseId}/${sectionId}/${destName}`,
      relativePublicPath: relativePath,
      bytes: buffer,
      contentType: file.type || undefined,
    })
    const sections = updateSectionImage(existing?.sections ?? [], sectionId, {
      imageUrl,
      imageFileName: file.name,
      imageCaption: caption || prevSection?.content.imageCaption,
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
      imageUrl,
      imageFileName: file.name,
      syllabus,
    })
  } catch (error) {
    console.error("[Instructor Syllabus Section Image] POST failed:", error)
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const scope = await requireCoursePermission(
      request,
      ["manage_syllabus", "manage_course_settings"],
      "You do not have permission to remove syllabus images.",
    )
    if (!scope.ok) return scope.response

    const courseId = scope.course.id
    const sessionScope = readInstructorSessionScopeFromRequest(request)
    const sessionId = sessionScope.sessionId
    const sectionId = request.nextUrl.searchParams.get("sectionId")?.trim()
    if (!sectionId) {
      return NextResponse.json({ error: "sectionId is required" }, { status: 400 })
    }

    const existing = await getSyllabusByCourseId(courseId, sessionId)
    if (!existing) {
      return NextResponse.json({ error: "Syllabus not found" }, { status: 404 })
    }

    const prevSection = existing.sections.find((s) => s.sectionId === sectionId)
    await unlinkSyllabusImageUrl(prevSection?.content.imageUrl)

    const sections = updateSectionImage(existing.sections, sectionId, null)
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
    console.error("[Instructor Syllabus Section Image] DELETE failed:", error)
    return NextResponse.json({ error: "Failed to remove image" }, { status: 500 })
  }
}
