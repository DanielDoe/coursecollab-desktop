import { type NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import {
  advanceStudentIntervention,
  listOpenInterventionsForStudent,
  markInterventionsViewedForStudent,
} from "@/lib/institutions/interventions"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireCallerStudentDbId(request)
  if (!auth.ok) return auth.response

  const interventions = await listOpenInterventionsForStudent(auth.studentDbId)
  const markViewed = request.nextUrl.searchParams.get("markViewed") === "1"
  if (markViewed && interventions.length > 0) {
    void markInterventionsViewedForStudent(
      auth.studentDbId,
      interventions.map((row) => row.id),
    ).catch(() => undefined)
  }

  return NextResponse.json({ interventions })
}

export async function POST(request: NextRequest) {
  const auth = await requireCallerStudentDbId(request)
  if (!auth.ok) return auth.response

  const body = (await request.json().catch(() => ({}))) as {
    interventionId?: number
    action?: "viewed" | "engaged" | "completed"
  }
  const interventionId = Number(body.interventionId)
  const action = body.action ?? "engaged"
  if (!Number.isFinite(interventionId) || interventionId <= 0) {
    return NextResponse.json({ error: "interventionId is required" }, { status: 400 })
  }
  if (!["viewed", "engaged", "completed"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }

  const ok = await advanceStudentIntervention({
    studentId: auth.studentDbId,
    interventionId,
    action,
  })
  if (!ok) return NextResponse.json({ error: "Intervention not found" }, { status: 404 })
  return NextResponse.json({ success: true })
}
