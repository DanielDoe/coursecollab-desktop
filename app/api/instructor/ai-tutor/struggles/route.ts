import { type NextRequest, NextResponse } from "next/server"
import {
  coraStruggleRows,
  loadCoraInsightTurns,
  resolveInsightScope,
} from "@/lib/cora/instructor-cora-insights"
import { listConsentedStudentIds } from "@/lib/cora/instructor-share-consent"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { instructorId, courseId } = await resolveInsightScope(request)
  if (!instructorId) {
    return NextResponse.json({ error: "Unauthorized", struggles: [] }, { status: 401 })
  }
  try {
    const turns = await loadCoraInsightTurns({ instructorId, courseId })
    const consented = await listConsentedStudentIds(turns.map((turn) => turn.studentId))
    const shared = turns.filter((turn) => consented.has(turn.studentId))
    return NextResponse.json({ struggles: coraStruggleRows(shared) })
  } catch (error) {
    console.error("[AI Tutor Struggles] Error:", error)
    return NextResponse.json({ struggles: [] })
  }
}
