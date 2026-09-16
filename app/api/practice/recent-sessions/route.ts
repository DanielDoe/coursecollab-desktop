import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { checkPracticeHubAccess } from "@/lib/practice-hub-access-server"
import { requireStudentPracticeCaller } from "@/lib/require-student-practice-auth"



export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const limit = searchParams.get("limit") || "5"

    const auth = await requireStudentPracticeCaller(request, studentId)
    if (!auth.ok) return auth.response

    const hubAccess = await checkPracticeHubAccess(auth.studentDbId)
    if (!hubAccess.allowed) return hubAccess.deniedResponse!

    const sessions = await sql`
      SELECT 
        id,
        topics[1] as topic,
        score_percentage as score,
        completed_at as created_at
      FROM practice_attempts
      WHERE student_id = ${auth.studentDbId}
        AND completed_at IS NOT NULL
      ORDER BY completed_at DESC
      LIMIT ${limit}
    `

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error("[v0] Error fetching recent sessions:", error)
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 })
  }
}
