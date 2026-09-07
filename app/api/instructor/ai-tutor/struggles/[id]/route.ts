import { type NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { status } = await request.json()
    const sql = getSQL()

    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 })
    }

    const validStatuses = ["new", "reviewed", "resolved", "escalated"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const struggleId = params.id

    // Check if struggle exists
    const existingStruggle = await sql`
      SELECT id FROM ai_tutor_struggles WHERE id = ${struggleId}
    `

    if (existingStruggle.length === 0) {
      return NextResponse.json({ error: "Struggle not found" }, { status: 404 })
    }

    // Update the struggle status
    await sql`
      UPDATE ai_tutor_struggles 
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${struggleId}
    `

    return NextResponse.json({ 
      message: "Struggle status updated successfully",
      status: status
    })
  } catch (error) {
    console.error("[v0] Failed to update struggle status:", error)
    return NextResponse.json({ error: "Failed to update struggle status" }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sql = getSQL()
    const struggleId = params.id

    // Fetch detailed struggle information
    const struggle = await sql`
      SELECT 
        ats.id,
        s.full_name as student_name,
        s.student_id,
        ats.topic,
        ats.severity,
        ats.status,
        ats.description,
        ats.created_at,
        ats.updated_at,
        COUNT(atc.id) as conversation_count
      FROM ai_tutor_struggles ats
      JOIN students s ON ats.student_id = s.id
      LEFT JOIN ai_tutor_conversations atc ON s.id = atc.student_id AND atc.topic = ats.topic
      WHERE ats.id = ${struggleId}
      GROUP BY ats.id, s.full_name, s.student_id, ats.topic, ats.severity, ats.status, ats.description, ats.created_at, ats.updated_at
    `

    if (struggle.length === 0) {
      return NextResponse.json({ error: "Struggle not found" }, { status: 404 })
    }

    const formattedStruggle = {
      id: struggle[0].id,
      studentName: struggle[0].student_name,
      studentId: struggle[0].student_id,
      topic: struggle[0].topic,
      severity: struggle[0].severity,
      status: struggle[0].status,
      description: struggle[0].description,
      createdAt: struggle[0].created_at,
      lastUpdated: struggle[0].updated_at,
      conversationCount: struggle[0].conversation_count
    }

    return NextResponse.json({ struggle: formattedStruggle })
  } catch (error) {
    console.error("[v0] Failed to fetch struggle details:", error)
    return NextResponse.json({ error: "Failed to fetch struggle details" }, { status: 500 })
  }
}
