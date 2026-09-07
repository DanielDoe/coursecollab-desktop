import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { buildFacultyCoraSession } from "@/lib/cora/security"
import {
  confirmTransactionPlan,
  type CoraTransactionPlan,
} from "@/lib/cora/confirmations/transaction-plans"

export const dynamic = "force-dynamic"

/**
 * POST /api/instructor/cora/plans/confirm
 * Execute a signed multi-step Cora transaction plan after UI confirmation.
 */
export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const body = (await request.json()) as { plan?: CoraTransactionPlan }
    if (!body.plan?.planId || !body.plan?.hash) {
      return NextResponse.json({ error: "plan required" }, { status: 400 })
    }

    const session = await buildFacultyCoraSession({
      instructorId: scope.instructorId,
      courseId: scope.course.id,
      courseCode: scope.course.course_code ?? null,
      courseTitle: scope.course.course_title ?? null,
    })

    const result = await confirmTransactionPlan({
      session,
      plan: body.plan,
      courseId: scope.course.id,
    })

    if (!result.success) {
      return NextResponse.json(result, { status: 403 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[instructor/cora/plans/confirm]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Plan confirm failed" },
      { status: 500 },
    )
  }
}
