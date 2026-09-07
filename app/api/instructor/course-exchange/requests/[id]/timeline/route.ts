import { NextRequest, NextResponse } from "next/server"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { getExchangeRequestTimeline } from "@/lib/course-exchange/service"

export const dynamic = "force-dynamic"

export async function GET(
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

    const timeline = await getExchangeRequestTimeline({
      instructorId: session.instructorId,
      requestId,
    })

    return NextResponse.json({ timeline })
  } catch (error) {
    console.error("[course-exchange/timeline]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load timeline" },
      { status: 400 },
    )
  }
}
