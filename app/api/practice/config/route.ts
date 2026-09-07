import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getEffectiveMembershipTier } from "@/lib/membership"
import { getPracticeHubPolicyForCourse, getPracticeSessionConfig } from "@/lib/practice-hub-policy-settings.server"
import {
  parsePracticeHubPolicy,
  practiceHubDailyCapForTier,
  practiceHubPolicyForStudentClient,
  practiceHubWeeklyCapForTier,
  resolvePracticeSessionQuestionCount,
} from "@/lib/practice-hub-policy-settings"
import type { MembershipTier } from "@/lib/membership-constants"
import { practiceAccessForStudentClient } from "@/lib/practice-tier-access"
import { checkPracticeHubAccess } from "@/lib/practice-hub-access-server"
import { requireStudentPracticeCaller } from "@/lib/require-student-practice-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const session = searchParams.get("session") || "ALL"
    const courseIdParam = searchParams.get("courseId")
    const studentIdParam = searchParams.get("studentId")
    const courseId =
      courseIdParam != null && Number.isFinite(Number(courseIdParam)) ? Number(courseIdParam) : null

    const policy = await getPracticeHubPolicyForCourse(courseId)

    const sessionConfig = await getPracticeSessionConfig(session)

    const config = await sql`
      SELECT num_questions
      FROM practice_config
      WHERE session = ${session} OR session = 'ALL'
      ORDER BY CASE WHEN session = ${session} THEN 1 ELSE 2 END
      LIMIT 1
    `

    const legacyNumQuestions = config[0]?.num_questions
    const sessionDailyLimit = sessionConfig?.daily_limit
    const numQuestions =
      legacyNumQuestions != null
        ? Number(legacyNumQuestions)
        : sessionDailyLimit != null
          ? Number(sessionDailyLimit)
          : policy.default_questions_per_session

    let tierDailyCap: number | null = null
    let tierSessionMax: number | null = null
    let tierWeeklyCap: number | null = null
    let weeklyQuestionsUsed: number | null = null
    let membershipTier: string | null = null

    if (studentIdParam) {
      const auth = await requireStudentPracticeCaller(request, studentIdParam, session, courseIdParam)
      if (!auth.ok) return auth.response
      const sid = auth.studentDbId

      const hubAccess = await checkPracticeHubAccess(sid)
      if (!hubAccess.allowed) return hubAccess.deniedResponse!

      membershipTier = await getEffectiveMembershipTier(sid)
      tierDailyCap = practiceHubDailyCapForTier(membershipTier, policy)
      tierSessionMax = resolvePracticeSessionQuestionCount(membershipTier, policy)
      tierWeeklyCap = practiceHubWeeklyCapForTier(membershipTier, policy)
      if (tierWeeklyCap >= 0) {
        const usedWeek = await sql`
          SELECT COALESCE(SUM(pa.total_questions), 0)::int AS used
          FROM practice_attempts pa
          WHERE pa.student_id = ${sid}
            AND pa.started_at >= date_trunc('week', CURRENT_DATE)
        `
        weeklyQuestionsUsed = Number(usedWeek[0]?.used ?? 0)
      }
    }

    const fullTopicAccess = membershipTier === "Trailblazer"
    const access =
      membershipTier != null
        ? practiceAccessForStudentClient(membershipTier as MembershipTier, policy)
        : null

    return NextResponse.json({
      numQuestions: tierSessionMax ?? numQuestions,
      policy: practiceHubPolicyForStudentClient(policy),
      membershipTier,
      access,
      limits: {
        dailyQuestionCap: tierDailyCap,
        maxQuestionsPerSession: tierSessionMax,
        weeklyQuestionCap: tierWeeklyCap != null && tierWeeklyCap >= 0 ? tierWeeklyCap : null,
        weeklyQuestionsUsed,
        fullTopicAccess,
        unlockFraction: access?.unlockFraction ?? null,
      },
      leaderboardPrivacy: {
        blurPeerNames: policy.blur_leaderboard_peer_names,
        scholarLeaderboardAccess: policy.scholar_leaderboard_access,
      },
      difficultyWeights: {
        easy: policy.difficulty_easy_weight,
        medium: policy.difficulty_medium_weight,
        hard: policy.difficulty_hard_weight,
      },
    })
  } catch (error) {
    console.error("[v0] Error fetching practice config:", error)
    const fallback = parsePracticeHubPolicy(null)
    return NextResponse.json({
      numQuestions: fallback.default_questions_per_session,
      policy: practiceHubPolicyForStudentClient(fallback),
      limits: {},
      leaderboardPrivacy: { blurPeerNames: false, scholarLeaderboardAccess: false },
    })
  }
}
