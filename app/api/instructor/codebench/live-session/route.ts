import { type NextRequest, NextResponse } from "next/server"
import { CLASSROOM_SUBMISSION_KIND_CODE } from "@/lib/classroom-solution-submission"
import { submissionBelongsToCourse } from "@/lib/classroom-submission-scope"
import {
  endLiveClassroomSession,
  listOpenLiveClassroomSessions,
  startLiveClassroomSession,
} from "@/lib/codebench-live-classroom"
import { fetchLiveClassroomSession } from "@/lib/codebench-live-session"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

function readAssignmentId(request: NextRequest, body?: { assignmentId?: unknown }) {
  const fromQuery = Number(request.nextUrl.searchParams.get("assignmentId"))
  if (Number.isFinite(fromQuery) && fromQuery > 0) return fromQuery
  const fromBody = Number(body?.assignmentId)
  if (Number.isFinite(fromBody) && fromBody > 0) return fromBody
  return null
}

async function assignmentIsLiveCodeChallenge(assignmentId: number) {
  const rows = await sql`
    SELECT submission_kind
    FROM classroom_point_submissions
    WHERE id = ${assignmentId}
    LIMIT 1
  `
  if (rows.length === 0) return false
  return String((rows[0] as { submission_kind?: string }).submission_kind ?? CLASSROOM_SUBMISSION_KIND_CODE)
    .toLowerCase() === CLASSROOM_SUBMISSION_KIND_CODE
}

export async function GET(request: NextRequest) {
  const scope = await requireInstructorCourse(request)
  if (!scope.ok) return scope.response

  const assignmentId = readAssignmentId(request)
  if (assignmentId == null) {
    try {
      const sessions = await listOpenLiveClassroomSessions(scope.course.id)
      return NextResponse.json({ sessions })
    } catch (error) {
      console.error("[instructor codebench live-session list]", error)
      return NextResponse.json(
        { error: "Could not load open live sessions." },
        { status: 500 },
      )
    }
  }

  const inCourse = await submissionBelongsToCourse(assignmentId, scope.course.id)
  if (!inCourse) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 })
  }

  try {
    const payload = await fetchLiveClassroomSession(scope.course.id, assignmentId, request)
    if (!payload) {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 })
    }
    return NextResponse.json(payload)
  } catch (error) {
    console.error("[instructor codebench live-session]", error)
    return NextResponse.json(
      { error: "Could not load live classroom session." },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const scope = await requireInstructorCourse(request)
  if (!scope.ok) return scope.response

  const body = await request.json().catch(() => ({}))
  const assignmentId = readAssignmentId(request, body)
  if (assignmentId == null) {
    return NextResponse.json({ error: "assignmentId is required." }, { status: 400 })
  }

  const inCourse = await submissionBelongsToCourse(assignmentId, scope.course.id)
  if (!inCourse) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 })
  }

  if (!(await assignmentIsLiveCodeChallenge(assignmentId))) {
    return NextResponse.json({ error: "Live classroom is only available for coding challenges." }, { status: 400 })
  }

  try {
    const session = await startLiveClassroomSession({
      assignmentId,
      courseId: scope.course.id,
      instructorId: scope.instructorId,
    })
    return NextResponse.json({ ok: true, session })
  } catch (error) {
    console.error("[instructor codebench live-session start]", error)
    return NextResponse.json(
      { error: "Could not start live classroom session." },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  const scope = await requireInstructorCourse(request)
  if (!scope.ok) return scope.response

  const assignmentId = readAssignmentId(request)
  if (assignmentId == null) {
    return NextResponse.json({ error: "assignmentId is required." }, { status: 400 })
  }

  const inCourse = await submissionBelongsToCourse(assignmentId, scope.course.id)
  if (!inCourse) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 })
  }

  try {
    const ended = await endLiveClassroomSession({
      assignmentId,
      courseId: scope.course.id,
    })
    return NextResponse.json({ ok: true, ended })
  } catch (error) {
    console.error("[instructor codebench live-session end]", error)
    return NextResponse.json(
      { error: "Could not end live classroom session." },
      { status: 500 },
    )
  }
}
