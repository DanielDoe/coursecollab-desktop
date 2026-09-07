import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const offerType = searchParams.get("offerType")
    const status = searchParams.get("status") || "active"

    let offers

    if (offerType) {
      offers = await sql`
        SELECT 
          toff.*,
          s.full_name as tutor_name,
          s.email as tutor_email,
          COALESCE(sr.points, 0) as tutor_reputation,
          COALESCE(sr.badges, ARRAY[]::text[]) as tutor_badges
        FROM tutoring_offers toff
        LEFT JOIN students s ON toff.student_id = s.id
        LEFT JOIN student_reputation sr ON toff.student_id = sr.student_id
        WHERE toff.offer_type = ${offerType} AND toff.status = ${status}
        ORDER BY toff.created_at DESC
      `
    } else {
      offers = await sql`
        SELECT 
          toff.*,
          s.full_name as tutor_name,
          s.email as tutor_email,
          COALESCE(sr.points, 0) as tutor_reputation,
          COALESCE(sr.badges, ARRAY[]::text[]) as tutor_badges
        FROM tutoring_offers toff
        LEFT JOIN students s ON toff.student_id = s.id
        LEFT JOIN student_reputation sr ON toff.student_id = sr.student_id
        WHERE toff.status = ${status}
        ORDER BY toff.created_at DESC
      `
    }

    return NextResponse.json({ offers })
  } catch (error) {
    console.error("Failed to fetch tutoring offers:", error)
    return NextResponse.json({ error: "Failed to fetch tutoring offers" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, offerType, subject, description, availability, contactMethod } = body

    if (!studentId || !offerType || !subject) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO tutoring_offers (
        student_id, offer_type, subject, description, availability, contact_method
      )
      VALUES (
        ${studentId}, ${offerType}, ${subject}, ${description || null}, 
        ${availability || null}, ${contactMethod || null}
      )
      RETURNING *
    `

    // Award reputation points for offering tutoring
    if (offerType === "can_tutor") {
      await sql`
        INSERT INTO student_reputation (student_id, points)
        VALUES (${studentId}, 10)
        ON CONFLICT (student_id) 
        DO UPDATE SET points = student_reputation.points + 10, updated_at = CURRENT_TIMESTAMP
      `
    }

    return NextResponse.json({ offer: result[0] })
  } catch (error) {
    console.error("Failed to create tutoring offer:", error)
    return NextResponse.json({ error: "Failed to create tutoring offer" }, { status: 500 })
  }
}
