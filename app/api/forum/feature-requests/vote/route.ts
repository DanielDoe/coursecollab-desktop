import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, requestId } = body

    if (!studentId || !requestId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Check if already voted
    const existingVote = await sql`
      SELECT * FROM feature_request_votes
      WHERE student_id = ${studentId} AND request_id = ${requestId}
    `

    if (existingVote.length > 0) {
      // Remove vote (toggle)
      await sql`
        DELETE FROM feature_request_votes
        WHERE student_id = ${studentId} AND request_id = ${requestId}
      `

      await sql`
        UPDATE feature_requests
        SET upvotes = upvotes - 1
        WHERE id = ${requestId}
      `

      return NextResponse.json({ voted: false })
    } else {
      // Add vote
      await sql`
        INSERT INTO feature_request_votes (student_id, request_id)
        VALUES (${studentId}, ${requestId})
      `

      await sql`
        UPDATE feature_requests
        SET upvotes = upvotes + 1
        WHERE id = ${requestId}
      `

      return NextResponse.json({ voted: true })
    }
  } catch (error) {
    console.error("Failed to vote on feature request:", error)
    return NextResponse.json({ error: "Failed to vote on feature request" }, { status: 500 })
  }
}
