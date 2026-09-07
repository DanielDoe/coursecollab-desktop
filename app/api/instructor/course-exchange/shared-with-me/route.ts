import { NextRequest, NextResponse } from "next/server"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { listSharedWithMe } from "@/lib/course-exchange/service"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response

    const copies = await listSharedWithMe(session.instructorId)
    return NextResponse.json({ copies })
  } catch (error) {
    console.error("[course-exchange/shared-with-me]", error)
    return NextResponse.json({ error: "Failed to list copies" }, { status: 500 })
  }
}
