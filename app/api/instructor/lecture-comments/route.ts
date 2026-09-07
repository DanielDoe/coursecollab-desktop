import { type NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const sql = getSQL()
    const { searchParams } = new URL(request.url)
    const lectureId = searchParams.get("lectureId")
    const resolved = searchParams.get("resolved")

    let query = sql`
      SELECT 
        lc.*,
        s.full_name as student_name,
        s.section as student_section,
        l.title as lecture_title,
        l.week
      FROM lecture_comments lc
      JOIN students s ON lc.student_id = s.id
      JOIN lectures l ON lc.lecture_id = l.id
    `

    const conditions = []

    if (lectureId) {
      conditions.push(`lc.lecture_id = ${sql.unsafe(`'${lectureId}'`)}`)
    }

    if (resolved === "true") {
      conditions.push("lc.is_resolved = true")
    } else if (resolved === "false") {
      conditions.push("lc.is_resolved = false")
    }

    if (conditions.length > 0) {
      query = sql`${query} WHERE ${sql.unsafe(conditions.join(" AND "))}`
    }

    query = sql`${query} ORDER BY lc.created_at DESC`

    const comments = await query

    return NextResponse.json({ comments })
  } catch (error) {
    console.error("[v0] Failed to fetch lecture comments:", error)
    return NextResponse.json({ error: "Failed to fetch lecture comments" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { lecture_id, student_id, content, rating } = await request.json()
    const sql = getSQL()

    // Validate input
    if (!lecture_id || !student_id || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Check if lecture and student exist
    const lecture = await sql`SELECT id FROM lectures WHERE id = ${lecture_id}`
    const student = await sql`SELECT id FROM students WHERE id = ${student_id}`

    if (lecture.length === 0) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 })
    }

    if (student.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    // Insert comment
    const result = await sql`
      INSERT INTO lecture_comments (
        lecture_id, 
        student_id, 
        content, 
        rating, 
        is_resolved, 
        created_at
      )
      VALUES (
        ${lecture_id}, 
        ${student_id}, 
        ${content}, 
        ${rating || null}, 
        false, 
        NOW()
      )
      RETURNING *
    `

    return NextResponse.json({
      comment: result[0],
      message: "Comment created successfully"
    })
  } catch (error) {
    console.error("[v0] Failed to create lecture comment:", error)
    return NextResponse.json({ error: "Failed to create lecture comment" }, { status: 500 })
  }
}
