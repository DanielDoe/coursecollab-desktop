import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * POST /api/instructor/rollover/reset-all
 * Deletes all student_assessment_rollovers (for testing).
 * Requires instructor auth.
 */
export async function POST(request: NextRequest) {
  try {
    const instructorSession = request.headers.get("authorization") || request.headers.get("x-instructor-id")
    if (!instructorSession) {
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

    const before = await sql`SELECT COUNT(*)::int as n FROM student_assessment_rollovers`
    const count = before[0]?.n ?? 0

    await sql`DELETE FROM student_assessment_rollovers`

    return NextResponse.json({
      success: true,
      message: `Reset complete. Removed ${count} rollover record(s).`,
      removed: count,
    })
  } catch (error) {
    console.error("[Rollover Reset] Error:", error)
    return NextResponse.json(
      { error: "Failed to reset rollovers" },
      { status: 500 }
    )
  }
}
