import { NextRequest, NextResponse } from "next/server"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { codebenchLeaderboardTermPredicateSql } from "@/lib/codebench-leaderboard-scope"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("studentId")
    const bound = await requireCodebenchStudent(request, studentId)
    if (!bound.ok) return bound.response

    const callerScope = await sql`
      SELECT
        s.section,
        COALESCE(s.course_id, sess.course_id) as course_id,
        sess.academic_term_id
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
    const academicTermId =
      callerScope[0]?.academic_term_id != null ? Number(callerScope[0].academic_term_id) : null
    const sameTerm = sql.unsafe(
      codebenchLeaderboardTermPredicateSql(
        Number.isFinite(academicTermId) && (academicTermId ?? 0) > 0 ? academicTermId : null,
      ),
    )

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
          MAX(cs.submitted_at) as last_submission
        FROM codebench_submissions cs
        JOIN students s ON cs.student_id = s.id
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
          AND ${sameTerm}
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
          AND ${sameTerm}
        GROUP BY ps.student_id, s.full_name, s.section
      ),
      award_xp AS (
        SELECT
          cp.student_id,
          SUM(cp.points) as total_points
        FROM classroom_points cp
        JOIN students s ON s.id = cp.student_id
        WHERE cp.category = 'code_submission'
          AND cp.status = 'approved'
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
          AND ${sameTerm}
        GROUP BY cp.student_id
      ),
      activity_stats AS (
        SELECT 
          COALESCE(c.student_id, p.student_id) as student_id,
          COALESCE(c.student_name, p.student_name) as student_name,
          COALESCE(c.section, p.section) as section,
          COALESCE(c.submissions_count, 0) + COALESCE(p.practice_count, 0) as total_activities,
          COALESCE(p.practice_points, 0) as practice_points,
          GREATEST(COALESCE(c.last_submission, '1970-01-01'), COALESCE(p.last_practice, '1970-01-01')) as last_activity
        FROM codebench_xp c
        FULL OUTER JOIN practice_xp p ON c.student_id = p.student_id
      ),
      combined_stats AS (
        SELECT
          COALESCE(a.student_id, w.student_id) as student_id,
          COALESCE(a.student_name, s.full_name) as student_name,
          COALESCE(a.section, s.section) as section,
          COALESCE(a.total_activities, 0) as total_activities,
          COALESCE(w.total_points, 0) + COALESCE(a.practice_points, 0) as total_xp,
          COALESCE(a.last_activity, '1970-01-01') as last_activity
        FROM activity_stats a
        FULL OUTER JOIN award_xp w ON w.student_id = a.student_id
        LEFT JOIN students s ON s.id = COALESCE(a.student_id, w.student_id)
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
