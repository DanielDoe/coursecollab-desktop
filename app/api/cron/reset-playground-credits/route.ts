import { NextRequest, NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/compliance/cron-auth"
import { grantWeeklyPlaygroundCreditsToAllEligibleStudents } from "@/lib/playground-weekly-credits"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Reset weekly playground credits for Scholar / Explorer students (PLAYGROUND_WEEKLY_CREDITS).
 * Runs weekly so students who never opened Playground still get their allowance on calendar week turn.
 */
export async function GET(request: NextRequest) {
  try {
    const cron = requireCronAuth(request)
    if (!cron.ok) return cron.response

    const result = await grantWeeklyPlaygroundCreditsToAllEligibleStudents()

    return NextResponse.json({
      success: true,
      inserted: result.inserted,
      reset: result.reset,
      weeklyCredits: result.weeklyCredits,
    })
  } catch (error) {
    console.error("[Cron] reset-playground-credits failed:", error)
    return NextResponse.json({ error: "Failed to reset playground credits" }, { status: 500 })
  }
}
