import { type NextRequest, NextResponse } from "next/server"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import { selfCheckInStructuredSession } from "@/lib/attendance/self-checkin"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const bound = await requireBoundStudentCaller(
      request,
      body.studentId != null ? String(body.studentId) : null,
    )
    if (!bound.ok) return bound.response

    const sessionId = Number(body.sessionId)
    if (!Number.isFinite(sessionId) || sessionId <= 0) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }

    const result = await selfCheckInStructuredSession({
      studentDbId: bound.studentDbId,
      sessionId,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Check-in failed" },
      { status: 400 },
    )
  }
}
