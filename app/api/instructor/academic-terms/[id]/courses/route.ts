import { type NextRequest, NextResponse } from "next/server"
import { listTermCourses, addCourseToTerm } from "@/lib/academic-term-courses"
import { requireAcademicTermInstructor } from "@/lib/academic-term-instructor-auth"

export const dynamic = "force-dynamic"

/** Courses offered in an academic term. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAcademicTermInstructor(request)
    if (!auth.ok) return auth.response

    const { id } = await params
    const termId = Number.parseInt(id, 10)
    if (!Number.isFinite(termId)) {
      return NextResponse.json({ error: "Invalid term id" }, { status: 400 })
    }

    const courses = await listTermCourses(termId)
    return NextResponse.json({ courses })
  } catch (error) {
    console.error("[instructor/academic-terms/courses GET]", error)
    return NextResponse.json({ error: "Failed to fetch term courses" }, { status: 500 })
  }
}

/** Add a course to an academic term. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAcademicTermInstructor(request)
    if (!auth.ok) return auth.response

    const { id } = await params
    const termId = Number.parseInt(id, 10)
    const { course_id } = await request.json()
    const courseId = Number(course_id)

    if (!Number.isFinite(termId) || !Number.isFinite(courseId)) {
      return NextResponse.json({ error: "term id and course_id are required" }, { status: 400 })
    }

    const { addCourseToTerm } = await import("@/lib/academic-term-courses")
    const offering = await addCourseToTerm(termId, courseId)
    if (!offering) {
      return NextResponse.json({ error: "Academic term or course not found" }, { status: 404 })
    }

    return NextResponse.json({ course: offering })
  } catch (error) {
    console.error("[instructor/academic-terms/courses POST]", error)
    return NextResponse.json({ error: "Failed to add course to term" }, { status: 500 })
  }
}
