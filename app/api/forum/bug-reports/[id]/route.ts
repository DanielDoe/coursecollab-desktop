import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const reportId = params.id

    const reports = await sql`
      SELECT 
        br.*,
        s.full_name as author_name,
        COALESCE(sr.points, 0) as author_reputation
      FROM bug_reports br
      LEFT JOIN students s ON br.student_id = s.id
      LEFT JOIN student_reputation sr ON br.student_id = sr.student_id
      WHERE br.id = ${reportId}
    `

    if (reports.length === 0) {
      return NextResponse.json({ error: "Bug report not found" }, { status: 404 })
    }

    return NextResponse.json({ report: reports[0] })
  } catch (error) {
    console.error("Failed to fetch bug report:", error)
    return NextResponse.json({ error: "Failed to fetch bug report" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const reportId = params.id
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json({ error: "Status is required" }, { status: 400 })
    }

    const result = await sql`
      UPDATE bug_reports
      SET status = ${status}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${reportId}
      RETURNING *
    `

    // Award "Bug Hunter" badge if bug is verified
    if (status === "Verified") {
      const report = result[0]
      await sql`
        INSERT INTO student_reputation (student_id, points, badges)
        VALUES (${report.student_id}, 15, ARRAY['Bug Hunter'])
        ON CONFLICT (student_id) 
        DO UPDATE SET 
          points = student_reputation.points + 15,
          badges = array_append(student_reputation.badges, 'Bug Hunter'),
          updated_at = CURRENT_TIMESTAMP
      `
    }

    return NextResponse.json({ report: result[0] })
  } catch (error) {
    console.error("Failed to update bug report:", error)
    return NextResponse.json({ error: "Failed to update bug report" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const reportId = params.id

    await sql`
      DELETE FROM bug_reports WHERE id = ${reportId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete bug report:", error)
    return NextResponse.json({ error: "Failed to delete bug report" }, { status: 500 })
  }
}
