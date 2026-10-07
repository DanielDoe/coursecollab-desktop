import { type NextRequest, NextResponse } from "next/server"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { listStudentOpenLiveSessions } from "@/lib/codebench-live-classroom"
import { cleanLiveClientId, heldByFromRow } from "@/lib/codebench-live-handoff"
import { readFreshStudentEditorHolds, readSavedLiveAssignmentIds } from "@/lib/codebench-live-handoff-db"
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
    const myClientId = cleanLiveClientId(request.nextUrl.searchParams.get("clientId"))
    const holds = await readFreshStudentEditorHolds(auth.studentDbId)
    const openIds = new Set(sessions.map((session) => session.assignmentId))
    const savedAssignmentIds = (await readSavedLiveAssignmentIds(auth.studentDbId)).filter((id) =>
      openIds.has(id),
    )
    const fresh = holds.find((hold) => openIds.has(hold.assignmentId) && hold.clientId) ?? null
    const matched = fresh ? sessions.find((session) => session.assignmentId === fresh.assignmentId) : null
    const editorHold = fresh
      ? {
          ...heldByFromRow({
            assignmentId: fresh.assignmentId,
            clientId: fresh.clientId,
            clientLabel: fresh.clientLabel,
          }),
          title: matched?.title ?? "Live classroom",
          yours: Boolean(myClientId && fresh.clientId && myClientId === fresh.clientId),
        }
      : null
    return NextResponse.json({ sessions, editorHold, savedAssignmentIds })
  } catch (error) {
    console.error("[codebench live-sessions]", error)
    return NextResponse.json({ error: "Could not load live classroom sessions." }, { status: 500 })
  }
}
