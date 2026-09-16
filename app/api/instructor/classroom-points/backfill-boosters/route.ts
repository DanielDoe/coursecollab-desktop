import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { backfillClassroomPointTimingBoosters } from "@/lib/classroom-point-booster-backfill"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/**
 * POST — Recompute timing boosters from assignment created_at (x3 same day, x2 next day, x1 later).
 * Only raises stored points. Does not call AI.
 */
export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const body = (await request.json().catch(() => ({}))) as {
      dryRun?: boolean
      limit?: number
    }

    const result = await backfillClassroomPointTimingBoosters({
      courseId: scope.course.id,
      dryRun: body.dryRun ?? false,
      limit: body.limit ?? 500,
    })

    return NextResponse.json({
      success: true,
      ...result,
      message: `Scanned ${result.summary.scanned}, updated ${result.summary.updated}, unchanged ${result.summary.unchanged}`,
    })
  } catch (error) {
    console.error("[Classroom Points Booster Backfill]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Booster backfill failed" },
      { status: 500 },
    )
  }
}
