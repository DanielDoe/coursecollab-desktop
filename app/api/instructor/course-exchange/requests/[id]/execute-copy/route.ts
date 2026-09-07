import { NextRequest, NextResponse } from "next/server"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { executeApprovedCourseCopy } from "@/lib/course-exchange/service"

export const dynamic = "force-dynamic"

/** Import approved materials into requester's destination course (independent copy). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response

    const { id } = await params
    const requestId = Number(id)
    if (!Number.isFinite(requestId)) {
      return NextResponse.json({ error: "Invalid request id" }, { status: 400 })
    }

    const body = await request.json()
    const destinationCourseId = Number(body.destinationCourseId)
    if (!Number.isFinite(destinationCourseId)) {
      return NextResponse.json({ error: "destinationCourseId is required" }, { status: 400 })
    }

    const destinationSessionId =
      body.destinationSessionId != null ? Number(body.destinationSessionId) : null

    const result = await executeApprovedCourseCopy({
      requesterInstructorId: session.instructorId,
      requestId,
      destinationCourseId,
      destinationSessionId: Number.isFinite(destinationSessionId ?? NaN) ? destinationSessionId : null,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("[course-exchange/execute-copy]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Copy failed" },
      { status: 400 },
    )
  }
}
