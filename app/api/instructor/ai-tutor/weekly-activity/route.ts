import { type NextRequest, NextResponse } from "next/server"
import {
  loadCoraInsightTurns,
  resolveInsightScope,
  weeklyCoraActivity,
} from "@/lib/cora/instructor-cora-insights"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { instructorId, courseId } = await resolveInsightScope(request)
  if (!instructorId) {
    return NextResponse.json({ error: "Unauthorized", weeklyData: [] }, { status: 401 })
  }
  try {
    const turns = await loadCoraInsightTurns({ instructorId, courseId })
    return NextResponse.json({ weeklyData: weeklyCoraActivity(turns) })
  } catch (error) {
    console.error("[AI Tutor Weekly Activity] Error:", error)
    return NextResponse.json({ weeklyData: [] })
  }
}
