import { type NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    const studentIdHeader = String(auth.studentDbId)

    if (!studentIdHeader) {
      return NextResponse.json({ error: "Student ID required" }, { status: 401 })
    }

    const { xpEarned, questionsAnswered = 0, correctAnswers = 0, topics = [] } = await request.json()

    if (!xpEarned && xpEarned !== 0) {
      return NextResponse.json({ error: "XP amount required" }, { status: 400 })
    }

    // Call the database function to update progress
    const result = await sql`
      SELECT update_student_progress(
        ${studentIdHeader}::INTEGER,
        ${xpEarned}::INTEGER,
        ${questionsAnswered}::INTEGER,
        ${correctAnswers}::INTEGER,
        ${topics}::TEXT[]
      ) as progress_data
    `

    const progressData = result[0]?.progress_data

    if (!progressData) {
      return NextResponse.json({ error: "Failed to update progress" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      progress: progressData
    })
  } catch (error) {
    console.error("[Student Progress] Failed to update progress:", error)
    return NextResponse.json({ error: "Failed to update progress" }, { status: 500 })
  }
}
