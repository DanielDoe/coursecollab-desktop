import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { buildInstructorOwnedCourseScopeSqlFragment } from "@/lib/instructor-default-courses"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }
    const courseId = scope.course.id
    const qbScope = buildInstructorOwnedCourseScopeSqlFragment(
      "question_bank",
      "course_id",
      courseId,
      scope.instructorId,
      { scopeCourseCode: scope.course.course_code },
    )

    let overviewStats
    try {
      overviewStats = await sql`
        SELECT 
          COUNT(DISTINCT pa.student_id) as totalStudents,
          COUNT(pa.id) as totalAttempts,
          COALESCE(AVG(CAST(pa.score_percentage AS NUMERIC)), 0) as avgScore
        FROM practice_attempts pa
        INNER JOIN students s ON s.id = pa.student_id
        INNER JOIN sessions sess ON sess.id = s.session_id
        WHERE pa.completed_at IS NOT NULL
          AND sess.course_id = ${courseId}
      `
    } catch {
      overviewStats = [{ totalStudents: 0, totalAttempts: 0, avgScore: 0 }]
    }

    let availableTopics
    try {
      availableTopics = await sql`
        SELECT COUNT(DISTINCT topic) as count
        FROM question_bank
        WHERE topic IS NOT NULL AND topic != ''
          AND deleted_at IS NULL
          AND (${qbScope})
      `
    } catch {
      availableTopics = [{ count: 0 }]
    }

    let topicPerformance
    try {
      topicPerformance = await sql`
        SELECT 
          qb.topic,
          COUNT(pans.id) as attempts,
          COALESCE(AVG(CASE WHEN pans.is_correct THEN 100 ELSE 0 END), 0) as avgScore,
          COUNT(DISTINCT pa.student_id) as uniqueStudents
        FROM practice_answers pans
        JOIN question_bank qb ON pans.bank_question_id = qb.id
        JOIN practice_attempts pa ON pans.attempt_id = pa.id
        INNER JOIN students s ON s.id = pa.student_id
        INNER JOIN sessions sess ON sess.id = s.session_id
        WHERE qb.topic IS NOT NULL AND qb.topic != ''
          AND pa.completed_at IS NOT NULL
          AND sess.course_id = ${courseId}
        GROUP BY qb.topic
        ORDER BY attempts DESC
      `
    } catch {
      try {
        topicPerformance = await sql`
          SELECT 
            unnest(pa.topics) as topic,
            COUNT(*) as attempts,
            COALESCE(AVG(CAST(pa.score_percentage AS NUMERIC)), 0) as avgScore,
            COUNT(DISTINCT pa.student_id) as uniqueStudents
          FROM practice_attempts pa
          INNER JOIN students s ON s.id = pa.student_id
          INNER JOIN sessions sess ON sess.id = s.session_id
          WHERE pa.completed_at IS NOT NULL
            AND pa.topics IS NOT NULL
            AND sess.course_id = ${courseId}
          GROUP BY unnest(pa.topics)
          ORDER BY attempts DESC
        `
      } catch {
        topicPerformance = []
      }
    }

    let recentActivity
    try {
      recentActivity = await sql`
        SELECT 
          s.full_name as student_name,
          pa.score_percentage as score,
          pa.total_questions as totalQuestions,
          pa.correct_answers as correctAnswers,
          pa.started_at as timestamp,
          pa.topics
        FROM practice_attempts pa
        JOIN students s ON pa.student_id = s.id
        INNER JOIN sessions sess ON sess.id = s.session_id
        WHERE pa.completed_at IS NOT NULL
          AND sess.course_id = ${courseId}
        ORDER BY pa.started_at DESC
        LIMIT 20
      `
    } catch {
      recentActivity = []
    }

    let dailyTrends
    try {
      dailyTrends = await sql`
        SELECT 
          DATE(pa.started_at) as date,
          COUNT(pa.id) as attempts,
          COALESCE(AVG(CAST(pa.score_percentage AS NUMERIC)), 0) as avgScore
        FROM practice_attempts pa
        INNER JOIN students s ON s.id = pa.student_id
        INNER JOIN sessions sess ON sess.id = s.session_id
        WHERE pa.completed_at IS NOT NULL
          AND pa.started_at >= NOW() - INTERVAL '14 days'
          AND sess.course_id = ${courseId}
        GROUP BY DATE(pa.started_at)
        ORDER BY date ASC
      `
    } catch {
      dailyTrends = []
    }

    const o = overviewStats[0] as Record<string, unknown> | undefined
    const analytics = {
      overview: {
        totalStudents: Number(
          o?.totalStudents ?? o?.totalstudents ?? 0,
        ),
        totalAttempts: Number(
          o?.totalAttempts ?? o?.totalattempts ?? 0,
        ),
        avgScore: Number(o?.avgScore ?? o?.avgscore ?? 0),
        availableTopics: Number(availableTopics[0]?.count || 0),
      },
      topicPerformance: topicPerformance.map((topic) => {
        const tr = topic as Record<string, unknown>
        return {
          topic: topic.topic,
          attempts: Number(tr.attempts || 0),
          avgScore: Number(tr.avgscore ?? tr.avgScore ?? 0),
          uniqueStudents: Number(tr.uniquestudents ?? tr.uniqueStudents ?? 0),
        }
      }),
      recentActivity: recentActivity.map((activity) => ({
        student_name: activity.student_name,
        score: Number(activity.score || 0),
        totalQuestions: Number(activity.totalquestions || 0),
        correctAnswers: Number(activity.correctanswers || 0),
        timestamp: activity.timestamp,
        topics: activity.topics || [],
      })),
      dailyTrends: dailyTrends.map((trend) => ({
        date: new Date(trend.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        attempts: Number(trend.attempts || 0),
        avgScore: Number(trend.avgscore || 0),
      })),
      practiceBankAvailable: Number(availableTopics[0]?.count || 0) > 0,
      courseCode: scope.course.course_code,
    }

    return NextResponse.json(analytics)
  } catch (error) {
    console.error("Error fetching practice analytics:", error)
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 })
  }
}
