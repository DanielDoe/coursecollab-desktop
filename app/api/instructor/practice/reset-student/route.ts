import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { studentBelongsToCourse } from "@/lib/instructor-practice-scope"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }

    const { studentId } = await request.json()

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    const sid = Number(studentId)
    if (!Number.isFinite(sid)) {
      return NextResponse.json({ error: "Invalid student ID" }, { status: 400 })
    }

    const allowed = await studentBelongsToCourse(sid, scope.course.id)
    if (!allowed) {
      return NextResponse.json(
        { error: "Student is not enrolled in a session for this course." },
        { status: 403 },
      )
    }

    await sql`
      DELETE FROM practice_answers pa
      USING practice_attempts p
      WHERE pa.attempt_id = p.id AND p.student_id = ${sid}
    `

    await sql`
      DELETE FROM practice_attempts 
      WHERE student_id = ${sid}
    `

    await sql`
      DELETE FROM practice_leaderboard 
      WHERE student_id = ${sid}
    `

    await sql`
      DELETE FROM student_topic_progress 
      WHERE student_id = ${sid}
    `

    return NextResponse.json({
      success: true,
      message: "Student practice data has been reset successfully",
    })
  } catch (error) {
    console.error("Error resetting student progress:", error)
    return NextResponse.json({ error: "Failed to reset student progress" }, { status: 500 })
  }
}
