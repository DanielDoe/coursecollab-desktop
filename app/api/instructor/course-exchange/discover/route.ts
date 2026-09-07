import { NextRequest, NextResponse } from "next/server"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { listDiscoverableCourses } from "@/lib/course-exchange/service"
import { syncCanonicalCatalogCourseMetadata } from "@/lib/instructor-default-courses"

export const dynamic = "force-dynamic"

/** Browse courses explicitly marked shareable by other faculty. */
export async function GET(request: NextRequest) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response

    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")
    const limit = searchParams.get("limit")

    await syncCanonicalCatalogCourseMetadata()
    const courses = await listDiscoverableCourses({
      requesterInstructorId: session.instructorId,
      query: q,
      limit: limit ? Number(limit) : undefined,
    })

    return NextResponse.json({ courses })
  } catch (error) {
    console.error("[course-exchange/discover]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list courses" },
      { status: 500 },
    )
  }
}
