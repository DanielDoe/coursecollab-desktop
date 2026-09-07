import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  try {
    const { attemptId, quizId, studentId } = await request.json()

    if (!attemptId || !quizId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    console.log("[v0] DEBUG Forfeiting retake:", { attemptId, quizId, studentId })

    // Mark this specific attempt as viewed and final
    await sql`
      UPDATE quiz_attempts
      SET has_viewed_report = true, is_final_grade = true
      WHERE id = ${attemptId}
    `

    console.log("[v0] DEBUG Retake forfeited successfully - marked attempt as viewed")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to forfeit retake:", error)
    return NextResponse.json({ error: "Failed to forfeit retake" }, { status: 500 })
  }
}
