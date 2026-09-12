import { NextRequest, NextResponse } from "next/server"
import {
  buildAiMonitoringDifficulty,
  loadInstructorAiMonitoring,
} from "@/lib/instructor-ai-monitoring"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const ctx = await loadInstructorAiMonitoring(request)
    if (!ctx.ok) return ctx.response
    const days = Math.min(90, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("days") || "14", 10) || 14))
    const built = buildAiMonitoringDifficulty(ctx.turns, days)
    const topicDifficulty = built.topicDifficulty.map((topic) => ({
      ...topic,
      needsAttention: topic.difficulty_score >= 60,
      color:
        topic.category === "very_hard"
          ? "red"
          : topic.category === "hard"
            ? "orange"
            : topic.category === "moderate"
              ? "yellow"
              : "blue",
    }))
    const summary = {
      totalTopics: topicDifficulty.length,
      veryHard: topicDifficulty.filter((t) => t.category === "very_hard").length,
      hard: topicDifficulty.filter((t) => t.category === "hard").length,
      moderate: topicDifficulty.filter((t) => t.category === "moderate").length,
      medium: topicDifficulty.filter((t) => t.category === "medium").length,
      easy: 0,
      needingAttention: topicDifficulty.filter((t) => t.needsAttention).length,
      hardest: built.summary.hardest,
    }
    return NextResponse.json({
      success: true,
      topicDifficulty,
      summary,
      timeRange: `Last ${days} days`,
    })
  } catch (error) {
    console.error("[Instructor AI Monitoring - Difficulty Score Error]", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to calculate difficulty scores",
        topicDifficulty: [],
        summary: {
          totalTopics: 0,
          veryHard: 0,
          hard: 0,
          moderate: 0,
          medium: 0,
          easy: 0,
          needingAttention: 0,
        },
      },
      { status: 500 },
    )
  }
}
