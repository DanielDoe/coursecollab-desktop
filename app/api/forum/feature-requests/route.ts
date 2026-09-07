import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const sortBy = searchParams.get("sortBy") || "popular"

    let requests

    if (status) {
      requests = await sql`
        SELECT 
          fr.*,
          s.full_name as author_name,
          COALESCE(sr.points, 0) as author_reputation
        FROM feature_requests fr
        LEFT JOIN students s ON fr.student_id = s.id
        LEFT JOIN student_reputation sr ON fr.student_id = sr.student_id
        WHERE fr.status = ${status}
        ORDER BY 
          CASE WHEN ${sortBy} = 'popular' THEN fr.upvotes END DESC,
          CASE WHEN ${sortBy} = 'recent' THEN fr.created_at END DESC
      `
    } else {
      requests = await sql`
        SELECT 
          fr.*,
          s.full_name as author_name,
          COALESCE(sr.points, 0) as author_reputation
        FROM feature_requests fr
        LEFT JOIN students s ON fr.student_id = s.id
        LEFT JOIN student_reputation sr ON fr.student_id = sr.student_id
        ORDER BY 
          CASE WHEN ${sortBy} = 'popular' THEN fr.upvotes END DESC,
          CASE WHEN ${sortBy} = 'recent' THEN fr.created_at END DESC
      `
    }

    return NextResponse.json({ requests })
  } catch (error) {
    console.error("Failed to fetch feature requests:", error)
    return NextResponse.json({ error: "Failed to fetch feature requests" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, title, description, whyItHelps } = body

    if (!studentId || !title || !description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO feature_requests (student_id, title, description, why_it_helps)
      VALUES (${studentId}, ${title}, ${description}, ${whyItHelps || null})
      RETURNING *
    `

    // Award reputation points for submitting a feature request
    await sql`
      INSERT INTO student_reputation (student_id, points)
      VALUES (${studentId}, 5)
      ON CONFLICT (student_id) 
      DO UPDATE SET points = student_reputation.points + 5, updated_at = CURRENT_TIMESTAMP
    `

    return NextResponse.json({ request: result[0] })
  } catch (error) {
    console.error("Failed to create feature request:", error)
    return NextResponse.json({ error: "Failed to create feature request" }, { status: 500 })
  }
}
