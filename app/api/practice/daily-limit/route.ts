import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getEffectiveMembershipTier } from "@/lib/membership"
import { getPracticeHubPolicyForCourse, getPracticeSessionConfig } from "@/lib/practice-hub-policy-settings.server"
import { practiceHubDailyCapForTier } from "@/lib/practice-hub-policy-settings"
import { requireStudentPracticeCaller } from "@/lib/require-student-practice-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const session = searchParams.get("session")
    const courseIdParam = searchParams.get("courseId")

    const auth = await requireStudentPracticeCaller(request, studentId, session, courseIdParam)
    if (!auth.ok) return auth.response

    const sid = auth.studentDbId
    let courseId =
      courseIdParam != null && Number.isFinite(Number(courseIdParam)) ? Number(courseIdParam) : null

    if (courseId == null) {
      courseId = auth.ctx.courseId
    }

    const policy = await getPracticeHubPolicyForCourse(courseId)
    const tier = await getEffectiveMembershipTier(sid)
    const tierDailyCap = practiceHubDailyCapForTier(tier, policy)

    const sessionConfig = await getPracticeSessionConfig(session)
    const policyDefault =
      sessionConfig?.daily_limit != null
        ? Number(sessionConfig.daily_limit)
        : policy.default_questions_per_session

    const limitResult = await sql`
      SELECT COALESCE(MAX(daily_limit), 10) as daily_limit
      FROM practice_topic_availability
      WHERE (session = ${session} OR session = 'ALL')
        AND is_available = true
    `
    const topicDailyLimit = Number(limitResult[0]?.daily_limit) || policyDefault

    let effectiveLimit = topicDailyLimit
    if (tierDailyCap >= 0) {
      effectiveLimit = Math.min(topicDailyLimit, tierDailyCap)
    } else {
      effectiveLimit = topicDailyLimit
    }

    const remainingResult = await sql`
      SELECT get_daily_practice_remaining(${sid}, ${effectiveLimit}) as remaining
    `
    const remaining = Number(remainingResult[0]?.remaining) || 0

    return NextResponse.json({
      dailyLimit: effectiveLimit,
      remaining,
      unlimited: tierDailyCap < 0 && remaining === -1,
      membershipTier: tier,
      tierDailyCap,
      topicDailyLimit,
    })
  } catch (error) {
    console.error("[v0] Error checking daily limit:", error)
    return NextResponse.json({ error: "Failed to check daily limit" }, { status: 500 })
  }
}
