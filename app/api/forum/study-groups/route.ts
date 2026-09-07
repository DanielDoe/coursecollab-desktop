import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestType = searchParams.get("requestType")
    const status = searchParams.get("status") || "open"

    let requests

    if (requestType) {
      requests = await sql`
        SELECT 
          sgr.*,
          s.full_name as student_name,
          COALESCE(sr.points, 0) as student_reputation
        FROM study_group_requests sgr
        LEFT JOIN students s ON sgr.student_id = s.id
        LEFT JOIN student_reputation sr ON sgr.student_id = sr.student_id
        WHERE sgr.request_type = ${requestType} AND sgr.status = ${status}
        ORDER BY sgr.created_at DESC
      `
    } else {
      requests = await sql`
        SELECT 
          sgr.*,
          s.full_name as student_name,
          COALESCE(sr.points, 0) as student_reputation
        FROM study_group_requests sgr
        LEFT JOIN students s ON sgr.student_id = s.id
        LEFT JOIN student_reputation sr ON sgr.student_id = sr.student_id
        WHERE sgr.status = ${status}
        ORDER BY sgr.created_at DESC
      `
    }

    return NextResponse.json({ requests })
  } catch (error) {
    console.error("Failed to fetch study group requests:", error)
    return NextResponse.json({ error: "Failed to fetch study group requests" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, requestType, subject, description } = body

    if (!studentId || !requestType || !subject) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO study_group_requests (student_id, request_type, subject, description)
      VALUES (${studentId}, ${requestType}, ${subject}, ${description || null})
      RETURNING *
    `

    return NextResponse.json({ request: result[0] })
  } catch (error) {
    console.error("Failed to create study group request:", error)
    return NextResponse.json({ error: "Failed to create study group request" }, { status: 500 })
  }
}
