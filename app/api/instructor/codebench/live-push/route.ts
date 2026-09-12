import { type NextRequest, NextResponse } from "next/server"
import { submissionBelongsToCourse } from "@/lib/classroom-submission-scope"
import { LIVE_PUSH_MAX_CODE_CHARS, pushInstructorLiveCode } from "@/lib/codebench-live-push"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const scope = await requireInstructorCourse(request)
  if (!scope.ok) return scope.response

  const body = await request.json().catch(() => ({}))
  const assignmentId = Number(body.assignmentId)
  const studentDbId = Number(body.studentDbId ?? body.studentId)
  const code = typeof body.code === "string" ? body.code : ""

  if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
    return NextResponse.json({ error: "assignmentId is required." }, { status: 400 })
  }
  if (!Number.isFinite(studentDbId) || studentDbId <= 0) {
    return NextResponse.json({ error: "studentDbId is required." }, { status: 400 })
  }
  if (!code.trim()) {
    return NextResponse.json({ error: "code is required." }, { status: 400 })
  }
  if (code.length > LIVE_PUSH_MAX_CODE_CHARS) {
    return NextResponse.json({ error: "Code is too long to send." }, { status: 400 })
  }

  const inCourse = await submissionBelongsToCourse(assignmentId, scope.course.id)
  if (!inCourse) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 })
  }

  try {
    const result = await pushInstructorLiveCode({
      request,
      courseId: scope.course.id,
      assignmentId,
      studentDbId,
      code,
      language: typeof body.language === "string" ? body.language : null,
      fileName: typeof body.fileName === "string" ? body.fileName : null,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true, revision: result.revision })
  } catch (error) {
    console.error("[instructor codebench live-push]", error)
    return NextResponse.json({ error: "Could not send code to the student." }, { status: 500 })
  }
}
