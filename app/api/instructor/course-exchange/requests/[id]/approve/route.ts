import { NextRequest, NextResponse } from "next/server"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { approveCourseExchangeRequest } from "@/lib/course-exchange/service"
import { normalizeModuleList } from "@/lib/course-exchange/modules"

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

    const body = await request.json()
    const approvedModules = normalizeModuleList(body.approvedModules)
    const result = await approveCourseExchangeRequest({
      instructorId: session.instructorId,
      requestId,
      approvedModules,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("[course-exchange/approve]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Approval failed" },
      { status: 400 },
    )
  }
}
