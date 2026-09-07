import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    let reports

    if (status) {
      reports = await sql`
        SELECT 
          br.*,
          s.full_name as author_name,
          COALESCE(sr.points, 0) as author_reputation
        FROM bug_reports br
        LEFT JOIN students s ON br.student_id = s.id
        LEFT JOIN student_reputation sr ON br.student_id = sr.student_id
        WHERE br.status = ${status}
        ORDER BY br.created_at DESC
      `
    } else {
      reports = await sql`
        SELECT 
          br.*,
          s.full_name as author_name,
          COALESCE(sr.points, 0) as author_reputation
        FROM bug_reports br
        LEFT JOIN students s ON br.student_id = s.id
        LEFT JOIN student_reputation sr ON br.student_id = sr.student_id
        ORDER BY br.created_at DESC
      `
    }

    return NextResponse.json({ reports })
  } catch (error) {
    console.error("Failed to fetch bug reports:", error)
    return NextResponse.json({ error: "Failed to fetch bug reports" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, title, description, stepsToReproduce, expectedBehavior, actualBehavior, screenshotUrl } = body

    if (!studentId || !title || !description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO bug_reports (
        student_id, title, description, steps_to_reproduce, 
        expected_behavior, actual_behavior, screenshot_url
      )
      VALUES (
        ${studentId}, ${title}, ${description}, ${stepsToReproduce || null},
        ${expectedBehavior || null}, ${actualBehavior || null}, ${screenshotUrl || null}
      )
      RETURNING *
    `

    // Award reputation points for reporting a bug
    await sql`
      INSERT INTO student_reputation (student_id, points)
      VALUES (${studentId}, 10)
      ON CONFLICT (student_id) 
      DO UPDATE SET points = student_reputation.points + 10, updated_at = CURRENT_TIMESTAMP
    `

    return NextResponse.json({ report: result[0] })
  } catch (error) {
    console.error("Failed to create bug report:", error)
    return NextResponse.json({ error: "Failed to create bug report" }, { status: 500 })
  }
}
