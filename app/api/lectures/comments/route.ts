import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sanitizeCommentForStudent } from "@/lib/student-privacy"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lectureId = searchParams.get("lecture_id")
    const studentId = searchParams.get("student_id")
    const viewer = await requireCallerStudentDbId(request)
    const viewerStudentId = viewer.ok ? String(viewer.studentDbId) : null

    let comments

    if (lectureId && studentId) {
      comments = await sql`
        SELECT 
          lc.*,
          s.full_name as student_name
        FROM lecture_comments lc
        JOIN students s ON lc.student_id = s.id
        WHERE lc.lecture_id = ${lectureId} AND lc.student_id = ${studentId}
        ORDER BY lc.created_at DESC
      `
    } else if (lectureId) {
      comments = await sql`
        SELECT 
          lc.*,
          s.full_name as student_name
        FROM lecture_comments lc
        JOIN students s ON lc.student_id = s.id
        WHERE lc.lecture_id = ${lectureId}
        ORDER BY lc.created_at DESC
      `
    } else if (studentId) {
      comments = await sql`
        SELECT 
          lc.*,
          s.full_name as student_name,
          l.title as lecture_title,
          l.week
        FROM lecture_comments lc
        JOIN students s ON lc.student_id = s.id
        JOIN lectures l ON lc.lecture_id = l.id
        WHERE lc.student_id = ${studentId}
        ORDER BY lc.created_at DESC
      `
    } else {
      comments = await sql`
        SELECT 
          lc.*,
          s.full_name as student_name,
          l.title as lecture_title,
          l.week
        FROM lecture_comments lc
        JOIN students s ON lc.student_id = s.id
        JOIN lectures l ON lc.lecture_id = l.id
        ORDER BY lc.created_at DESC
      `
    }

    const sanitizedComments = viewerStudentId
      ? (comments || []).map((comment: Record<string, unknown>) =>
          sanitizeCommentForStudent(comment, viewerStudentId)
        )
      : comments

    return NextResponse.json({ comments: sanitizedComments, privacyMode: Boolean(viewerStudentId) })
  } catch (error) {
    console.error("Failed to fetch comments:", error)
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lecture_id, comment } = body
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    const student_id = auth.studentDbId

    if (!lecture_id || !comment) {
      return NextResponse.json({ error: "Missing required fields: lecture_id, comment" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO lecture_comments (lecture_id, student_id, comment)
      VALUES (${lecture_id}, ${student_id}, ${comment})
      RETURNING *
    `

    // Fetch student info for the response
    const commentWithStudent = await sql`
      SELECT 
        lc.*,
        s.full_name as student_name
      FROM lecture_comments lc
      JOIN students s ON lc.student_id = s.id
      WHERE lc.id = ${result[0].id}
    `

    return NextResponse.json({ comment: commentWithStudent[0] })
  } catch (error) {
    console.error("Failed to create comment:", error)
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 })
  }
}
