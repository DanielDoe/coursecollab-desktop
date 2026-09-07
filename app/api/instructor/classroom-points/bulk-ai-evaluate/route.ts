import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { bulkReevaluateClassroomPoints } from "@/lib/classroom-points-reevaluate"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * POST — AI-evaluate existing classroom point submissions (backfill feedback).
 * Approved rows keep their points by default; pending rows may auto-approve per policy.
 */
export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const body = (await request.json().catch(() => ({}))) as {
      session?: string
      status?: "pending" | "approved" | "all"
      skipWithFeedback?: boolean
      preserveApprovedPoints?: boolean
      limit?: number
      dryRun?: boolean
    }

    const { searchParams } = new URL(request.url)
    const session = body.session ?? searchParams.get("session")

    const result = await bulkReevaluateClassroomPoints({
      session,
      courseId: scope.course.id,
      status: body.status ?? "all",
      skipWithFeedback: body.skipWithFeedback ?? true,
      preserveApprovedPoints: body.preserveApprovedPoints ?? true,
      limit: body.limit ?? 25,
      dryRun: body.dryRun ?? false,
    })

    return NextResponse.json({
      success: true,
      ...result,
      message: `Evaluated ${result.summary.evaluated}, skipped ${result.summary.skipped}, errors ${result.summary.errors}`,
    })
  } catch (error) {
    console.error("[Classroom Points Bulk AI Evaluate]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bulk evaluation failed" },
      { status: 500 },
    )
  }
}
