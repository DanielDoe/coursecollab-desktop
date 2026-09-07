import { NextRequest, NextResponse } from "next/server"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("studentId")
    const bound = await requireCodebenchStudent(request, studentId)
    if (!bound.ok) return bound.response

    const callerScope = await sql`
      SELECT
        s.section,
        COALESCE(s.course_id, sess.course_id) as course_id
      FROM students s
      LEFT JOIN sessions sess ON sess.id = s.session_id
      WHERE s.id = ${bound.studentDbId}
      LIMIT 1
    `
    const courseId =
      callerScope[0]?.course_id != null ? Number(callerScope[0].course_id) : null
    const section =
      typeof callerScope[0]?.section === "string" && callerScope[0].section.trim()
        ? callerScope[0].section
        : null

    if (!Number.isFinite(courseId) && !section) {
      return NextResponse.json({ leaderboard: [] })
    }

    const leaderboardData = await sql`
      WITH codebench_xp AS (
        SELECT 
          cs.student_id,
          s.full_name as student_name,
          s.section,
          COUNT(DISTINCT cs.id) as submissions_count,
          SUM(COALESCE(cp.points, 0)) as total_points,
          MAX(cs.submitted_at) as last_submission
        FROM codebench_submissions cs
        JOIN students s ON cs.student_id = s.id
        LEFT JOIN classroom_points cp ON cp.student_id = cs.student_id 
          AND cp.category = 'code_submission' 
          AND cp.status = 'approved'
          AND cp.reason LIKE '%CodeBench%'
        WHERE cs.status = 'approved'
          AND (
            (
              ${courseId}::int IS NOT NULL
              AND (
                s.course_id = ${courseId}
                OR EXISTS (
                  SELECT 1 FROM sessions scoped
                  WHERE scoped.id = s.session_id AND scoped.course_id = ${courseId}
                )
              )
            )
            OR (
              ${courseId}::int IS NULL
              AND ${section}::text IS NOT NULL
              AND s.section = ${section}
            )
          )
        GROUP BY cs.student_id, s.full_name, s.section
      ),
      practice_xp AS (
        SELECT 
          ps.student_id,
          s.full_name as student_name,
          s.section,
          COUNT(DISTINCT ps.id) as practice_count,
          SUM(COALESCE(ppp.points, 0)) as practice_points,
          MAX(ps.submitted_at) as last_practice
        FROM practice_submissions ps
        JOIN students s ON ps.student_id = s.id
        LEFT JOIN pending_practice_points ppp ON ppp.id = ps.practice_point_id 
          AND ppp.status = 'approved'
        WHERE ps.status = 'approved'
          AND (
            (
              ${courseId}::int IS NOT NULL
              AND (
                s.course_id = ${courseId}
                OR EXISTS (
                  SELECT 1 FROM sessions scoped
                  WHERE scoped.id = s.session_id AND scoped.course_id = ${courseId}
                )
              )
            )
            OR (
              ${courseId}::int IS NULL
              AND ${section}::text IS NOT NULL
              AND s.section = ${section}
            )
          )
        GROUP BY ps.student_id, s.full_name, s.section
      ),
      combined_stats AS (
        SELECT 
          COALESCE(c.student_id, p.student_id) as student_id,
          COALESCE(c.student_name, p.student_name) as student_name,
          COALESCE(c.section, p.section) as section,
          COALESCE(c.submissions_count, 0) + COALESCE(p.practice_count, 0) as total_activities,
          COALESCE(c.total_points, 0) + COALESCE(p.practice_points, 0) as total_xp,
          GREATEST(COALESCE(c.last_submission, '1970-01-01'), COALESCE(p.last_practice, '1970-01-01')) as last_activity
        FROM codebench_xp c
        FULL OUTER JOIN practice_xp p ON c.student_id = p.student_id
      )
      SELECT 
        student_id,
        student_name,
        section,
        total_activities,
        total_xp::INTEGER as xp,
        last_activity,
        ROW_NUMBER() OVER (ORDER BY total_xp DESC, last_activity DESC) as rank
      FROM combined_stats
      WHERE total_xp > 0
      ORDER BY total_xp DESC, last_activity DESC
      LIMIT 100
    `

    return NextResponse.json({ leaderboard: leaderboardData })
  } catch (error) {
    console.error("Leaderboard error:", error)
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
  }
}
