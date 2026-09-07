import { type NextRequest, NextResponse } from "next/server"
import { claimedStudentIdFromPlaygroundRequest } from "@/lib/playground-request-auth"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import { resolveStudentCourseContextFromRequest } from "@/lib/student-course-scope"
import { getPlaygroundPolicyForCourse } from "@/lib/playground-policy-settings.server"

export const dynamic = "force-dynamic"

/** Student-readable playground rules for the enrolled course. */
export async function GET(request: NextRequest) {
  try {
    const bound = await requireBoundStudentCaller(
      request,
      claimedStudentIdFromPlaygroundRequest(request),
    )
    if (!bound.ok) return bound.response

    const scope = await resolveStudentCourseContextFromRequest(request)
    if (!scope.ok) return scope.response

    const policy = await getPlaygroundPolicyForCourse(scope.ctx.courseId)

    return NextResponse.json({
      policy,
      leaderboardPrivacy: {
        blurPeerNames: policy.blur_leaderboard_peer_names,
      },
    })
  } catch (error) {
    console.error("[playground/policy GET]", error)
    return NextResponse.json({ error: "Failed to load playground policy" }, { status: 500 })
  }
}
