import { NextRequest, NextResponse } from "next/server"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { refreshExchangeUpdateCounts } from "@/lib/course-exchange/sync-service"

export const dynamic = "force-dynamic"

/** Lightweight hash-first refresh for Shared With Me update badges. */
export async function GET(request: NextRequest) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response

    const counts = await refreshExchangeUpdateCounts(session.instructorId)
    return NextResponse.json({ counts })
  } catch (error) {
    console.error("[course-exchange/copies/update-counts GET]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to refresh update counts" },
      { status: 500 },
    )
  }
}
