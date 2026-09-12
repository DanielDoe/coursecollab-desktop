import { NextRequest, NextResponse } from "next/server"
import {
  buildAiMonitoringActivity,
  loadInstructorAiMonitoring,
} from "@/lib/instructor-ai-monitoring"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const ctx = await loadInstructorAiMonitoring(request)
    if (!ctx.ok) return ctx.response
    const minutes = Math.min(43200, Math.max(15, Number.parseInt(request.nextUrl.searchParams.get("minutes") || "10080", 10) || 10080))
    return NextResponse.json({
      success: true,
      ...buildAiMonitoringActivity(ctx.turns, minutes),
    })
  } catch (error) {
    console.error("[Instructor AI Monitoring - Activity Error]", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch activity data",
        activity: [],
        stats: { active_students: 0, total_questions: 0, avg_response_time: 0, topics_discussed: 0 },
      },
      { status: 500 },
    )
  }
}
