import { type NextRequest, NextResponse } from "next/server"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import {
  getClassroomApprovedTotal,
  getClassroomTradableAmount,
  MIN_CLASSROOM_PEER_RESERVE,
} from "@/lib/trade-center-peer-transfer"

export const dynamic = "force-dynamic"

/**
 * GET ?studentId=&session= — approved classroom total and amount tradable after full-grade reserve
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const session = searchParams.get("session")
    const bound = await requireBoundStudentCaller(request, studentId)
    if (!bound.ok) return bound.response
    if (!session) {
      return NextResponse.json({ error: "studentId and session required" }, { status: 400 })
    }
    const approvedTotal = await getClassroomApprovedTotal(bound.studentDbId, session)
    const tradable = getClassroomTradableAmount(approvedTotal)
    return NextResponse.json({
      approvedTotal,
      tradable,
      minReserve: MIN_CLASSROOM_PEER_RESERVE,
    })
  } catch (e) {
    console.error("classroom-transfer-eligibility", e)
    return NextResponse.json({ error: "Failed to load eligibility" }, { status: 500 })
  }
}
