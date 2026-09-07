import { NextResponse } from "next/server"
import {
  deductPlaygroundCredits,
  getEffectiveMembershipTier,
  getPlaygroundCredits,
  hasActiveDonationTrial,
  isBetaUser,
} from "@/lib/membership"
import { MEMBERSHIP_PLANS, PLAYGROUND_WEEKLY_CREDITS } from "@/lib/membership-constants"

export type PlaygroundCreditGate =
  | { allowed: true; unlimited: true }
  | { allowed: true; unlimited: false; creditsRemaining: number }
  | { allowed: false; response: NextResponse }

export function playgroundInsufficientCreditsResponse(
  creditsRemaining: number,
  weeklyLimit: number = PLAYGROUND_WEEKLY_CREDITS,
  tierLabel = "Scholar",
) {
  return NextResponse.json(
    {
      error: `You've used your ${weeklyLimit} free playground sessions for this week (${tierLabel} plan includes ${weeklyLimit} per week). Credits reset every Monday.`,
      creditsRemaining,
      insufficientCredits: true,
    },
    { status: 403 },
  )
}

export async function checkPlaygroundJoinCredits(
  studentDatabaseId: number,
): Promise<PlaygroundCreditGate> {
  if (await isBetaUser(studentDatabaseId)) {
    return { allowed: true, unlimited: true }
  }

  const tier = await getEffectiveMembershipTier(studentDatabaseId)
  const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)
  const creditsLimit = plan?.features.playgroundCredits
  const hasDonationAccess = await hasActiveDonationTrial(studentDatabaseId)

  if (creditsLimit === "unlimited" || hasDonationAccess) {
    return { allowed: true, unlimited: true }
  }

  const currentCredits = await getPlaygroundCredits(studentDatabaseId)
  const weeklyLimit =
    typeof creditsLimit === "number" ? creditsLimit : PLAYGROUND_WEEKLY_CREDITS
  if (currentCredits <= 0) {
    return {
      allowed: false,
      response: playgroundInsufficientCreditsResponse(0, weeklyLimit, tier),
    }
  }

  return { allowed: true, unlimited: false, creditsRemaining: currentCredits }
}

export async function deductPlaygroundJoinCredit(studentDatabaseId: number): Promise<PlaygroundCreditGate> {
  const gate = await checkPlaygroundJoinCredits(studentDatabaseId)
  if (!gate.allowed) return gate
  if (gate.unlimited) return gate

  const deducted = await deductPlaygroundCredits(studentDatabaseId, 1)
  if (!deducted) {
    const remaining = await getPlaygroundCredits(studentDatabaseId)
    if (remaining <= 0) {
      const tier = await getEffectiveMembershipTier(studentDatabaseId)
      const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)
      const creditsLimit = plan?.features.playgroundCredits
      const weeklyLimit =
        typeof creditsLimit === "number" ? creditsLimit : PLAYGROUND_WEEKLY_CREDITS
      return {
        allowed: false,
        response: playgroundInsufficientCreditsResponse(0, weeklyLimit, tier),
      }
    }
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: `Unable to join playground. You have ${remaining} credit(s) left—please try again.`,
          creditsRemaining: remaining,
        },
        { status: 403 },
      ),
    }
  }

  const creditsRemaining = await getPlaygroundCredits(studentDatabaseId)
  return { allowed: true, unlimited: false, creditsRemaining }
}
