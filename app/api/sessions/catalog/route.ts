import { type NextRequest, NextResponse } from "next/server"
import { getSessionCatalogFromDb } from "@/lib/session-catalog"

export const dynamic = "force-dynamic"

/**
 * Public catalog of sessions for UI (labels from DB).
 * Short HTTP cache; clients also persist to localStorage (see SessionCatalogProvider).
 */
export async function GET(request: NextRequest) {
  try {
    const courseIdRaw = new URL(request.url).searchParams.get("courseId")
    const academicTermIdRaw = new URL(request.url).searchParams.get("academicTermId")
    const courseId = courseIdRaw ? Number(courseIdRaw) : null
    const academicTermId = academicTermIdRaw ? Number(academicTermIdRaw) : null
    const sessions = await getSessionCatalogFromDb(
      courseId != null && Number.isFinite(courseId)
        ? {
            courseId,
            academicTermId:
              academicTermId != null && Number.isFinite(academicTermId) ? academicTermId : undefined,
          }
        : undefined,
    )
    return NextResponse.json(
      { sessions },
      {
        headers: {
          "Cache-Control": "private, max-age=60",
        },
      },
    )
  } catch (error) {
    console.error("[sessions/catalog] Failed:", error)
    return NextResponse.json({ error: "Failed to load sessions", sessions: [] }, { status: 500 })
  }
}
