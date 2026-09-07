import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  buildLectureInstructorCourseScopeSqlFragment,
  syncLectureCourseIdsForElegEceInstructor,
} from "@/lib/instructor-default-courses"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }
    const courseId = scope.course.id

    await syncLectureCourseIdsForElegEceInstructor(scope.instructorId)

    const scopeWhere = await buildLectureInstructorCourseScopeSqlFragment(
      courseId,
      scope.instructorId,
      scope.course.course_code,
    )

    const totalLectures = await sql`
      SELECT COUNT(*)::int as count FROM lectures l
      WHERE COALESCE(l.is_published, true)
        AND l.deleted_at IS NULL
        AND (${scopeWhere})
    `

    const totalSlides = await sql`
      SELECT COUNT(*)::int as count
      FROM lecture_slides ls
      INNER JOIN lectures l ON ls.lecture_id = l.id
      WHERE ls.is_active = true
        AND COALESCE(l.is_published, true)
        AND l.deleted_at IS NULL
        AND (${scopeWhere})
    `

    const totalComments = await sql`
      SELECT COUNT(*)::int as count
      FROM lecture_comments lc
      INNER JOIN lectures l ON lc.lecture_id = l.id
      WHERE COALESCE(l.is_published, true)
        AND l.deleted_at IS NULL
        AND (${scopeWhere})
    `

    const totalViews = await sql`
      SELECT COUNT(*)::int as count
      FROM lecture_views lv
      INNER JOIN lectures l ON lv.lecture_id = l.id
      WHERE COALESCE(l.is_published, true)
        AND l.deleted_at IS NULL
        AND (${scopeWhere})
    `

    const avgEngagement = await sql`
      SELECT COALESCE(AVG(lc.likes), 0) as avg_rating
      FROM lecture_comments lc
      INNER JOIN lectures l ON lc.lecture_id = l.id
      WHERE lc.likes IS NOT NULL
        AND COALESCE(l.is_published, true)
        AND l.deleted_at IS NULL
        AND (${scopeWhere})
    `

    const weeklyActivity = await sql`
      SELECT 
        l.week,
        COUNT(DISTINCT l.id) as lectures,
        COALESCE(COUNT(DISTINCT lv.id), 0) as views,
        COALESCE(COUNT(DISTINCT lc.id), 0) as comments
      FROM lectures l
      LEFT JOIN lecture_views lv ON l.id = lv.lecture_id
      LEFT JOIN lecture_comments lc ON l.id = lc.lecture_id
      WHERE COALESCE(l.is_published, true)
        AND l.deleted_at IS NULL
        AND (${scopeWhere})
      GROUP BY l.week
      ORDER BY l.week ASC
    `

    const sessionStats = await sql`
      SELECT 
        CASE 
          WHEN session_unnested IS NULL THEN 'All sections'
          ELSE session_unnested::text
        END as session,
        COUNT(DISTINCT l.id) as lectures,
        COUNT(DISTINCT ls.id) as slides,
        COALESCE(COUNT(DISTINCT lc.id), 0) as comments,
        COALESCE(COUNT(DISTINCT lv.id), 0) as views
      FROM lectures l
      LEFT JOIN LATERAL unnest(l.session_access) as session_unnested ON true
      LEFT JOIN lecture_slides ls ON l.id = ls.lecture_id AND ls.is_active = true
      LEFT JOIN lecture_comments lc ON l.id = lc.lecture_id
      LEFT JOIN lecture_views lv ON l.id = lv.lecture_id
      WHERE COALESCE(l.is_published, true)
        AND l.deleted_at IS NULL
        AND (${scopeWhere})
      GROUP BY session_unnested
      ORDER BY session
    `

    const engagementTrends = await sql`
      SELECT 
        DATE_TRUNC('week', lc.created_at) as week_start,
        COUNT(*)::int as comments,
        COALESCE(AVG(lc.likes), 0) as avg_rating
      FROM lecture_comments lc
      INNER JOIN lectures l ON lc.lecture_id = l.id
      WHERE lc.created_at >= CURRENT_DATE - INTERVAL '12 weeks'
        AND COALESCE(l.is_published, true)
        AND l.deleted_at IS NULL
        AND (${scopeWhere})
      GROUP BY DATE_TRUNC('week', lc.created_at)
      ORDER BY week_start ASC
    `

    const topLectures = await sql`
      SELECT 
        l.id,
        l.title,
        l.week,
        array_to_string(l.session_access, ', ') as session,
        COALESCE(COUNT(DISTINCT lv.id), 0)::int as views,
        COALESCE(COUNT(DISTINCT lc.id), 0)::int as comments,
        COALESCE(AVG(lc.likes), 0) as avg_rating
      FROM lectures l
      LEFT JOIN lecture_views lv ON l.id = lv.lecture_id
      LEFT JOIN lecture_comments lc ON l.id = lc.lecture_id
      WHERE COALESCE(l.is_published, true)
        AND l.deleted_at IS NULL
        AND (${scopeWhere})
      GROUP BY l.id, l.title, l.week, l.session_access
      ORDER BY views DESC, avg_rating DESC
      LIMIT 10
    `

    const stats = {
      total_lectures: totalLectures[0]?.count ?? 0,
      total_slides: totalSlides[0]?.count ?? 0,
      total_comments: totalComments[0]?.count ?? 0,
      total_views: totalViews[0]?.count ?? 0,
      avg_engagement: Math.round((parseFloat(String(avgEngagement[0]?.avg_rating ?? 0)) || 0) * 10) / 10,
      weekly_activity: weeklyActivity.map((week) => ({
        week: parseInt(String(week.week), 10) || 0,
        lectures: parseInt(String(week.lectures), 10) || 0,
        views: parseInt(String(week.views), 10) || 0,
        comments: parseInt(String(week.comments), 10) || 0,
      })),
      session_stats: sessionStats.map((sess) => ({
        session: sess.session,
        lectures: parseInt(String(sess.lectures), 10) || 0,
        slides: parseInt(String(sess.slides), 10) || 0,
        comments: parseInt(String(sess.comments), 10) || 0,
        views: parseInt(String(sess.views), 10) || 0,
      })),
      engagement_trends: engagementTrends.map((trend) => ({
        week_start: trend.week_start,
        comments: trend.comments ?? 0,
        avg_rating: Math.round((parseFloat(String(trend.avg_rating)) || 0) * 10) / 10,
      })),
      top_lectures: topLectures.map((lecture) => ({
        id: parseInt(String(lecture.id), 10),
        title: lecture.title,
        week: parseInt(String(lecture.week), 10) || 0,
        session: lecture.session ?? "All",
        views: lecture.views ?? 0,
        comments: lecture.comments ?? 0,
        avg_rating:
          Math.round((parseFloat(String(lecture.avg_rating)) || 0) * 10) / 10,
      })),
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error("[lecture-stats] Failed:", error)
    return NextResponse.json({ error: "Failed to fetch lecture stats" }, { status: 500 })
  }
}
