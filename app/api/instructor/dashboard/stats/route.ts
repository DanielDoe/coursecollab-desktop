import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { roundKpiNumber } from "@/lib/dashboard-v2/format-kpi-value"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { resolveInstructorDashboardScope } from "@/lib/instructor-dashboard-scope"
import { logRequestPerf, startPerfTimer } from "@/lib/perf/request-log"

export async function GET(request: NextRequest) {
  const elapsed = startPerfTimer()
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }
    const { quizScopeSql, studentScopeSql, scopeMeta } = await resolveInstructorDashboardScope(
      request,
      scope.course,
    )

    const [quizStats, studentStats, attemptStats, issueStats, upcomingStats, recentStats, averageStats] = await Promise.all([
      sql`
        SELECT 
          COUNT(*) as total_quizzes,
          COUNT(CASE WHEN available_from <= NOW() AND (available_until IS NULL OR available_until >= NOW()) THEN 1 END) as active_quizzes
        FROM quizzes q
        WHERE deleted_at IS NULL AND ${sql.unsafe(quizScopeSql)}
      `,
      sql`
        SELECT COUNT(*) as total_students
        FROM students s
        WHERE s.deleted_at IS NULL
          AND ${sql.unsafe(studentScopeSql)}
      `,
      sql`
        SELECT COUNT(*)::int as total_attempts
        FROM quiz_attempts qa
        JOIN quizzes q ON qa.quiz_id = q.id
        JOIN students s ON s.id = qa.student_id AND s.deleted_at IS NULL
        WHERE qa.deleted_at IS NULL
          AND ${sql.unsafe(quizScopeSql)}
          AND ${sql.unsafe(studentScopeSql)}
      `,
      sql`
        SELECT COUNT(*)::int as pending_issues
        FROM quiz_issues qi
        JOIN quizzes q ON qi.quiz_id = q.id
        INNER JOIN students s ON (
          s.student_id = qi.reporter_id OR s.email = qi.reporter_id
        ) AND s.deleted_at IS NULL
        WHERE qi.status = 'open'
          AND ${sql.unsafe(quizScopeSql)}
          AND ${sql.unsafe(studentScopeSql)}
      `,
      sql`
        SELECT COUNT(*) as upcoming_assessments
        FROM quizzes q
        WHERE deleted_at IS NULL AND available_from > NOW() AND ${sql.unsafe(quizScopeSql)}
      `,
      sql`
        SELECT COUNT(*)::int as recent_submissions
        FROM quiz_attempts qa
        JOIN quizzes q ON qa.quiz_id = q.id
        JOIN students s ON s.id = qa.student_id AND s.deleted_at IS NULL
        WHERE qa.deleted_at IS NULL
          AND COALESCE(qa.completed_at, qa.started_at) > NOW() - INTERVAL '24 hours'
          AND ${sql.unsafe(quizScopeSql)}
          AND ${sql.unsafe(studentScopeSql)}
      `,
      sql`
        SELECT ROUND(AVG(
          CASE
            WHEN qa.total_questions > 0 THEN (qa.score::numeric / qa.total_questions::numeric) * 100
            ELSE qa.score::numeric
          END
        )::numeric, 1) as class_average
        FROM quiz_attempts qa
        JOIN quizzes q ON qa.quiz_id = q.id
        JOIN students s ON s.id = qa.student_id AND s.deleted_at IS NULL
        WHERE qa.deleted_at IS NULL
          AND qa.completed_at IS NOT NULL
          AND qa.score IS NOT NULL
          AND ${sql.unsafe(quizScopeSql)}
          AND ${sql.unsafe(studentScopeSql)}
      `,
    ])

    const stats = {
      totalQuizzes: quizStats[0]?.total_quizzes || 0,
      activeQuizzes: quizStats[0]?.active_quizzes || 0,
      totalStudents: studentStats[0]?.total_students || 0,
      totalAttempts: attemptStats[0]?.total_attempts || 0,
      pendingIssues: issueStats[0]?.pending_issues || 0,
      activeUsers: studentStats[0]?.total_students || 0,
      upcomingAssessments: upcomingStats[0]?.upcoming_assessments || 0,
      recentSubmissions24h: Number(recentStats[0]?.recent_submissions ?? 0),
      classAverageScore: roundKpiNumber(Number(averageStats[0]?.class_average ?? 0)),
    }

    const body = { stats, scope: scopeMeta }
    logRequestPerf({
      route: "/api/instructor/dashboard/stats",
      status: 200,
      durationMs: elapsed(),
      payloadBytes: JSON.stringify(body).length,
    })
    return NextResponse.json(body)
  } catch (error) {
    console.error("Error fetching instructor dashboard stats:", error)
    logRequestPerf({ route: "/api/instructor/dashboard/stats", status: 500, durationMs: elapsed() })
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }
}
