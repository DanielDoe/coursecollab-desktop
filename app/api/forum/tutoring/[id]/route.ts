import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const offerId = params.id

    const offers = await sql`
      SELECT 
        to.*,
        s.full_name as tutor_name,
        s.email as tutor_email,
        COALESCE(sr.points, 0) as tutor_reputation,
        COALESCE(sr.badges, ARRAY[]::text[]) as tutor_badges
      FROM tutoring_offers to
      LEFT JOIN students s ON to.student_id = s.id
      LEFT JOIN student_reputation sr ON to.student_id = sr.student_id
      WHERE to.id = ${offerId}
    `

    if (offers.length === 0) {
      return NextResponse.json({ error: "Tutoring offer not found" }, { status: 404 })
    }

    return NextResponse.json({ offer: offers[0] })
  } catch (error) {
    console.error("Failed to fetch tutoring offer:", error)
    return NextResponse.json({ error: "Failed to fetch tutoring offer" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const offerId = params.id
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 })
    }

    const result = await sql`
      UPDATE tutoring_offers
      SET status = ${status}
      WHERE id = ${offerId}
      RETURNING *
    `

    return NextResponse.json({ offer: result[0] })
  } catch (error) {
    console.error("Failed to update tutoring offer:", error)
    return NextResponse.json({ error: "Failed to update tutoring offer" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const offerId = params.id

    await sql`
      DELETE FROM tutoring_offers WHERE id = ${offerId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete tutoring offer:", error)
    return NextResponse.json({ error: "Failed to delete tutoring offer" }, { status: 500 })
  }
}
