import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

import { checkMembershipAccess, createAccessDeniedResponse } from "@/lib/membership-guard"
import { requireStudentPracticeCaller } from "@/lib/require-student-practice-auth"
import { isCurrentStudent, sanitizeLeaderboardForStudent } from "@/lib/student-privacy"
import { getPracticeHubLeaderboardBlurPeerNames, getPracticeHubLeaderboardScholarAccess } from "@/lib/practice-hub-leaderboard-privacy"
import { getPracticeHubPolicyForCourse } from "@/lib/practice-hub-policy-settings.server"

export const dynamic = "force-dynamic"
export const revalidate = 30 // Cache for 30 seconds (leaderboard updates less frequently)
export const maxDuration = 30

export async function GET(request: NextRequest) {
  const perfStart = Date.now()
  
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const session = searchParams.get("session")
    const courseIdParam = searchParams.get("courseId")
    const limit = Number.parseInt(searchParams.get("limit") || "10")

    const auth = await requireStudentPracticeCaller(request, studentId, session, courseIdParam)
    if (!auth.ok) return auth.response
    const callerStudentId = String(auth.studentDbId)
    const courseId = auth.ctx.courseId
    const rosterSessionId = auth.ctx.sessionId

    // Check leaderboard access (Explorer+ required) against the session caller
    const access = await checkMembershipAccess(auth.studentDbId, "leaderboard")
    if (!access.allowed) {
      const scholarOverride =
        access.tier === "Scholar" && (await getPracticeHubLeaderboardScholarAccess(courseId))
      if (!scholarOverride) {
        return NextResponse.json(
          createAccessDeniedResponse("Leaderboard", access.upgradeRequired!, access.tier),
          { status: 403 },
        )
      }
    }

    console.log("[Practice Leaderboard] Fetching leaderboard for session:", session, "studentId:", callerStudentId, "limit:", limit)

    let leaderboard
    if (courseId != null) {
      leaderboard = await sql`
        SELECT 
          pl.student_id,
          s.full_name as student_name,
          s.student_id as student_code,
          s.section,
          pl.total_practice_points,
          pl.total_practice_attempts,
          pl.total_questions_practiced,
          pl.avg_practice_score,
          pl.current_streak_days,
          pl.longest_streak_days,
          pl.last_practice_date,
          ROW_NUMBER() OVER (ORDER BY pl.total_practice_points DESC) as rank
        FROM practice_leaderboard pl
        INNER JOIN students s ON s.id = pl.student_id
        WHERE s.course_id = ${courseId}
          AND (${rosterSessionId}::int IS NULL OR s.session_id = ${rosterSessionId})
        ORDER BY pl.total_practice_points DESC
        LIMIT ${limit}
      `
    } else if (session && session !== "all") {
      console.log("[Practice Leaderboard] Filtering by session:", session)
      leaderboard = await sql`
        SELECT 
          pl.student_id,
          s.full_name as student_name,
          s.student_id as student_code,
          s.section,
          pl.total_practice_points,
          pl.total_practice_attempts,
          pl.total_questions_practiced,
          pl.avg_practice_score,
          pl.current_streak_days,
          pl.longest_streak_days,
          pl.last_practice_date,
          ROW_NUMBER() OVER (ORDER BY pl.total_practice_points DESC) as rank
        FROM practice_leaderboard pl
        INNER JOIN students s ON s.id = pl.student_id
        WHERE s.section = ${session}
        ORDER BY pl.total_practice_points DESC
        LIMIT ${limit}
      `
    } else {
      leaderboard = await sql`
        SELECT 
          pl.student_id,
          s.full_name as student_name,
          s.student_id as student_code,
          s.section,
          pl.total_practice_points,
          pl.total_practice_attempts,
          pl.total_questions_practiced,
          pl.avg_practice_score,
          pl.current_streak_days,
          pl.longest_streak_days,
          pl.last_practice_date,
          ROW_NUMBER() OVER (ORDER BY pl.total_practice_points DESC) as rank
        FROM practice_leaderboard pl
        INNER JOIN students s ON s.id = pl.student_id
        ORDER BY pl.total_practice_points DESC
        LIMIT ${limit}
      `
    }

    console.log("[Practice Leaderboard] Fetched", leaderboard?.length || 0, "students for session:", session)

    // Calculate average response time for each student
    if (leaderboard && leaderboard.length > 0) {
      for (const student of leaderboard) {
        try {
          const responseTimeResult = await sql`
            SELECT AVG(pa.response_time_ms) as avg_response_time_ms
            FROM practice_answers pa
            INNER JOIN practice_attempts pat ON pat.id = pa.attempt_id
            WHERE pat.student_id = ${student.student_id} 
              AND pa.response_time_ms IS NOT NULL 
              AND pa.response_time_ms > 0
          `
          student.avg_response_time_ms = responseTimeResult[0]?.avg_response_time_ms || 0
        } catch (error) {
          console.log("[Practice Leaderboard] Could not fetch response time for student:", student.student_id, error)
          student.avg_response_time_ms = 0
        }
      }
    }

    // Get current student's rank and stats for the session caller
    let currentStudent = null
    if (callerStudentId) {
      // Calculate rank within session if session filter is active
      let studentStats
      if (courseId != null) {
        studentStats = await sql`
          SELECT 
            pl.*,
            s.full_name as student_name,
            s.student_id as student_code,
            s.section,
            (
              SELECT COUNT(*) + 1
              FROM practice_leaderboard pl2
              INNER JOIN students s2 ON s2.id = pl2.student_id
              WHERE pl2.total_practice_points > pl.total_practice_points
                AND s2.course_id = ${courseId}
                AND (${rosterSessionId}::int IS NULL OR s2.session_id = ${rosterSessionId})
            ) as rank
          FROM practice_leaderboard pl
          INNER JOIN students s ON s.id = pl.student_id
          WHERE pl.student_id = ${auth.studentDbId}
            AND s.course_id = ${courseId}
        `
      } else if (session && session !== "all") {
        studentStats = await sql`
          SELECT 
            pl.*,
            s.full_name as student_name,
            s.student_id as student_code,
            s.section,
            (
              SELECT COUNT(*) + 1
              FROM practice_leaderboard pl2
              INNER JOIN students s2 ON s2.id = pl2.student_id
              WHERE pl2.total_practice_points > pl.total_practice_points
                AND s2.section = ${session}
            ) as rank
          FROM practice_leaderboard pl
          INNER JOIN students s ON s.id = pl.student_id
          WHERE pl.student_id = ${auth.studentDbId}
        `
      } else {
        // Global rank calculation
        studentStats = await sql`
          SELECT 
            pl.*,
            s.full_name as student_name,
            s.student_id as student_code,
            s.section,
            (
              SELECT COUNT(*) + 1
              FROM practice_leaderboard pl2
              WHERE pl2.total_practice_points > pl.total_practice_points
            ) as rank
          FROM practice_leaderboard pl
          INNER JOIN students s ON s.id = pl.student_id
          WHERE pl.student_id = ${auth.studentDbId}
        `
      }

      if (studentStats.length > 0) {
        currentStudent = studentStats[0]
        // Calculate average response time for current student
        try {
          const responseTimeResult = await sql`
            SELECT AVG(pa.response_time_ms) as avg_response_time_ms
            FROM practice_answers pa
            INNER JOIN practice_attempts pat ON pat.id = pa.attempt_id
            WHERE pat.student_id = ${auth.studentDbId} 
              AND pa.response_time_ms IS NOT NULL 
              AND pa.response_time_ms > 0
          `
          currentStudent.avg_response_time_ms = responseTimeResult[0]?.avg_response_time_ms || 0
        } catch (error) {
          console.log("[Practice Leaderboard] Could not fetch response time for current student:", error)
          currentStudent.avg_response_time_ms = 0
        }
      }
    }

    // Get badges for current student
    let badges = []
    if (callerStudentId) {
      badges = await sql`
        SELECT *
        FROM practice_badges
        WHERE student_id = ${auth.studentDbId}
        ORDER BY earned_at DESC
      `
    }

    console.log(`[Perf] /api/practice/leaderboard completed in ${Date.now() - perfStart}ms for session ${session}`)

    const blurPeerNames = await getPracticeHubLeaderboardBlurPeerNames(courseId)
    const hubPolicy = await getPracticeHubPolicyForCourse(courseId)

    const sanitizedLeaderboard = blurPeerNames
      ? sanitizeLeaderboardForStudent(leaderboard || [], callerStudentId, { idFields: ["student_id"] })
      : (leaderboard || []).map((entry: Record<string, unknown>, index: number) => ({
          ...entry,
          rank: Number(entry.rank ?? index + 1),
          is_current_user: isCurrentStudent(entry.student_id, callerStudentId),
        }))

    return NextResponse.json({
      leaderboard: sanitizedLeaderboard,
      currentStudent: currentStudent ? { ...currentStudent, is_current_user: true } : null,
      badges,
      privacyMode: blurPeerNames,
      leaderboardPrivacy: {
        blurPeerNames,
      },
      leaderboardDisplay: {
        showAccuracy: hubPolicy.show_accuracy_on_leaderboard,
        showResponseTime: hubPolicy.show_response_time_on_leaderboard,
      },
    })
  } catch (error) {
    console.error("[v0] Failed to fetch leaderboard:", error)
    console.log(`[Perf] /api/practice/leaderboard failed after ${Date.now() - perfStart}ms`)
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
  }
}
