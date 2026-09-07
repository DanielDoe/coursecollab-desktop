import { type NextRequest, NextResponse } from "next/server"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import { getTodayStructuredSessionForStudent } from "@/lib/attendance/self-checkin"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const bound = await requireBoundStudentCaller(request, searchParams.get("studentId"))
  if (!bound.ok) return bound.response

  const session = await getTodayStructuredSessionForStudent(bound.studentDbId)
  return NextResponse.json({ success: true, session })
}
