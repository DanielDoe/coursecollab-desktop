import { type NextRequest, NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/compliance/cron-auth"
import { dispatchAssessmentReminders } from "@/lib/assessment-reminders"

/**
 * Legacy path — prefer /api/cron/assessment-reminders.
 * Kept for manual/ops callers; requires CRON_SECRET in production.
 */
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const cron = requireCronAuth(request)
    if (!cron.ok) return cron.response

    const result = await dispatchAssessmentReminders()
    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error("[v0] Failed to send deadline reminders:", error)
    return NextResponse.json({ error: "Failed to send deadline reminders" }, { status: 500 })
  }
}
