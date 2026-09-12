import { NextRequest, NextResponse } from "next/server"
import {
  buildAiMonitoringStruggles,
  loadInstructorAiMonitoring,
} from "@/lib/instructor-ai-monitoring"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const ctx = await loadInstructorAiMonitoring(request)
    if (!ctx.ok) return ctx.response
    const hours = Math.min(720, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("hours") || "168", 10) || 168))
    const threshold = Math.min(20, Math.max(2, Number.parseInt(request.nextUrl.searchParams.get("threshold") || "2", 10) || 2))
    return NextResponse.json({
      success: true,
      ...buildAiMonitoringStruggles(ctx.turns, hours, threshold),
    })
  } catch (error) {
    console.error("[Instructor AI Monitoring - Struggle Alerts Error]", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch struggle alerts",
        struggles: [],
        topicSummary: [],
        criticalCount: 0,
        highCount: 0,
      },
      { status: 500 },
    )
  }
}
