import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { buildSubmissionsOverTimeSeries } from "@/lib/dashboard-v2/chart-series"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { resolveInstructorDashboardScope } from "@/lib/instructor-dashboard-scope"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }
    const { quizScopeSql, studentScopeSql } = await resolveInstructorDashboardScope(request, scope.course)

    const submissionsByDay = await sql`
      SELECT 
        DATE(qa.completed_at) as date,
        COUNT(*)::int as count
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN students s ON s.id = qa.student_id AND s.deleted_at IS NULL
      WHERE qa.deleted_at IS NULL
        AND qa.completed_at IS NOT NULL
        AND ${sql.unsafe(quizScopeSql)}
        AND ${sql.unsafe(studentScopeSql)}
      GROUP BY DATE(qa.completed_at)
      ORDER BY date ASC
    `

    const days = buildSubmissionsOverTimeSeries(
      submissionsByDay as { date: Date | string; count: number }[],
    )

    const byType = await sql`
      SELECT 
        COALESCE(q.assessment_type, 'quiz') as type,
        COUNT(*)::int as count
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN students s ON s.id = qa.student_id AND s.deleted_at IS NULL
      WHERE qa.deleted_at IS NULL
        AND qa.completed_at IS NOT NULL
        AND ${sql.unsafe(quizScopeSql)}
        AND ${sql.unsafe(studentScopeSql)}
      GROUP BY COALESCE(q.assessment_type, 'quiz')
      ORDER BY count DESC
    `

    const assessmentBreakdown = byType.map((r: { type: string; count: number }) => ({
      name:
        r.type === "mid_semester" ? "Mid-Semester" : r.type === "final" ? "Final Exams" : r.type.charAt(0).toUpperCase() + r.type.slice(1),
      value: Number(r.count),
      type: r.type,
    }))

    const scoreByWeek = await sql`
      SELECT 
        DATE_TRUNC('week', qa.completed_at AT TIME ZONE 'UTC')::date as week_start,
        ROUND(AVG(
          CASE 
            WHEN qa.total_questions > 0 THEN (qa.score::numeric / qa.total_questions::numeric) * 100
            ELSE qa.score::numeric
          END
        )::numeric, 1) as avg_score,
        COUNT(*)::int as attempts
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN students s ON s.id = qa.student_id AND s.deleted_at IS NULL
      WHERE qa.deleted_at IS NULL
        AND qa.completed_at IS NOT NULL
        AND qa.score IS NOT NULL
        AND qa.completed_at >= NOW() - INTERVAL '42 days'
        AND ${sql.unsafe(quizScopeSql)}
        AND ${sql.unsafe(studentScopeSql)}
      GROUP BY DATE_TRUNC('week', qa.completed_at AT TIME ZONE 'UTC')
      ORDER BY week_start ASC
    `

    const rawWeeks = scoreByWeek.slice(-6).map((r: { week_start: Date; avg_score: number; attempts: number }) => ({
      avgScore: Number(r.avg_score),
      attempts: Number(r.attempts),
    }))
    const weeks: { week: string; avgScore: number; attempts: number }[] = []
    for (let i = 0; i < 6; i++) {
      const r = rawWeeks[i]
      weeks.push({ week: `W${i + 1}`, avgScore: r?.avgScore ?? 0, attempts: r?.attempts ?? 0 })
    }

    return NextResponse.json({
      submissionsOverTime: days,
      assessmentBreakdown,
      scoreTrend: weeks,
    })
  } catch (error) {
    console.error("Error fetching instructor dashboard charts:", error)
    return NextResponse.json({ error: "Failed to fetch charts" }, { status: 500 })
  }
}
