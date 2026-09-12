import { NextRequest, NextResponse } from "next/server"
import {
  buildAiMonitoringHotTopics,
  loadInstructorAiMonitoring,
} from "@/lib/instructor-ai-monitoring"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const ctx = await loadInstructorAiMonitoring(request)
    if (!ctx.ok) return ctx.response
    const hours = Math.min(720, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("hours") || "168", 10) || 168))
    return NextResponse.json({
      success: true,
      ...buildAiMonitoringHotTopics(ctx.turns, hours),
    })
  } catch (error) {
    console.error("[Instructor AI Monitoring - Hot Topics Error]", error)
    return NextResponse.json({ success: false, error: "Failed to fetch hot topics", hotTopics: [] }, { status: 500 })
  }
}
