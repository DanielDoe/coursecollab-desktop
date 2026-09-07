import { NextRequest, NextResponse } from "next/server"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import {
  createCourseExchangeRequest,
  listReceivedExchangeRequests,
  listSentExchangeRequests,
} from "@/lib/course-exchange/service"
import { normalizeModuleList } from "@/lib/course-exchange/modules"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response

    const { searchParams } = new URL(request.url)
    const direction = searchParams.get("direction") ?? "received"
    const status = searchParams.get("status") ?? undefined

    if (direction === "sent") {
      const requests = await listSentExchangeRequests(session.instructorId, status)
      return NextResponse.json({ requests })
    }

    const requests = await listReceivedExchangeRequests(session.instructorId, status)
    return NextResponse.json({ requests })
  } catch (error) {
    console.error("[course-exchange/requests GET]", error)
    return NextResponse.json({ error: "Failed to list requests" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response

    const body = await request.json()
    const sourceCourseId = Number(body.sourceCourseId)
    if (!Number.isFinite(sourceCourseId)) {
      return NextResponse.json({ error: "sourceCourseId is required" }, { status: 400 })
    }

    const requestRow = await createCourseExchangeRequest({
      requesterInstructorId: session.instructorId,
      sourceCourseId,
      purpose: body.purpose ?? null,
      requestedModules: normalizeModuleList(body.requestedModules),
      requesterInstitution: body.requesterInstitution ?? null,
      requesterDepartment: body.requesterDepartment ?? null,
      destinationCourseId: body.destinationCourseId != null ? Number(body.destinationCourseId) : null,
      destinationSessionId: body.destinationSessionId != null ? Number(body.destinationSessionId) : null,
    })

    return NextResponse.json({ request: requestRow }, { status: 201 })
  } catch (error) {
    console.error("[course-exchange/requests POST]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create request" },
      { status: 400 },
    )
  }
}
