import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { ensurePlatformActivitySchema } from "@/lib/ensure-platform-activity-schema"
import { ensureStudentProgressReviewsSchema } from "@/lib/ensure-student-progress-reviews-schema"

export const dynamic = "force-dynamic"

async function safeQuery<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    console.warn(`[admin/student-success-analytics] ${label} fallback:`, error)
    return fallback
  }
}

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId

    await ensureStudentProgressReviewsSchema()

    const [
      enrollment,
      atRisk,
      progressReviews,
      aiTutor,
      attempts,
      engagement,
      courseBreakdown,
      recentInterventions,
    ] = await Promise.all([
      safeQuery("enrollment", () => sql`
        SELECT COUNT(*)::int AS total_students, COUNT(*)::int AS active_students FROM students
      `, []),
      safeQuery("atRisk", () => sql`
        SELECT COUNT(*)::int AS at_risk_count
        FROM student_grades sg
        WHERE sg.attendance_score < 70 AND sg.total_score < 60
      `, []),
      safeQuery("progressReviews", () => sql`
        SELECT
          COUNT(*)::int AS total_reviews,
          COUNT(CASE WHEN email_sent_at IS NOT NULL THEN 1 END)::int AS emailed,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END)::int AS reviews_30d
        FROM student_progress_reviews
      `, [{ total_reviews: 0, emailed: 0, reviews_30d: 0 }]),
      safeQuery("aiTutor", () => sql`
        SELECT
          COUNT(*)::int AS conversations_30d,
          COUNT(DISTINCT student_id)::int AS active_students_30d,
          COUNT(DISTINCT topic)::int AS topics_covered_30d
        FROM ai_tutor_conversations
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `, [{ conversations_30d: 0, active_students_30d: 0, topics_covered_30d: 0 }]),
      safeQuery("attempts", () => sql`
        SELECT
          COUNT(*)::int AS attempts_30d,
          COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END)::int AS completed_30d,
          ROUND(AVG(CASE WHEN score IS NOT NULL THEN score END)::numeric, 1) AS avg_score_30d
        FROM quiz_attempts
        WHERE started_at >= NOW() - INTERVAL '30 days'
      `, [{ attempts_30d: 0, completed_30d: 0, avg_score_30d: 0 }]),
      safeQuery("engagement", () => sql`
        SELECT
          COALESCE(SUM(total_credits), 0)::int AS total_engagement_credits,
          COUNT(DISTINCT student_id)::int AS students_with_credits
        FROM engagement_credits
      `, [{ total_engagement_credits: 0, students_with_credits: 0 }]),
      safeQuery("courseBreakdown", () => sql`
        SELECT
          c.course_code AS course_code,
          c.course_title AS course_name,
          COUNT(DISTINCT s.id)::int AS student_count,
          ROUND(AVG(sg.total_score)::numeric, 1) AS avg_total_score,
          COUNT(CASE WHEN sg.attendance_score < 70 AND sg.total_score < 60 THEN 1 END)::int AS at_risk
        FROM courses c
        LEFT JOIN students s ON s.course_id = c.id
        LEFT JOIN student_grades sg ON sg.student_id = s.id
        GROUP BY c.id, c.course_code, c.course_title
        ORDER BY student_count DESC
        LIMIT 8
      `, []),
      safeQuery("recentInterventions", () => sql`
        SELECT s.full_name, s.section, sg.total_score, sg.attendance_score, sg.letter_grade
        FROM student_grades sg
        JOIN students s ON s.id = sg.student_id
        WHERE sg.attendance_score < 70 AND sg.total_score < 60
        ORDER BY sg.total_score ASC
        LIMIT 10
      `, []),
    ])

    await ensurePlatformActivitySchema()
    let platformEvents24h = 0
    try {
      const rows = await sql`
        SELECT COUNT(*)::int AS count
        FROM platform_activity_logs
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `
      platformEvents24h = Number(rows[0]?.count ?? 0)
    } catch {
      platformEvents24h = 0
    }

    const enroll = enrollment[0] ?? {}
    const risk = atRisk[0] ?? {}
    const reviews = progressReviews[0] ?? {}
    const tutor = aiTutor[0] ?? {}
    const att = attempts[0] ?? {}
    const eng = engagement[0] ?? {}

    return NextResponse.json({
      summary: {
        totalStudents: Number(enroll.total_students ?? 0),
        activeStudents: Number(enroll.active_students ?? 0),
        newEnrollments30d: 0,
        atRiskCount: Number(risk.at_risk_count ?? 0),
        progressReviewsTotal: Number(reviews.total_reviews ?? 0),
        progressReviewsEmailed: Number(reviews.emailed ?? 0),
        progressReviews30d: Number(reviews.reviews_30d ?? 0),
        aiConversations30d: Number(tutor.conversations_30d ?? 0),
        aiActiveStudents30d: Number(tutor.active_students_30d ?? 0),
        aiTopicsCovered30d: Number(tutor.topics_covered_30d ?? 0),
        attempts30d: Number(att.attempts_30d ?? 0),
        completedAttempts30d: Number(att.completed_30d ?? 0),
        avgScore30d: parseFloat(String(att.avg_score_30d ?? 0)) || 0,
        engagementCredits: Number(eng.total_engagement_credits ?? 0),
        studentsWithCredits: Number(eng.students_with_credits ?? 0),
        platformEvents24h,
      },
      courseBreakdown: courseBreakdown.map((c: Record<string, unknown>) => ({
        courseCode: c.course_code,
        courseName: c.course_name,
        studentCount: Number(c.student_count ?? 0),
        avgTotalScore: parseFloat(String(c.avg_total_score ?? 0)) || 0,
        atRisk: Number(c.at_risk ?? 0),
      })),
      atRiskStudents: recentInterventions.map((s: Record<string, unknown>) => ({
        fullName: s.full_name,
        section: s.section,
        totalScore: parseFloat(String(s.total_score ?? 0)) || 0,
        attendanceScore: parseFloat(String(s.attendance_score ?? 0)) || 0,
        letterGrade: s.letter_grade,
      })),
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[admin/student-success-analytics]", error)
    return NextResponse.json({ error: "Failed to load student success analytics" }, { status: 500 })
  }
}
