import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const { studentDatabaseId } = await request.json()

    if (!studentDatabaseId) {
      return NextResponse.json({ error: "Student ID required" }, { status: 400 })
    }

    const sql = getSQL()

    // Check for approved password reset request
    const requests = await sql`
      SELECT id, status FROM password_reset_requests
      WHERE student_id = ${studentDatabaseId} 
        AND status = 'approved'
      ORDER BY requested_at DESC
      LIMIT 1
    `

    if (requests.length > 0) {
      return NextResponse.json({ hasApprovedRequest: true, requestId: requests[0].id })
    }

    return NextResponse.json({ hasApprovedRequest: false })
  } catch (error) {
    console.error("[v0] Failed to check reset approval:", error)
    return NextResponse.json({ error: "Failed to check approval status" }, { status: 500 })
  }
}
