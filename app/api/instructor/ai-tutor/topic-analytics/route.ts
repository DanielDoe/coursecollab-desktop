import { type NextRequest, NextResponse } from "next/server"
import {
  aggregateCoraTopics,
  loadCoraInsightTurns,
  resolveInsightScope,
} from "@/lib/cora/instructor-cora-insights"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { instructorId, courseId } = await resolveInsightScope(request)
  if (!instructorId) {
    return NextResponse.json({ error: "Unauthorized", topics: [] }, { status: 401 })
  }
  try {
    const turns = await loadCoraInsightTurns({ instructorId, courseId })
    return NextResponse.json({ topics: aggregateCoraTopics(turns, 10) })
  } catch (error) {
    console.error("[AI Tutor Topic Analytics] Error:", error)
    return NextResponse.json({ topics: [] })
  }
}
