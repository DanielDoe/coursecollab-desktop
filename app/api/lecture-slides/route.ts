import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { tryResolveInstructorCourseScope } from "@/lib/instructor-course-scope"
import { syncLectureCourseIdsForElegEceInstructor } from "@/lib/instructor-default-courses"
import { isLectureAccessibleToStudent } from "@/lib/student-lecture-access"
import {
  isLectureInSelectedCourseScope,
  isSlideInSelectedCourseScope,
} from "@/lib/instructor-lecture-slide-scope"

export const dynamic = "force-dynamic"

const LEGACY_ADMIN_HEADER = "x-cc-legacy-admin"

function allowLegacyAdmin(request: NextRequest) {
  return request.headers.get(LEGACY_ADMIN_HEADER) === "1"
}

async function gateSlideMutation(
  request: NextRequest,
  opts: { lectureId?: number; slideId?: number },
): Promise<NextResponse | null> {
  const scopeTry = await tryResolveInstructorCourseScope(request)
  if (scopeTry.reason === "invalid") return scopeTry.response

  if (scopeTry.ok) {
    await syncLectureCourseIdsForElegEceInstructor(scopeTry.instructorId)
    if (opts.lectureId != null) {
      const ok = await isLectureInSelectedCourseScope(
        opts.lectureId,
        scopeTry.course.id,
        scopeTry.instructorId,
        scopeTry.course.course_code,
      )
      if (!ok) {
        return NextResponse.json({ error: "Lecture is not available for the selected course." }, { status: 403 })
      }
    }
    if (opts.slideId != null) {
      const ok = await isSlideInSelectedCourseScope(
        opts.slideId,
        scopeTry.course.id,
        scopeTry.instructorId,
        scopeTry.course.course_code,
      )
      if (!ok) {
        return NextResponse.json({ error: "Slide is not available for the selected course." }, { status: 403 })
      }
    }
    return null
  }

  if (allowLegacyAdmin(request)) return null

  return NextResponse.json(
    {
      error:
        "Select a course in the instructor dashboard (slide changes are scoped to the active course), or use a legacy admin session.",
    },
    { status: 401 },
  )
}

