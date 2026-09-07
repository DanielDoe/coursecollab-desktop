import { type NextRequest, NextResponse } from "next/server"
import {
  aggregateCoraTopics,
  coraInsightStats,
  loadCoraInsightTurns,
  resolveInsightScope,
} from "@/lib/cora/instructor-cora-insights"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { instructorId, courseId } = await resolveInsightScope(request)
  if (!instructorId) {
    return NextResponse.json({ error: "Unauthorized", insights: [] }, { status: 401 })
  }
  try {
    const turns = await loadCoraInsightTurns({ instructorId, courseId })
    const stats = coraInsightStats(turns)
    const top = aggregateCoraTopics(turns, 1)[0]
    const insights = [
      {
        label: "Cora turns (30d)",
        value: String(stats.totalQuestions),
        description: "Student Assistant questions",
        color: "blue",
      },
      {
        label: "Top topic",
        value: top?.topic ?? "—",
        description: top ? `${top.questions} questions from chat content` : "No course topics yet",
        color: "orange",
      },
      {
        label: "Active students",
        value: String(stats.activeStudents),
        description: "Used Cora in the last 7 days",
        color: "green",
      },
    ]
    return NextResponse.json({ insights })
  } catch (error) {
    console.error("[AI Tutor Analytics Insights] Error:", error)
    return NextResponse.json({ insights: [] })
  }
}
