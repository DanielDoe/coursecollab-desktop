import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const requestId = params.id

    const requests = await sql`
      SELECT 
        fr.*,
        s.full_name as author_name,
        COALESCE(sr.points, 0) as author_reputation
      FROM feature_requests fr
      LEFT JOIN students s ON fr.student_id = s.id
      LEFT JOIN student_reputation sr ON fr.student_id = sr.student_id
      WHERE fr.id = ${requestId}
    `

    if (requests.length === 0) {
      return NextResponse.json({ error: "Feature request not found" }, { status: 404 })
    }

    return NextResponse.json({ request: requests[0] })
  } catch (error) {
    console.error("Failed to fetch feature request:", error)
    return NextResponse.json({ error: "Failed to fetch feature request" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const requestId = params.id
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 })
    }

    const result = await sql`
      UPDATE feature_requests
      SET status = ${status}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${requestId}
      RETURNING *
    `

    // Award "Feature Champion" badge if request is completed
    if (status === "Completed") {
      const request = result[0]
      await sql`
        INSERT INTO student_reputation (student_id, points, badges)
        VALUES (${request.student_id}, 20, ARRAY['Feature Champion'])
        ON CONFLICT (student_id) 
        DO UPDATE SET 
          points = student_reputation.points + 20,
          badges = array_append(student_reputation.badges, 'Feature Champion'),
          updated_at = CURRENT_TIMESTAMP
      `
    }

    return NextResponse.json({ request: result[0] })
  } catch (error) {
    console.error("Failed to update feature request:", error)
    return NextResponse.json({ error: "Failed to update feature request" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const requestId = params.id

    await sql`
      DELETE FROM feature_requests WHERE id = ${requestId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete feature request:", error)
    return NextResponse.json({ error: "Failed to delete feature request" }, { status: 500 })
  }
}
