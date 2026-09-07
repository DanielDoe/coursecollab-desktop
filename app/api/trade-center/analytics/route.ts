import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { fetchTradeCenterAnalytics } from "@/lib/trade-center-analytics-query"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const courseId = scope.course.id
    const { searchParams } = new URL(request.url)
    const sectionFilter = searchParams.get("session") || "ALL"

    const payload = await fetchTradeCenterAnalytics(courseId, sectionFilter)

    return NextResponse.json({
      stats: payload.stats,
      topTraders: payload.topTraders,
      transactions: payload.transactions,
      sessionBreakdown: payload.sessionBreakdown,
      lowEngagement: payload.lowEngagement,
      tradesOverTime: payload.tradesOverTime,
      weekStartDate: payload.weekStartDate,
      calendarWeekStart: payload.calendarWeekStart,
      usedFallbackWeek: payload.usedFallbackWeek,
    })
  } catch (error) {
    console.error("Error fetching trade center analytics:", error)
    return NextResponse.json(
      { error: "Failed to fetch trade center analytics" },
      { status: 500 },
    )
  }
}
