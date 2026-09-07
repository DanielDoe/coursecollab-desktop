import { type NextRequest, NextResponse } from "next/server"
import {
  coraNarrativeInsights,
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
    return NextResponse.json({ insights: coraNarrativeInsights(turns) })
  } catch (error) {
    console.error("[AI Tutor Insights] Error:", error)
    return NextResponse.json({ insights: [] })
  }
}
