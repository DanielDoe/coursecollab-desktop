import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { syncLectureCourseIdsForElegEceInstructor } from "@/lib/instructor-default-courses"
import { isSlideInSelectedCourseScope } from "@/lib/instructor-lecture-slide-scope"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await syncLectureCourseIdsForElegEceInstructor(scope.instructorId)

    const { id } = await params
    const slideId = parseInt(id, 10)
    if (!Number.isFinite(slideId)) {
      return NextResponse.json({ error: "Invalid slide id" }, { status: 400 })
    }

    const allowed = await isSlideInSelectedCourseScope(
      slideId,
      scope.course.id,
      scope.instructorId,
      scope.course.course_code,
    )
    if (!allowed) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 })
    }

    const slides = await sql`
      SELECT 
        ls.*,
        l.title as lecture_title,
        l.week,
        l.session
      FROM lecture_slides ls
      JOIN lectures l ON ls.lecture_id = l.id
      WHERE ls.id = ${slideId}
    `

    if (slides.length === 0) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 })
    }

    return NextResponse.json({ slide: slides[0] })
  } catch (error) {
    console.error("[instructor/lecture-slides GET id]", error)
    return NextResponse.json({ error: "Failed to fetch lecture slide" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await syncLectureCourseIdsForElegEceInstructor(scope.instructorId)

    const { title, content, slide_order, is_active } = await request.json()
    const { id } = await params
    const slideId = parseInt(id, 10)
    if (!Number.isFinite(slideId)) {
      return NextResponse.json({ error: "Invalid slide id" }, { status: 400 })
    }

    const allowed = await isSlideInSelectedCourseScope(
      slideId,
      scope.course.id,
      scope.instructorId,
      scope.course.course_code,
    )
    if (!allowed) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 })
    }

    const existingSlide = await sql`
      SELECT * FROM lecture_slides WHERE id = ${slideId}
    `

    if (existingSlide.length === 0) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 })
    }

    const ex = existingSlide[0] as Record<string, unknown>

    const result = await sql`
      UPDATE lecture_slides 
      SET 
        title = ${title ?? ex.title},
        content = ${content !== undefined ? content : ex.content},
        slide_order = ${slide_order ?? ex.slide_order},
        is_active = ${is_active !== undefined ? is_active : ex.is_active},
        updated_at = NOW()
      WHERE id = ${slideId}
      RETURNING *
    `

    return NextResponse.json({
      slide: result[0],
      message: "Slide updated successfully",
    })
  } catch (error) {
    console.error("[instructor/lecture-slides PATCH id]", error)
    return NextResponse.json({ error: "Failed to update lecture slide" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await syncLectureCourseIdsForElegEceInstructor(scope.instructorId)

    const { id } = await params
    const slideId = parseInt(id, 10)
    if (!Number.isFinite(slideId)) {
      return NextResponse.json({ error: "Invalid slide id" }, { status: 400 })
    }

    const allowed = await isSlideInSelectedCourseScope(
      slideId,
      scope.course.id,
      scope.instructorId,
      scope.course.course_code,
    )
    if (!allowed) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 })
    }

    const existingSlide = await sql`
      SELECT id, title FROM lecture_slides WHERE id = ${slideId}
    `

    if (existingSlide.length === 0) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 })
    }

    await sql`DELETE FROM lecture_slides WHERE id = ${slideId}`

    return NextResponse.json({
      message: "Slide deleted successfully",
      slide: existingSlide[0],
    })
  } catch (error) {
    console.error("[instructor/lecture-slides DELETE id]", error)
    return NextResponse.json({ error: "Failed to delete lecture slide" }, { status: 500 })
  }
}
