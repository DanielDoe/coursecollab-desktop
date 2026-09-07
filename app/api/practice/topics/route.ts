import { type NextRequest, NextResponse } from "next/server"
import { listPracticeTopicsForCourse } from "@/lib/student-practice-scope"
import { requireStudentPracticeCaller } from "@/lib/require-student-practice-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const session = searchParams.get("session")
    const studentId = searchParams.get("studentId")
    const courseIdParam = searchParams.get("courseId")

    const auth = await requireStudentPracticeCaller(request, studentId, session, courseIdParam)
    if (!auth.ok) return auth.response
    const topics = await listPracticeTopicsForCourse(
      auth.ctx.courseId,
      auth.ctx.practiceSession,
      auth.ctx.sessionVariants,
    )
    return NextResponse.json({ topics, courseId: auth.ctx.courseId })
  } catch (error) {
    console.error("[practice/topics]", error)
    return NextResponse.json({ error: "Failed to fetch topics" }, { status: 500 })
  }
}
