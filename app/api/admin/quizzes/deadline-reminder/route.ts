import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { dispatchAssessmentReminders } from "@/lib/assessment-reminders"

/**
 * Manual admin trigger for assessment open + due-soon reminders.
 * Production scheduling uses /api/cron/assessment-reminders.
 */
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
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
