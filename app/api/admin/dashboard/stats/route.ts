import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { ensurePlatformActivitySchema } from "@/lib/ensure-platform-activity-schema"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId

    const [
      quizStats,
      studentStats,
      attemptStats,
      issueStats,
      upcomingStats,
      courseStats,
      facultyStats,
    ] = await Promise.all([
      sql`
        SELECT 
          COUNT(*)::int as total_quizzes,
          COUNT(CASE WHEN deleted_at IS NULL AND available_from <= NOW() AND (available_until IS NULL OR available_until >= NOW()) THEN 1 END)::int as active_quizzes
        FROM quizzes
      `,
      sql`SELECT COUNT(*)::int as total_students FROM students`,
      sql`SELECT COUNT(*)::int as total_attempts FROM quiz_attempts`,
      sql`
        SELECT COUNT(*)::int as pending_issues
        FROM quiz_issues
        WHERE status = 'open'
      `,
      sql`
        SELECT COUNT(*)::int as upcoming_assessments
        FROM quizzes
        WHERE deleted_at IS NULL
          AND available_from > NOW()
          AND available_from <= NOW() + INTERVAL '7 days'
      `,
      sql`
        SELECT COUNT(*)::int as active_courses
        FROM courses
        WHERE is_active = true
      `,
      sql`
        SELECT
          COUNT(*)::int as total_faculty,
          COUNT(CASE WHEN role IN ('instructor', 'department_admin') THEN 1 END)::int as instructor_count,
          COUNT(CASE WHEN role = 'ta' THEN 1 END)::int as ta_count
        FROM instructors
        WHERE is_active = true
      `,
    ])

    await ensurePlatformActivitySchema()
    let platformEvents24h = 0
    let platformEventsToday = 0
    try {
      const [events24h, eventsToday] = await Promise.all([
        sql`
          SELECT COUNT(*)::int AS count
          FROM platform_activity_logs
          WHERE created_at >= NOW() - INTERVAL '24 hours'
        `,
        sql`
          SELECT COUNT(*)::int AS count
          FROM platform_activity_logs
          WHERE created_at >= date_trunc('day', NOW())
        `,
      ])
      platformEvents24h = Number(events24h[0]?.count ?? 0)
      platformEventsToday = Number(eventsToday[0]?.count ?? 0)
    } catch {
      platformEvents24h = 0
      platformEventsToday = 0
    }

    let pendingAccountRequests = 0
    try {
      const accountRequestStats = await sql`
        SELECT COUNT(*)::int as pending_requests
        FROM account_requests
        WHERE status = 'pending'
      `
      pendingAccountRequests = Number(accountRequestStats[0]?.pending_requests ?? 0)
    } catch {
      pendingAccountRequests = 0
    }

    let systemHealth = 95
    try {
      const dbStart = Date.now()
      await sql`SELECT 1 as ok`
      const latency = Date.now() - dbStart
      systemHealth = latency < 100 ? 98 : latency < 300 ? 92 : latency < 800 ? 85 : 70
    } catch {
      systemHealth = 40
    }

    const stats = {
      totalStudents: Number(studentStats[0]?.total_students ?? 0),
      activeCourses: Number(courseStats[0]?.active_courses ?? 0),
      totalFaculty: Number(facultyStats[0]?.total_faculty ?? 0),
      instructorCount: Number(facultyStats[0]?.instructor_count ?? 0),
      taCount: Number(facultyStats[0]?.ta_count ?? 0),
      totalQuizzes: Number(quizStats[0]?.total_quizzes ?? 0),
      activeQuizzes: Number(quizStats[0]?.active_quizzes ?? 0),
      totalAttempts: Number(attemptStats[0]?.total_attempts ?? 0),
      pendingIssues: Number(issueStats[0]?.pending_issues ?? 0),
      upcomingAssessments: Number(upcomingStats[0]?.upcoming_assessments ?? 0),
      activeUsers24h: platformEvents24h,
      platformEventsToday,
      recentSubmissions24h: 0,
      pendingAccountRequests,
      systemHealth,
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error("Failed to fetch admin dashboard stats:", error)
    return NextResponse.json({ error: "Failed to fetch dashboard stats" }, { status: 500 })
  }
}
