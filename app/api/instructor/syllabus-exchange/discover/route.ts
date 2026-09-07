import { NextRequest, NextResponse } from "next/server"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { listDiscoverableSyllabi } from "@/lib/syllabus-exchange/service"

export const dynamic = "force-dynamic"

/** Browse published syllabi from across the platform (no creator permission required). */
export async function GET(request: NextRequest) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response

    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")
    const limit = searchParams.get("limit")

    const syllabi = await listDiscoverableSyllabi({
      requesterInstructorId: session.instructorId,
      query: q,
      limit: limit ? Number(limit) : undefined,
    })

    return NextResponse.json({ syllabi })
  } catch (error) {
    console.error("[syllabus-exchange/discover]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list syllabi" },
      { status: 500 },
    )
  }
}
