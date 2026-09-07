import { type NextRequest, NextResponse } from "next/server"
import {
  ensureCreditAccount,
  migrateOpeningBalanceFromLegacy,
  sumUsageForUser,
} from "@/lib/cora/ai"
import { resolveAuthenticatedCoraActor } from "@/lib/cora/ai/request-context"
import {
  instructorPeriodAllocation,
  studentMonthlyAllocation,
  type InstructorCoraTier,
  type StudentCoraTier,
} from "@/lib/cora/credits/economy"
import { getEffectiveMembershipTier } from "@/lib/membership"
import { getInstructorMembership } from "@/lib/instructor-membership"

export const dynamic = "force-dynamic"

/**
 * GET /api/cora/credits/balance?role=student|instructor|admin
 * Auth via x-student-id / x-instructor-id / x-admin-id — query userId is ignored.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const actor = await resolveAuthenticatedCoraActor(request, searchParams.get("role"))
    if (!actor.ok) return actor.response

    const { userId, userRole: role } = actor

    let membershipTier: string | null = null
    let billingCadence: "semester" | "annual" | null = null
    if (role === "student") {
      membershipTier = await getEffectiveMembershipTier(userId)
      await migrateOpeningBalanceFromLegacy({
        userId,
        userRole: "student",
        membershipTier,
      })
    } else if (role === "instructor") {
      const m = await getInstructorMembership(userId)
      membershipTier = m?.tier ?? "Free"
      billingCadence = m?.membership?.billingCadence ?? "semester"
      await migrateOpeningBalanceFromLegacy({
        userId,
        userRole: "instructor",
        membershipTier,
      })
    }

    const account = await ensureCreditAccount({
      userId,
      userRole: role,
      membershipTier,
      billingCadence,
    })

    const monthStart = new Date()
    monthStart.setUTCDate(1)
    monthStart.setUTCHours(0, 0, 0, 0)
    const month = await sumUsageForUser({ userRole: role, userId, since: monthStart })
    const { sql } = await import("@/lib/db")
    const byFeatureRows = (await sql`
      SELECT COALESCE(NULLIF(feature, ''), 'other') AS feature,
             COALESCE(SUM(credits_charged), 0)::int AS credits
      FROM cora_usage_events
      WHERE user_role = ${role}
        AND user_id = ${userId}
        AND created_at >= ${monthStart.toISOString()}
      GROUP BY 1
      ORDER BY credits DESC
    `) as Array<{ feature: string; credits: number }>

    const nextReset = (() => {
      const [y, m] = account.periodKey.split("-").map(Number)
      if (!y || !m) return null
      return new Date(Date.UTC(y, m, 1)).toISOString()
    })()

    const includedCapHint =
      role === "student"
        ? studentMonthlyAllocation((membershipTier as StudentCoraTier) || "Scholar")
        : role === "instructor"
          ? instructorPeriodAllocation(
              (membershipTier as InstructorCoraTier) || "Free",
              billingCadence ?? "semester",
            )
          : Math.max(account.available, 1)

    let available = account.available
    let institutionRemaining: number | null = null
    if (role === "student" || role === "instructor") {
      try {
        const { getCoraAllowance } = await import("@/lib/institutions/cora")
        const { studentSpendableCredits } = await import("@/lib/institutions/cora-spend")
        const allowance = await getCoraAllowance(
          role === "instructor" ? "instructor" : "student",
          userId,
        )
        institutionRemaining = allowance.institutionPool?.remaining ?? null
        available = studentSpendableCredits(account.available, allowance.institutionPool)
      } catch {
        /* personal balance only */
      }
    }

    const monthlyOrSemester = Math.max(1, includedCapHint)
    const lowBalanceFraction = available / monthlyOrSemester

    return NextResponse.json({
      credits: available,
      includedBalance: account.includedBalance,
      purchasedBalance: account.purchasedBalance,
      reservedCredits: account.reservedCredits,
      periodKey: account.periodKey,
      lifetimeCreditsUsed: account.lifetimeCreditsUsed,
      membershipTier: account.membershipTier,
      lowBalanceFraction,
      coraMode: available > 0 ? "premium" : "lite",
      isLow: lowBalanceFraction > 0 && lowBalanceFraction <= 0.25,
      isCritical: lowBalanceFraction > 0 && lowBalanceFraction <= 0.1,
      institutionRemaining,
      warning:
        available <= 0
          ? "You've used your premium Cora Credits for this period."
          : lowBalanceFraction > 0 && lowBalanceFraction <= 0.1
            ? "You're almost out of premium Cora Credits."
            : lowBalanceFraction > 0 && lowBalanceFraction <= 0.25
              ? "Your Cora Credits are getting low."
              : null,
      month: {
        creditsUsed: Math.max(month.creditsCharged, account.periodCreditsUsed ?? 0),
        interactions:
          month.interactions > 0
            ? month.interactions
            : Math.max(
                month.agentRuns,
                account.periodCreditsUsed > 0
                  ? Math.max(1, Math.round(account.periodCreditsUsed / 5))
                  : 0,
              ),
        agentRuns: month.agentRuns,
        tokensProcessed: month.totalTokens,
        inputTokens: month.inputTokens,
        cachedInputTokens: month.cachedInputTokens,
        outputTokens: month.outputTokens,
        reasoningTokens: month.reasoningTokens,
        byFeature: byFeatureRows.map((r) => ({
          feature: r.feature,
          credits: Number(r.credits ?? 0),
        })),
      },
      providerCostUsd: role === "admin" ? month.providerCostUsd : undefined,
      includedCapHint,
      nextReset,
      entitlementSource:
        role === "student"
          ? await (await import("@/lib/membership")).getMembershipEntitlementSource(userId)
          : "personal_purchase",
    })
  } catch (error) {
    console.error("[cora/credits/balance]", error)
    return NextResponse.json({ error: "Failed to load balance" }, { status: 500 })
  }
}
