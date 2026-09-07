import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { resolveInstructorDashboardScope } from "@/lib/instructor-dashboard-scope"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }
    const courseId = scope.course.id
    const { studentScopeSql } = await resolveInstructorDashboardScope(request, scope.course)

    const students = await sql`
      SELECT 
        s.id as student_id,
        s.full_name as student_name,
        s.section as student_section,
        sess.code as session,
        COUNT(pa.id) as total_attempts,
        COALESCE(AVG(CAST(pa.score_percentage AS NUMERIC)), 0) as avg_score,
        COALESCE(SUM(pa.total_questions), 0) as total_questions,
        COALESCE(SUM(pa.correct_answers), 0) as total_correct,
        MAX(pa.started_at) as last_practiced
      FROM students s
      INNER JOIN sessions sess ON sess.id = s.session_id
      INNER JOIN practice_attempts pa ON s.id = pa.student_id
      WHERE sess.course_id = ${courseId}
        AND s.deleted_at IS NULL
        AND ${sql.unsafe(studentScopeSql)}
        AND pa.completed_at IS NOT NULL
      GROUP BY s.id, s.full_name, s.section, sess.code
      HAVING COUNT(pa.id) > 0
      ORDER BY s.full_name
    `

    const topicsByStudent: Record<number, string[]> = {}
    for (const student of students) {
      const topics = await sql`
        SELECT DISTINCT unnest(topics) as topic
        FROM practice_attempts
        WHERE student_id = ${student.student_id}
        AND completed_at IS NOT NULL
      `
      topicsByStudent[Number(student.student_id)] = topics.map((t) => t.topic).filter(Boolean) as string[]
    }

    const transformedStudents = students.map((student) => ({
      student_id: Number(student.student_id),
      student_name: student.student_name,
      student_section: student.student_section,
      session: student.session,
      total_attempts: Number(student.total_attempts || 0),
      avg_score: Number(student.avg_score || 0),
      total_questions: Number(student.total_questions || 0),
      total_correct: Number(student.total_correct || 0),
      last_practiced: student.last_practiced,
      topics_practiced: topicsByStudent[Number(student.student_id)] || [],
    }))

    return NextResponse.json({
      students: transformedStudents,
      courseId: scope.course.id,
      courseCode: scope.course.course_code,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Error fetching student progress:", error)
    return NextResponse.json(
      { error: "Failed to fetch student progress", details: msg },
      { status: 500 },
    )
  }
}
