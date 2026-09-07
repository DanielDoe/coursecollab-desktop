import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { examId, studentId, timestamp, isActive } = await request.json()

    if (!examId || !studentId) {
      return NextResponse.json({ error: "Exam ID and Student ID required" }, { status: 400 })
    }

    // Log heartbeat (you can create a heartbeat_logs table if needed)
    // For now, we'll just validate the request
    console.log(`[Heartbeat] Student ${studentId} - Exam ${examId} - Active: ${isActive} - ${timestamp}`)

    // Check if student has an active attempt
    const attempt = await sql`
      SELECT id, started_at, completed_at
      FROM quiz_attempts
      WHERE quiz_id = ${examId}
      AND student_id = ${studentId}
      AND completed_at IS NULL
      ORDER BY started_at DESC
      LIMIT 1
    `

    if (attempt.length === 0) {
      return NextResponse.json({ error: "No active attempt found" }, { status: 404 })
    }

    // Update last activity timestamp (if you have a last_activity column)
    // For now, just return success

    return NextResponse.json({ 
      success: true, 
      isActive,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error("[Heartbeat] Error:", error)
    return NextResponse.json(
      { error: "Failed to process heartbeat", details: error.message },
      { status: 500 }
    )
  }
}

