import { NextRequest, NextResponse } from "next/server"
import { requireCronAuth } from "@/lib/compliance/cron-auth"
import { dispatchClassroomPointsDueReminders } from "@/lib/classroom-points-reminders"
import { dispatchOfficeHoursReminders } from "@/lib/office-hours-reminders"
import { dispatchProjectDueReminders } from "@/lib/project-reminders"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * Due-soon / upcoming reminders beyond assessments:
 * classroom points, projects, office hours.
 * Assessment open/due uses /api/cron/assessment-reminders.
 */
export async function GET(request: NextRequest) {
  try {
    const cron = requireCronAuth(request)
    if (!cron.ok) return cron.response

    const [classroomPoints, projects, officeHours] = await Promise.all([
      dispatchClassroomPointsDueReminders(),
      dispatchProjectDueReminders(),
      dispatchOfficeHoursReminders(),
    ])

    return NextResponse.json({
      success: true,
      classroomPoints,
      projects,
      officeHours,
    })
  } catch (error) {
    console.error("[Cron] student-reminders failed:", error)
    return NextResponse.json({ error: "Failed to dispatch student reminders" }, { status: 500 })
  }
}
