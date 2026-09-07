import { type NextRequest, NextResponse } from "next/server"
import { getStudentAskCoraAssistance } from "@/lib/cora/assessment-policy-analytics"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireCallerStudentDbId(request)
  if (!auth.ok) return auth.response
  const assistance = await getStudentAskCoraAssistance(auth.studentDbId)
  return NextResponse.json({ assistance })
}
