import { type NextRequest, NextResponse } from "next/server"
import { getEffectiveMembershipTier } from "@/lib/membership"
import { checkPracticeHubAccess } from "@/lib/practice-hub-access-server"
import { getPracticeHubPolicyForCourse } from "@/lib/practice-hub-policy-settings.server"
import { requireStudentPracticeCaller } from "@/lib/require-student-practice-auth"
import { listPracticeTopicsWithProgress } from "@/lib/student-practice-scope"
import {
  practiceAccessForStudentClient,
  unlockedQuestionCountForTier,
} from "@/lib/practice-tier-access"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const session = searchParams.get("session")
    const courseId = searchParams.get("courseId")

    const auth = await requireStudentPracticeCaller(request, studentId, session, courseId)
    if (!auth.ok) return auth.response
    const scope = { ctx: auth.ctx }

    const hubPolicy = await getPracticeHubPolicyForCourse(scope.ctx.courseId)
    const hubAccess = await checkPracticeHubAccess(scope.ctx.studentDbId)
    const membershipTier = hubAccess.tier
    const access = practiceAccessForStudentClient(membershipTier, hubPolicy)

    if (!hubAccess.allowed) {
      return NextResponse.json({
        topics: [],
        access,
        courseId: scope.ctx.courseId,
        courseCode: scope.ctx.sessionCode ?? scope.ctx.section,
        membershipTier,
      })
    }

    const topics = await listPracticeTopicsWithProgress(scope.ctx.studentDbId, scope.ctx)

    return NextResponse.json({
      topics: topics.map((t) => {
        const questionCount = Number(t.question_count)
        const unlockedCount = unlockedQuestionCountForTier(membershipTier, questionCount, hubPolicy)
        return {
          name: t.name,
          questionCount,
          unlockedCount,
          lockedCount: Math.max(0, questionCount - unlockedCount),
          completed: Number(t.completed),
          correct: Number(t.correct),
          accuracy: Number(t.accuracy),
          lastPracticed: t.last_practiced,
        }
      }),
      access,
      courseId: scope.ctx.courseId,
      courseCode: scope.ctx.sessionCode ?? scope.ctx.section,
      membershipTier,
    })
  } catch (error) {
    console.error("[practice/topics-progress]", error)
    return NextResponse.json({ error: "Failed to fetch topics" }, { status: 500 })
  }
}
