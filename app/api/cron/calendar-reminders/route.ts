import { NextRequest, NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/compliance/cron-auth"
import { dispatchDueCalendarReminders } from "@/lib/cora/automate-study-plan"
import { notifyStructuredSessionReminders } from "@/lib/schedule-adjustment/notifications"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

/** Sends push + in-app notifications for calendar events entering their reminder window. */
export async function GET(request: NextRequest) {
  try {
    const cron = requireCronAuth(request)
    if (!cron.ok) return cron.response

    const result = await dispatchDueCalendarReminders()
    const structuredReminders = await notifyStructuredSessionReminders()

    return NextResponse.json({
      success: true,
      ...result,
      structuredReminders,
    })
  } catch (error) {
    console.error("[Cron] calendar-reminders failed:", error)
    return NextResponse.json({ error: "Failed to dispatch calendar reminders" }, { status: 500 })
  }
}
