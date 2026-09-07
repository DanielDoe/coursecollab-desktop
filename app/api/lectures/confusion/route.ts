import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lectureId = searchParams.get("lectureId")

    if (!lectureId) {
      return NextResponse.json({ error: "Lecture ID is required" }, { status: 400 })
    }

    console.log("[v0] Fetching confusion flags for lecture:", lectureId)

    const flags = await sql`
      SELECT 
        lcf.id,
        lcf.reason,
        lcf.created_at,
        s.student_id,
        s.full_name
      FROM lecture_confusion_flags lcf
      JOIN students s ON lcf.student_id = s.id
      WHERE lcf.lecture_id = ${lectureId}
      ORDER BY lcf.created_at DESC
    `

    console.log("[v0] Found", flags.length, "confusion flags")
    return NextResponse.json({ flags, count: flags.length })
  } catch (error) {
    console.error("[v0] Failed to fetch confusion flags:", error)
    return NextResponse.json({ error: "Failed to fetch confusion flags" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, lectureId, reason } = body

    if (!studentId || !lectureId) {
      return NextResponse.json({ error: "Student ID and Lecture ID are required" }, { status: 400 })
    }

    console.log("[v0] Creating confusion flag - student:", studentId, "lecture:", lectureId)

    // Get student database ID
    const studentResult = await sql`
      SELECT id FROM students WHERE student_id = ${studentId}
    `

    if (studentResult.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const studentDatabaseId = studentResult[0].id

    // Create confusion flag
    const result = await sql`
      INSERT INTO lecture_confusion_flags (student_id, lecture_id, reason)
      VALUES (${studentDatabaseId}, ${lectureId}, ${reason || null})
      ON CONFLICT (student_id, lecture_id) DO UPDATE
      SET reason = ${reason || null}, created_at = CURRENT_TIMESTAMP
      RETURNING *
    `

    console.log("[v0] Confusion flag created successfully")
    return NextResponse.json({ success: true, flag: result[0] })
  } catch (error) {
    console.error("[v0] Failed to create confusion flag:", error)
    return NextResponse.json({ error: "Failed to create confusion flag" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const lectureId = searchParams.get("lectureId")

    if (!studentId || !lectureId) {
      return NextResponse.json({ error: "Student ID and Lecture ID are required" }, { status: 400 })
    }

    console.log("[v0] Removing confusion flag - student:", studentId, "lecture:", lectureId)

    // Get student database ID
    const studentResult = await sql`
      SELECT id FROM students WHERE student_id = ${studentId}
    `

    if (studentResult.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const studentDatabaseId = studentResult[0].id

    // Delete confusion flag
    await sql`
      DELETE FROM lecture_confusion_flags
      WHERE student_id = ${studentDatabaseId} AND lecture_id = ${lectureId}
    `

    console.log("[v0] Confusion flag removed successfully")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to remove confusion flag:", error)
    return NextResponse.json({ error: "Failed to remove confusion flag" }, { status: 500 })
  }
}
