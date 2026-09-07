import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    if (!studentId) {
      return NextResponse.json({ error: "Missing studentId" }, { status: 400 })
    }

    // Count AI questions asked today
    const result = await sql`
      SELECT COUNT(*) as count
      FROM ai_tutor_logs
      WHERE student_id = ${Number.parseInt(studentId)}
      AND DATE(created_at) = CURRENT_DATE
    `

    return NextResponse.json({ questionsUsed: Number.parseInt(result[0]?.count || "0") })
  } catch (error) {
    console.error("AI usage fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch usage" }, { status: 500 })
  }
}
