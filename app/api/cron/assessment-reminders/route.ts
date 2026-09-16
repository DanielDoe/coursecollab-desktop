import { NextRequest, NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/compliance/cron-auth"
import { dispatchAssessmentReminders } from "@/lib/assessment-reminders"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Dispatches student in-app + Expo push when:
 * - available_from just arrived (assessment is open to take)
 * - available_until is within the next 24 hours (due soon)
 */
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
    console.error("[Cron] assessment-reminders failed:", error)
    return NextResponse.json({ error: "Failed to dispatch assessment reminders" }, { status: 500 })
  }
}
