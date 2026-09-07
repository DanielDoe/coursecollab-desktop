import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { isCurrentStudent, sanitizeLeaderboardForStudent } from "@/lib/student-privacy"
import { getPracticeHubLeaderboardBlurPeerNames } from "@/lib/practice-hub-leaderboard-privacy"
import { requireStudentPracticeCaller } from "@/lib/require-student-practice-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStudentPracticeCaller(request)
    if (!auth.ok) return auth.response
    const studentDbId = auth.studentDbId
    const courseId = auth.ctx.courseId
    const rosterSessionId = auth.ctx.sessionId
    const blurPeerNames = await getPracticeHubLeaderboardBlurPeerNames(courseId)

    const leaderboard = await sql`
      SELECT 
        pl.student_id,
        ROW_NUMBER() OVER (
          ORDER BY pl.total_practice_points DESC NULLS LAST, pl.last_practice_date ASC NULLS LAST
        ) AS leaderboard_rank,
        s.full_name as student_name,
        pl.total_practice_points as score,
        pl.total_questions_practiced as total_questions,
        pl.avg_practice_score,
        pl.total_practice_attempts,
        pl.last_practice_date as completed_at
      FROM practice_leaderboard pl
      JOIN students s ON pl.student_id = s.id
      WHERE s.course_id = ${courseId}
        AND (${rosterSessionId}::int IS NULL OR s.session_id = ${rosterSessionId})
      ORDER BY leaderboard_rank ASC
      LIMIT 50
    `

    const currentStudentStats = await sql`
      SELECT 
        ranked.leaderboard_rank AS rank,
        ranked.score,
        ranked.total_questions,
        ranked.avg_practice_score,
        ranked.total_practice_attempts,
        ranked.completed_at,
        ranked.student_name
      FROM (
        SELECT 
          pl.student_id,
          ROW_NUMBER() OVER (
            ORDER BY pl.total_practice_points DESC NULLS LAST, pl.last_practice_date ASC NULLS LAST
          ) AS leaderboard_rank,
          pl.total_practice_points as score,
          pl.total_questions_practiced as total_questions,
          pl.avg_practice_score,
          pl.total_practice_attempts,
          pl.last_practice_date as completed_at,
          s.full_name as student_name
        FROM practice_leaderboard pl
        JOIN students s ON pl.student_id = s.id
        WHERE s.course_id = ${courseId}
          AND (${rosterSessionId}::int IS NULL OR s.session_id = ${rosterSessionId})
      ) ranked
      WHERE ranked.student_id = ${studentDbId}
    `

    const stats = await sql`
      SELECT 
        COUNT(DISTINCT pl.student_id) as total_students,
        AVG(pl.avg_practice_score::float) as average_score,
        COALESCE(SUM(pl.total_practice_attempts), 0) as total_attempts
      FROM practice_leaderboard pl
      JOIN students s ON s.id = pl.student_id
      WHERE s.course_id = ${courseId}
        AND (${rosterSessionId}::int IS NULL OR s.session_id = ${rosterSessionId})
    `

    const normalizedLeaderboard = (leaderboard || []).map((entry: Record<string, unknown>, index: number) => ({
      ...entry,
      rank: Number(entry.leaderboard_rank ?? entry.rank ?? index + 1),
    }))

    const sanitizedLeaderboard = blurPeerNames
      ? sanitizeLeaderboardForStudent(normalizedLeaderboard, String(studentDbId), { idFields: ["student_id"] })
      : normalizedLeaderboard.map((entry: Record<string, unknown>, index: number) => ({
          ...entry,
          rank: Number(entry.rank ?? index + 1),
          is_current_user: isCurrentStudent(entry.student_id, studentDbId),
        }))

    return NextResponse.json({
      leaderboard: sanitizedLeaderboard,
      currentStudent: currentStudentStats[0]
        ? { ...currentStudentStats[0], is_current_user: true }
        : null,
      stats: stats[0] || { total_students: 0, average_score: 0, total_attempts: 0 },
      privacyMode: blurPeerNames,
      leaderboardPrivacy: { blurPeerNames },
    })
  } catch (error) {
    console.error("[Practice Leaderboard] Failed to fetch leaderboard:", error)
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
  }
}
