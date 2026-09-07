import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { savePublicUpload } from "@/lib/blob-or-local-public"
import { buildLectureInstructorCourseScopeSqlFragment, syncLectureCourseIdsForElegEceInstructor } from "@/lib/instructor-default-courses"
import { isLectureInSelectedCourseScope } from "@/lib/instructor-lecture-slide-scope"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await syncLectureCourseIdsForElegEceInstructor(scope.instructorId)

    const { searchParams } = new URL(request.url)
    const lectureId = searchParams.get("lectureId")
    const courseId = scope.course.id
    const scopeWhere = await buildLectureInstructorCourseScopeSqlFragment(
      courseId,
      scope.instructorId,
      scope.course.course_code,
    )

    let slides
    if (lectureId) {
      const lid = parseInt(lectureId, 10)
      if (!Number.isFinite(lid)) {
        return NextResponse.json({ error: "Invalid lectureId" }, { status: 400 })
      }
      slides = await sql`
        SELECT 
          ls.*,
          l.title as lecture_title,
          l.week
        FROM lecture_slides ls
        JOIN lectures l ON ls.lecture_id = l.id
        WHERE ls.lecture_id = ${lid}
          AND l.deleted_at IS NULL
          AND (${scopeWhere})
        ORDER BY ls.slide_order ASC
      `
    } else {
      slides = await sql`
        SELECT 
          ls.*,
          l.title as lecture_title,
          l.week
        FROM lecture_slides ls
        JOIN lectures l ON ls.lecture_id = l.id
        WHERE l.deleted_at IS NULL
          AND (${scopeWhere})
        ORDER BY ls.lecture_id ASC, ls.slide_order ASC
      `
    }

    return NextResponse.json({ slides })
  } catch (error) {
    console.error("[instructor/lecture-slides GET]", error)
    return NextResponse.json({ error: "Failed to fetch lecture slides" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await syncLectureCourseIdsForElegEceInstructor(scope.instructorId)

    const formData = await request.formData()

    const lectureId = formData.get("lecture_id") as string
    const title = formData.get("title") as string
    const slideType = formData.get("slide_type") as string
    const content = formData.get("content") as string
    const file = formData.get("file") as File

    if (!lectureId || !title || !slideType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const lid = parseInt(lectureId, 10)
    if (!Number.isFinite(lid)) {
      return NextResponse.json({ error: "Invalid lecture_id" }, { status: 400 })
    }

    const allowed = await isLectureInSelectedCourseScope(
      lid,
      scope.course.id,
      scope.instructorId,
      scope.course.course_code,
    )
    if (!allowed) {
      return NextResponse.json({ error: "Lecture is not in the selected course." }, { status: 403 })
    }

    const maxOrder = await sql`
      SELECT COALESCE(MAX(slide_order), 0) as max_order
      FROM lecture_slides
      WHERE lecture_id = ${lid}
    `

    const nextOrder = (maxOrder[0]?.max_order ?? 0) + 1

    let fileUrl: string | null = null

    if (file && file.size > 0) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "slide"
      const fname = `${Date.now()}_${safeName}`
      const bytes = Buffer.from(await file.arrayBuffer())
      fileUrl = await savePublicUpload({
        blobKey: `slides/${fname}`,
        relativePublicPath: `uploads/slides/${fname}`,
        bytes,
        contentType: file.type || undefined,
      })
    }

    const result = await sql`
      INSERT INTO lecture_slides (
        lecture_id, 
        slide_type, 
        title, 
        content, 
        file_url, 
        slide_order, 
        is_active, 
        created_at, 
        updated_at
      )
      VALUES (
        ${lid}, 
        ${slideType}, 
        ${title}, 
        ${content || null}, 
        ${fileUrl}, 
        ${nextOrder}, 
        true, 
        NOW(), 
        NOW()
      )
      RETURNING *
    `

    return NextResponse.json({
      slide: result[0],
      message: "Slide created successfully",
    })
  } catch (error) {
    console.error("[instructor/lecture-slides POST]", error)
    return NextResponse.json({ error: "Failed to create lecture slide" }, { status: 500 })
  }
}
