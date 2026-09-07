import { NextRequest, NextResponse } from "next/server"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { rejectCourseExchangeRequest } from "@/lib/course-exchange/service"

export const dynamic = "force-dynamic"

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

    const body = await request.json().catch(() => ({}))
    const updated = await rejectCourseExchangeRequest({
      instructorId: session.instructorId,
      requestId,
      reason: body.reason ?? null,
    })

    return NextResponse.json({ request: updated })
  } catch (error) {
    console.error("[course-exchange/reject]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Rejection failed" },
      { status: 400 },
    )
  }
}
