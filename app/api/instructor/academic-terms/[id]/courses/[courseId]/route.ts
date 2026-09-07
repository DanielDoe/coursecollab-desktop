import { type NextRequest, NextResponse } from "next/server"
import { removeCourseFromTerm } from "@/lib/academic-term-courses"
import { requireAcademicTermInstructor } from "@/lib/academic-term-instructor-auth"

export const dynamic = "force-dynamic"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; courseId: string }> },
) {
  try {
    const auth = await requireAcademicTermInstructor(request)
    if (!auth.ok) return auth.response

    const { id, courseId: courseIdParam } = await params
    const termId = Number.parseInt(id, 10)
    const courseId = Number.parseInt(courseIdParam, 10)

    if (!Number.isFinite(termId) || !Number.isFinite(courseId)) {
      return NextResponse.json({ error: "Invalid term or course id" }, { status: 400 })
    }

    try {
      const removed = await removeCourseFromTerm(termId, courseId)
      if (!removed) {
        return NextResponse.json({ error: "Course offering not found in this term" }, { status: 404 })
      }
      return NextResponse.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove course"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  } catch (error) {
    console.error("[instructor/academic-terms/courses/[courseId] DELETE]", error)
    return NextResponse.json({ error: "Failed to remove course from term" }, { status: 500 })
  }
}
