import { NextRequest, NextResponse } from "next/server"
import { getStudentContextForCora } from "@/lib/cora/fetch-student-context"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    const studentIdNum = auth.studentDbId

    const payload = await getStudentContextForCora(studentIdNum)
    return NextResponse.json(payload)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("Error fetching student context:", error)
    return NextResponse.json(
      { error: "Failed to fetch student context", details: message },
      { status: 500 },
    )
  }
}
