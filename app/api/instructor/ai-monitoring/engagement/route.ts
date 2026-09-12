import { NextRequest, NextResponse } from "next/server"
import {
  buildAiMonitoringEngagement,
  loadInstructorAiMonitoring,
} from "@/lib/instructor-ai-monitoring"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const ctx = await loadInstructorAiMonitoring(request)
    if (!ctx.ok) return ctx.response
    const days = Math.min(90, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("days") || "7", 10) || 7))
    return NextResponse.json({
      success: true,
      ...buildAiMonitoringEngagement(ctx.turns, ctx.rosterIds, days, ctx.roster),
    })
  } catch (error) {
    console.error("[Instructor AI Monitoring - Engagement Error]", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch engagement data",
        totalStudents: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        engagementRate: 0,
        engagementLevels: { high: 0, medium: 0, low: 0, none: 0 },
        activeUsersList: [],
        inactiveUsersList: [],
      },
      { status: 500 },
    )
  }
}
