import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { fetchStudentPlatformRecord } from "@/lib/student-platform-record"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const { id } = await params
    const studentDbId = Number(id)
    if (!Number.isFinite(studentDbId) || studentDbId <= 0) {
      return NextResponse.json({ error: "Invalid student id" }, { status: 400 })
    }

    const record = await fetchStudentPlatformRecord(studentDbId, scope.course.id)
    if (!record) {
      return NextResponse.json({ error: "Student not found in this course" }, { status: 404 })
    }

    return NextResponse.json({ success: true, record })
  } catch (error) {
    console.error("[instructor/students/record]", error)
    return NextResponse.json({ error: "Failed to load student record" }, { status: 500 })
  }
}
