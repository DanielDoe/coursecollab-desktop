import { type NextRequest, NextResponse } from "next/server"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { readStudentLiveInstructorPush } from "@/lib/codebench-live-push"
import { validateStudentLiveSnapshotAccess } from "@/lib/codebench-live-snapshot-validation"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const studentId = request.nextUrl.searchParams.get("studentId")
  const auth = await requireCodebenchStudent(request, studentId)
  if (!auth.ok) return auth.response

  const assignmentId = Number(request.nextUrl.searchParams.get("assignmentId"))
  if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
    return NextResponse.json({ error: "assignmentId is required." }, { status: 400 })
  }

  const access = await validateStudentLiveSnapshotAccess(auth.studentDbId, assignmentId)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  try {
    const push = await readStudentLiveInstructorPush(auth.studentDbId, assignmentId)
    return NextResponse.json(push)
  } catch (error) {
    console.error("[codebench live-push]", error)
    return NextResponse.json({ error: "Could not load instructor edits." }, { status: 500 })
  }
}
