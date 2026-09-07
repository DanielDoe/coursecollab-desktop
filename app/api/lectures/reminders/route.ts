import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    const reminders = await sql`
      SELECT 
        lr.*,
        l.title,
        l.week,
        l.session
      FROM lecture_reminders lr
      JOIN lectures l ON lr.lecture_id = l.id
      WHERE lr.student_id = ${studentId} AND lr.is_sent = false
      ORDER BY lr.remind_at ASC
    `

    return NextResponse.json(reminders)
  } catch (error) {
    console.error("Error fetching reminders:", error)
    return NextResponse.json({ error: "Failed to fetch reminders" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lectureId, studentId, remindAt } = body

    if (!lectureId || !studentId || !remindAt) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const [reminder] = await sql`
      INSERT INTO lecture_reminders (lecture_id, student_id, remind_at)
      VALUES (${lectureId}, ${studentId}, ${remindAt})
      ON CONFLICT (lecture_id, student_id) 
      DO UPDATE SET remind_at = ${remindAt}, is_sent = false
      RETURNING *
    `

    return NextResponse.json(reminder)
  } catch (error) {
    console.error("Error creating reminder:", error)
    return NextResponse.json({ error: "Failed to create reminder" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Reminder ID is required" }, { status: 400 })
    }

    await sql`DELETE FROM lecture_reminders WHERE id = ${id}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting reminder:", error)
    return NextResponse.json({ error: "Failed to delete reminder" }, { status: 500 })
  }
}
