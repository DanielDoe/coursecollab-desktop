import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { getAttemptDisplayGrade } from "@/lib/attempt-grade-display"
import { resolveInstructorDashboardScope } from "@/lib/instructor-dashboard-scope"
import {
  buildFacultyActivityMessage,
  buildFacultyActivityTitle,
  type ActivityStatus,
} from "@/lib/dashboard-v2/activity-format"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }
    const { quizScopeSql, studentScopeSql } = await resolveInstructorDashboardScope(request, scope.course)

    const rows = await sql`
      SELECT
        qa.id,
        'quiz_attempt' AS type,
        q.title,
        COALESCE(q.assessment_type, 'quiz') AS assessment_type,
        s.full_name AS student_name,
        qa.score,
        qa.completed_at,
        qa.saved_for_later_at,
        qa.started_at,
        CASE
          WHEN qa.completed_at IS NOT NULL THEN 'submitted'
          WHEN qa.saved_for_later_at IS NOT NULL THEN 'saved_for_later'
          ELSE 'in_progress'
        END AS status,
        COALESCE(qa.completed_at, qa.saved_for_later_at, qa.started_at) AS activity_at
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN students s ON qa.student_id = s.id AND s.deleted_at IS NULL
      WHERE qa.deleted_at IS NULL
        AND q.deleted_at IS NULL
        AND COALESCE(qa.completed_at, qa.saved_for_later_at, qa.started_at) IS NOT NULL
        AND ${sql.unsafe(quizScopeSql)}
        AND ${sql.unsafe(studentScopeSql)}
      ORDER BY activity_at DESC
      LIMIT 12
    `

    const recentActivity = await Promise.all(
      rows.map(async (row) => {
      const status = row.status as ActivityStatus
      const activityAt = row.activity_at as string | Date | null
      const iso =
        activityAt instanceof Date
          ? activityAt.toISOString()
          : activityAt
            ? String(activityAt)
            : undefined

      let percentage: number | undefined
      if (status === "submitted") {
        const grade = await getAttemptDisplayGrade(String(row.id))
        if (grade && Number.isFinite(grade.percentage)) {
          percentage = grade.percentage
        }
      }

      return {
        id: String(row.id),
        attempt_id: row.id,
        type: row.type as string,
        title: buildFacultyActivityTitle({
          student_name: row.student_name as string,
          title: row.title as string,
          status,
        }),
        message: buildFacultyActivityMessage({
          assessment_type: row.assessment_type as string,
          status,
          percentage,
          score: row.score as number | null,
        }),
        student_name: row.student_name as string,
        assessment_type: row.assessment_type as string,
        status,
        score: row.score != null ? Number(row.score) : undefined,
        percentage,
        created_at: iso,
        timestamp: iso,
      }
    }),
    )

    return NextResponse.json({ recentActivity })
  } catch (error) {
    console.error("Error fetching recent activity:", error)
    return NextResponse.json({ error: "Failed to fetch recent activity" }, { status: 500 })
  }
}
