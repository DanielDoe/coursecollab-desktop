import { NextRequest, NextResponse } from "next/server"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { requestCourseExchangeSupplement } from "@/lib/course-exchange/service"
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
    const modules = normalizeModuleList(body.modules)
    if (modules.length === 0) {
      return NextResponse.json({ error: "Select at least one module." }, { status: 400 })
    }

    const result = await requestCourseExchangeSupplement({
      requesterInstructorId: session.instructorId,
      requestId,
      modules,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("[course-exchange/supplement]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Supplement failed" },
      { status: 400 },
    )
  }
}
