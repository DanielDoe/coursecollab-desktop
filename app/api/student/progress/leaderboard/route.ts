import { type NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { sql } from "@/lib/db"
import { isCurrentStudent, sanitizeLeaderboardForStudent } from "@/lib/student-privacy"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    const studentIdHeader = String(auth.studentDbId)
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "global" // global, weekly, topic
    const topic = searchParams.get("topic")

    let leaderboardQuery

    if (type === "weekly") {
      // Weekly leaderboard (last 7 days)
      leaderboardQuery = sql`
        SELECT 
          s.id,
          s.name,
          sp.total_xp,
          sp.current_level,
          sp.accuracy_percentage,
          sp.current_streak,
          sp.weekly_xp,
          sp.last_active_date,
          COALESCE(
            (SELECT badge_name FROM student_achievements sa 
             WHERE sa.student_id = s.id 
             ORDER BY sa.earned_at DESC LIMIT 1), 
            'Beginner'
          ) as current_badge,
          COALESCE(
            (SELECT badge_icon FROM student_achievements sa 
             WHERE sa.student_id = s.id 
             ORDER BY sa.earned_at DESC LIMIT 1), 
            '🐣'
          ) as badge_icon,
          COALESCE(
            (SELECT badge_color FROM student_achievements sa 
             WHERE sa.student_id = s.id 
             ORDER BY sa.earned_at DESC LIMIT 1), 
            '#6b7280'
          ) as badge_color,
          ROW_NUMBER() OVER (ORDER BY sp.weekly_xp DESC, sp.total_xp DESC) as rank
        FROM students s
        LEFT JOIN student_progress sp ON s.id = sp.student_id
        WHERE sp.weekly_xp > 0
        ORDER BY sp.weekly_xp DESC, sp.total_xp DESC
        LIMIT 50
      `
    } else if (type === "topic" && topic) {
      // Topic-specific leaderboard
      leaderboardQuery = sql`
        SELECT 
          s.id,
          s.name,
          stp.xp_earned as topic_xp,
          stp.questions_answered,
          stp.accuracy_percentage,
          sp.current_level,
          sp.current_streak,
          sp.total_xp,
          COALESCE(
            (SELECT badge_name FROM student_achievements sa 
             WHERE sa.student_id = s.id 
             ORDER BY sa.earned_at DESC LIMIT 1), 
            'Beginner'
          ) as current_badge,
          COALESCE(
            (SELECT badge_icon FROM student_achievements sa 
             WHERE sa.student_id = s.id 
             ORDER BY sa.earned_at DESC LIMIT 1), 
            '🐣'
          ) as badge_icon,
          COALESCE(
            (SELECT badge_color FROM student_achievements sa 
             WHERE sa.student_id = s.id 
             ORDER BY sa.earned_at DESC LIMIT 1), 
            '#6b7280'
          ) as badge_color,
          ROW_NUMBER() OVER (ORDER BY stp.xp_earned DESC, stp.accuracy_percentage DESC) as rank
        FROM students s
        JOIN student_topic_progress stp ON s.id = stp.student_id
        LEFT JOIN student_progress sp ON s.id = sp.student_id
        WHERE stp.topic = ${topic}
        ORDER BY stp.xp_earned DESC, stp.accuracy_percentage DESC
        LIMIT 50
      `
    } else {
      // Global leaderboard
      leaderboardQuery = sql`
        SELECT 
          s.id,
          s.name,
          sp.total_xp,
          sp.current_level,
          sp.accuracy_percentage,
          sp.current_streak,
          sp.total_questions_answered,
          sp.last_active_date,
          COALESCE(
            (SELECT badge_name FROM student_achievements sa 
             WHERE sa.student_id = s.id 
             ORDER BY sa.earned_at DESC LIMIT 1), 
            'Beginner'
          ) as current_badge,
          COALESCE(
            (SELECT badge_icon FROM student_achievements sa 
             WHERE sa.student_id = s.id 
             ORDER BY sa.earned_at DESC LIMIT 1), 
            '🐣'
          ) as badge_icon,
          COALESCE(
            (SELECT badge_color FROM student_achievements sa 
             WHERE sa.student_id = s.id 
             ORDER BY sa.earned_at DESC LIMIT 1), 
            '#6b7280'
          ) as badge_color,
          ROW_NUMBER() OVER (ORDER BY sp.total_xp DESC, sp.accuracy_percentage DESC) as rank
        FROM students s
        LEFT JOIN student_progress sp ON s.id = sp.student_id
        WHERE sp.total_xp > 0
        ORDER BY sp.total_xp DESC, sp.accuracy_percentage DESC
        LIMIT 50
      `
    }

    const leaderboard = await leaderboardQuery

    // Get current student's stats
    const currentStudent = await sql`
      SELECT 
        sp.total_xp,
        sp.current_level,
        sp.accuracy_percentage,
        sp.current_streak,
        sp.total_questions_answered,
        sp.weekly_xp,
        COALESCE(
          (SELECT badge_name FROM student_achievements sa 
           WHERE sa.student_id = ${studentIdHeader} 
           ORDER BY sa.earned_at DESC LIMIT 1), 
          'Beginner'
        ) as current_badge,
        COALESCE(
          (SELECT badge_icon FROM student_achievements sa 
           WHERE sa.student_id = ${studentIdHeader} 
           ORDER BY sa.earned_at DESC LIMIT 1), 
          '🐣'
        ) as badge_icon,
        COALESCE(
          (SELECT badge_color FROM student_achievements sa 
           WHERE sa.student_id = ${studentIdHeader} 
           ORDER BY sa.earned_at DESC LIMIT 1), 
          '#6b7280'
        ) as badge_color
      FROM student_progress sp
      WHERE sp.student_id = ${studentIdHeader}
    `

    // Find current student's rank
    const currentStudentRank = leaderboard.find(entry => isCurrentStudent(entry.id, studentIdHeader))

    const sanitizedLeaderboard = sanitizeLeaderboardForStudent(leaderboard || [], studentIdHeader)

    // Get overall stats
    const stats = await sql`
      SELECT 
        COUNT(DISTINCT sp.student_id) as total_students,
        AVG(sp.total_xp) as average_xp,
        MAX(sp.total_xp) as max_xp,
        AVG(sp.accuracy_percentage) as average_accuracy
      FROM student_progress sp
      WHERE sp.total_xp > 0
    `

    return NextResponse.json({
      leaderboard: sanitizedLeaderboard,
      currentStudent: currentStudent[0] ? { ...currentStudent[0], is_current_user: true } : null,
      currentStudentRank: currentStudentRank?.rank || null,
      stats: stats[0] || { total_students: 0, average_xp: 0, max_xp: 0, average_accuracy: 0 },
      type,
      privacyMode: true,
    })
  } catch (error) {
    console.error("[Leaderboard] Failed to fetch leaderboard:", error)
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
  }
}
