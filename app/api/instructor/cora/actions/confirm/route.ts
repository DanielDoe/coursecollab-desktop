import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { buildFacultyCoraSession } from "@/lib/cora/security"
import { confirmCoraActionProposal } from "@/lib/cora/confirmations/confirm-action"
import type { CoraActionProposal } from "@/lib/cora/confirmations/action-proposals"

export const dynamic = "force-dynamic"

/**
 * POST /api/instructor/cora/actions/confirm
 * Execute a signed Cora action proposal after explicit UI confirmation.
 */
export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const body = (await request.json()) as { proposal?: CoraActionProposal }
    if (!body.proposal?.actionId || !body.proposal?.hash) {
      return NextResponse.json({ error: "proposal required" }, { status: 400 })
    }

    const session = await buildFacultyCoraSession({
      instructorId: scope.instructorId,
      courseId: scope.course.id,
      courseCode: scope.course.course_code ?? null,
      courseTitle: scope.course.course_title ?? null,
    })

    const result = await confirmCoraActionProposal({
      session,
      proposal: body.proposal,
      courseId: scope.course.id,
    })

    if (!result.success) {
      return NextResponse.json(result, { status: 403 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[instructor/cora/actions/confirm]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Confirm failed" },
      { status: 500 },
    )
  }
}
