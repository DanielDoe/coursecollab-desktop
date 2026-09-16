import { type NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { loadStudentCoraInsights } from "@/lib/cora/insights/student-self"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireCallerStudentDbId(request)
  if (!auth.ok) return auth.response
  try {
    const data = await loadStudentCoraInsights(auth.studentDbId)
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    console.error("[student/cora-insights]", error)
    return NextResponse.json({ error: "Failed to load Cora Insights" }, { status: 500 })
  }
}
