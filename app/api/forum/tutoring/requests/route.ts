import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { offerId, requesterId } = body

    if (!offerId || !requesterId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Check if request already exists
    const existing = await sql`
      SELECT * FROM tutoring_requests
      WHERE offer_id = ${offerId} AND requester_id = ${requesterId}
    `

    if (existing.length > 0) {
      return NextResponse.json({ error: "Request already exists" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO tutoring_requests (offer_id, requester_id)
      VALUES (${offerId}, ${requesterId})
      RETURNING *
    `

    return NextResponse.json({ request: result[0] })
  } catch (error) {
    console.error("Failed to create tutoring request:", error)
    return NextResponse.json({ error: "Failed to create tutoring request" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const offerId = searchParams.get("offerId")
    const requesterId = searchParams.get("requesterId")

    let requests

    if (offerId) {
      requests = await sql`
        SELECT 
          tr.*,
          s.full_name as requester_name,
          s.email as requester_email
        FROM tutoring_requests tr
        LEFT JOIN students s ON tr.requester_id = s.id
        WHERE tr.offer_id = ${offerId}
        ORDER BY tr.created_at DESC
      `
    } else if (requesterId) {
      requests = await sql`
        SELECT 
          tr.*,
          to.subject,
          to.description,
          s.full_name as tutor_name
        FROM tutoring_requests tr
        LEFT JOIN tutoring_offers to ON tr.offer_id = to.id
        LEFT JOIN students s ON to.student_id = s.id
        WHERE tr.requester_id = ${requesterId}
        ORDER BY tr.created_at DESC
      `
    } else {
      return NextResponse.json({ error: "offerId or requesterId required" }, { status: 400 })
    }

    return NextResponse.json({ requests })
  } catch (error) {
    console.error("Failed to fetch tutoring requests:", error)
    return NextResponse.json({ error: "Failed to fetch tutoring requests" }, { status: 500 })
  }
}
