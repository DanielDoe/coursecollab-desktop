import { type NextRequest, NextResponse } from "next/server"
import {
  coraInsightStats,
  loadCoraInsightTurns,
  resolveInsightScope,
} from "@/lib/cora/instructor-cora-insights"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { instructorId, courseId } = await resolveInsightScope(request)
  if (!instructorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const turns = await loadCoraInsightTurns({ instructorId, courseId })
    return NextResponse.json({ stats: coraInsightStats(turns) })
  } catch (error) {
    console.error("[AI Tutor Stats] Error:", error)
    return NextResponse.json({
      stats: {
        totalQuestions: 0,
        activeStudents: 0,
        averageResponseTime: 0,
        satisfactionScore: 0,
        strugglingStudents: 0,
        weeklyGrowth: 0,
      },
    })
  }
}