async function gateSlideRead(request: NextRequest, lectureIdNum: number): Promise<NextResponse | null> {
  const scopeTry = await tryResolveInstructorCourseScope(request)
  if (scopeTry.reason === "invalid") return scopeTry.response

  if (scopeTry.ok) {
    await syncLectureCourseIdsForElegEceInstructor(scopeTry.instructorId)
    const ok = await isLectureInSelectedCourseScope(
      lectureIdNum,
      scopeTry.course.id,
      scopeTry.instructorId,
      scopeTry.course.course_code,
    )
    if (!ok) {
      return NextResponse.json({ error: "Lecture not found for the selected course." }, { status: 404 })
    }
    return null
  }

  const { searchParams } = new URL(request.url)
  const studentId = searchParams.get("studentId")
  if (studentId) {
    const ok = await isLectureAccessibleToStudent(studentId, lectureIdNum)
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return null
  }

  if (allowLegacyAdmin(request)) return null

  const pub = await sql`
    SELECT id FROM lectures
    WHERE id = ${lectureIdNum}
      AND deleted_at IS NULL
      AND COALESCE(is_published, true) IS NOT DISTINCT FROM TRUE
    LIMIT 1
  `
  if (pub.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lectureId = searchParams.get("lectureId")
    const studentId = searchParams.get("studentId")

    if (!lectureId) {
      return NextResponse.json({ error: "Lecture ID is required" }, { status: 400 })
    }

    const lectureIdNum = parseInt(lectureId, 10)
    if (!Number.isFinite(lectureIdNum)) {
      return NextResponse.json({ error: "Invalid lecture ID" }, { status: 400 })
    }

    const denied = await gateSlideRead(request, lectureIdNum)
    if (denied) return denied

    const slides = await sql`
      SELECT 
        ls.id,
        ls.lecture_id,
        ls.content_type,
        ls.title,
        ls.subtitle,
        ls.content,
        ls.file_url,
        ls.background_gradient,
        ls.slide_order,
        ls.ai_summary,
        ls.ai_keywords,
        ls.is_active,
        ls.created_at,
        ls.updated_at,
        l.title as lecture_title,
        l.week
      FROM lecture_slides ls
      JOIN lectures l ON ls.lecture_id = l.id
      WHERE ls.lecture_id = ${lectureIdNum}
      ORDER BY ls.slide_order ASC
    `

    return NextResponse.json({ slides })
  } catch (error) {
    console.error("Failed to fetch slides:", error)
    return NextResponse.json({ error: "Failed to fetch slides" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const lectureIdRaw = body.lectureId
    const contentType = (body.contentType ?? body.slideType) as string | undefined
    const title = body.title as string | undefined
    const subtitle = body.subtitle as string | undefined | null
    const content = body.content as string | undefined | null
    const fileUrl = body.fileUrl as string | undefined | null
    const backgroundGradient = body.backgroundGradient as string | undefined | null
    const slideOrder = body.slideOrder as number | undefined

    if (lectureIdRaw == null || !contentType || !title) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const lectureId = typeof lectureIdRaw === "number" ? lectureIdRaw : parseInt(String(lectureIdRaw), 10)
    if (!Number.isFinite(lectureId)) {
      return NextResponse.json({ error: "Invalid lecture ID" }, { status: 400 })
    }

    const denied = await gateSlideMutation(request, { lectureId })
    if (denied) return denied

    const result = await sql`
      INSERT INTO lecture_slides (
        lecture_id, 
        content_type, 
        title, 
        subtitle,
        content, 
        file_url, 
        background_gradient,
        slide_order,
        is_active
      )
      VALUES (
        ${lectureId}, 
        ${contentType}, 
        ${title}, 
        ${subtitle ?? null},
        ${content ?? null}, 
        ${fileUrl ?? null}, 
        ${backgroundGradient ?? null},
        ${slideOrder ?? 1},
        true
      )
      RETURNING *
    `

    return NextResponse.json({ slide: result[0] })
  } catch (error) {
    console.error("Failed to create slide:", error)
    return NextResponse.json({ error: "Failed to create slide" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { slideId, title, content, fileUrl, slideOrder, isActive } = body

    if (!slideId) {
      return NextResponse.json({ error: "Slide ID is required" }, { status: 400 })
    }

    const sid = typeof slideId === "number" ? slideId : parseInt(String(slideId), 10)
    if (!Number.isFinite(sid)) {
      return NextResponse.json({ error: "Invalid slide ID" }, { status: 400 })
    }

    const denied = await gateSlideMutation(request, { slideId: sid })
    if (denied) return denied

    const result = await sql`
      UPDATE lecture_slides 
      SET 
        title = COALESCE(${title}, title),
        content = COALESCE(${content}, content),
        file_url = COALESCE(${fileUrl}, file_url),
        slide_order = COALESCE(${slideOrder}, slide_order),
        is_active = COALESCE(${isActive}, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sid}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 })
    }

    return NextResponse.json({ slide: result[0] })
  } catch (error) {
    console.error("Failed to update slide:", error)
    return NextResponse.json({ error: "Failed to update slide" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slideId = searchParams.get("slideId")

    if (!slideId) {
      return NextResponse.json({ error: "Slide ID is required" }, { status: 400 })
    }

    const sid = parseInt(slideId, 10)
    if (!Number.isFinite(sid)) {
      return NextResponse.json({ error: "Invalid slide ID" }, { status: 400 })
    }

    const denied = await gateSlideMutation(request, { slideId: sid })
    if (denied) return denied

    await sql`DELETE FROM lecture_slides WHERE id = ${sid}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete slide:", error)
    return NextResponse.json({ error: "Failed to delete slide" }, { status: 500 })
  }
}
