import { NextRequest, NextResponse } from "next/server"
import {
  buildAiMonitoringPeakUsage,
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
      ...buildAiMonitoringPeakUsage(ctx.turns, days),
    })
  } catch (error) {
    console.error("[Instructor AI Monitoring - Peak Usage Error]", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch peak usage data",
        hourlyUsage: [],
        dailyUsage: [],
        dateUsage: [],
        peakHour: null,
        peakDay: null,
        timePatterns: { morning: 0, afternoon: 0, evening: 0, night: 0 },
      },
      { status: 500 },
    )
  }
}
