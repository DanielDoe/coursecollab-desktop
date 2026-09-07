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

    const bookmarks = await sql`
      SELECT 
        lb.id,
        lb.lecture_id,
        lb.created_at,
        l.title,
        l.week,
        l.session
      FROM lecture_bookmarks lb
      JOIN lectures l ON lb.lecture_id = l.id
      WHERE lb.student_id = ${studentId}
      ORDER BY l.week ASC
    `

    return NextResponse.json(bookmarks)
  } catch (error) {
    console.error("Error fetching bookmarks:", error)
    return NextResponse.json({ error: "Failed to fetch bookmarks" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lectureId, studentId } = body

    if (!lectureId || !studentId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const [bookmark] = await sql`
      INSERT INTO lecture_bookmarks (lecture_id, student_id)
      VALUES (${lectureId}, ${studentId})
      ON CONFLICT (lecture_id, student_id) DO NOTHING
      RETURNING *
    `

    return NextResponse.json(bookmark || { success: true }, { status: 201 })
  } catch (error) {
    console.error("Error creating bookmark:", error)
    return NextResponse.json({ error: "Failed to create bookmark" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lectureId = searchParams.get("lectureId")
    const studentId = searchParams.get("studentId")

    if (!lectureId || !studentId) {
      return NextResponse.json({ error: "Lecture ID and Student ID are required" }, { status: 400 })
    }

    await sql`
      DELETE FROM lecture_bookmarks
      WHERE lecture_id = ${lectureId} AND student_id = ${studentId}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting bookmark:", error)
    return NextResponse.json({ error: "Failed to delete bookmark" }, { status: 500 })
  }
}
