import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { ensurePlatformActivitySchema } from "@/lib/ensure-platform-activity-schema"
import { buildLast7DaySeries } from "@/lib/dashboard-v2/chart-series"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId

    await ensurePlatformActivitySchema()

    const [platformEventsByDay, portalBreakdown] = await Promise.all([
      sql`
        SELECT (created_at AT TIME ZONE 'UTC')::date AS date, COUNT(*)::int AS count
        FROM platform_activity_logs
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY (created_at AT TIME ZONE 'UTC')::date
        ORDER BY date ASC
      `.catch(() => []),
      sql`
        SELECT portal, COUNT(*)::int AS count
        FROM platform_activity_logs
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY portal
        ORDER BY count DESC
      `.catch(() => []),
    ])

    const enrollmentTrend = buildLast7DaySeries(platformEventsByDay as { date: Date; count: number }[])

    return NextResponse.json({
      enrollmentTrend,
      platformEventsByDay: enrollmentTrend,
      portalBreakdown,
    })
  } catch (error) {
    console.error("Failed to fetch admin dashboard charts:", error)
    return NextResponse.json({ error: "Failed to fetch charts" }, { status: 500 })
  }
}
