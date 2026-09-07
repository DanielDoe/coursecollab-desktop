import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const { attemptId } = await request.json()

    if (!attemptId) {
      return NextResponse.json({ error: "Attempt ID is required" }, { status: 400 })
    }

    console.log("[v0] Forfeiting mid-semester retake for attempt:", attemptId)

    const [attempt] = await sql`
      SELECT mid_semester_id, student_id
      FROM mid_semester_attempts
      WHERE id = ${attemptId}
    `

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 })
    }

    await sql`
      UPDATE mid_semester_attempts
      SET 
        has_viewed_report = true,
        is_final_grade = true
      WHERE id = ${attemptId}
    `

    await sql`
      UPDATE mid_semesters
      SET retake_limit = 0
      WHERE id = ${attempt.mid_semester_id}
    `

    console.log("[v0] Mid-semester retake forfeited successfully")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to forfeit mid-semester retake:", error)
    return NextResponse.json({ error: "Failed to forfeit retake" }, { status: 500 })
  }
}
