import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const requestId = params.id
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 })
    }

    const result = await sql`
      UPDATE tutoring_requests
      SET status = ${status}
      WHERE id = ${requestId}
      RETURNING *
    `

    return NextResponse.json({ request: result[0] })
  } catch (error) {
    console.error("Failed to update tutoring request:", error)
    return NextResponse.json({ error: "Failed to update tutoring request" }, { status: 500 })
  }
}
