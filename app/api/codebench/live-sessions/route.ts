import { type NextRequest, NextResponse } from "next/server"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { listStudentOpenLiveSessions } from "@/lib/codebench-live-classroom"
import { resolveStudentCourseContextForRequest } from "@/lib/student-course-scope"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const studentId = request.nextUrl.searchParams.get("studentId")
  const auth = await requireCodebenchStudent(request, studentId)
  if (!auth.ok) return auth.response

  try {
    const ctx = await resolveStudentCourseContextForRequest(request, auth.studentDbId)
    if (!ctx?.courseId) {
      return NextResponse.json({ sessions: [] })
    }

    const sessions = await listStudentOpenLiveSessions({
      courseId: ctx.courseId,
      sessionId: ctx.sessionId,
      sessionCode: ctx.sessionCode,
    })
    return NextResponse.json({ sessions })
  } catch (error) {
    console.error("[codebench live-sessions]", error)
    return NextResponse.json({ error: "Could not load live classroom sessions." }, { status: 500 })
  }
}
