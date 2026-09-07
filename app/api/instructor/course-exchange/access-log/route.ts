import { NextRequest, NextResponse } from "next/server"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { listCourseExchangeAccessLog } from "@/lib/course-exchange/service"

export const dynamic = "force-dynamic"

/** Access log for the creator — who requested / received materials. */
export async function GET(request: NextRequest) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response

    const events = await listCourseExchangeAccessLog(session.instructorId)
    return NextResponse.json({ events })
  } catch (error) {
    console.error("[course-exchange/access-log]", error)
    return NextResponse.json({ error: "Failed to load access log" }, { status: 500 })
  }
}
