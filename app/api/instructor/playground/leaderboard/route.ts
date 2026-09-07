import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { resolvePlaygroundClassroomInstructorScopeSql } from "@/lib/instructor-default-courses"
import { sqlPlaygroundResultRosterJoinOnScope, sqlPlaygroundResultRosterScope, sqlPlaygroundTermScope } from "@/lib/playground-instructor-scope"
import { resolvePlaygroundDisplayName } from "@/lib/playground-display-name"

export const dynamic = "force-dynamic"

type LeaderboardRow = Record<string, unknown>

function sessionLabelFromTopics(selectedTopics: string[] | null, sessionCode: string): string {
  const topics = selectedTopics ?? []
  const label = topics.find((t) => t.includes("—") || t.toLowerCase().includes("lecture"))
  return label ?? topics[0] ?? sessionCode
}

function participantStatus(
  joinedAtQuestion: number,
  questionsAnswered: number,
  questionCount: number,
  completedAt: string | null,
): "waiting" | "playing" | "completed" {
  if (joinedAtQuestion < 0) return "waiting"
  if (completedAt || (questionCount > 0 && questionsAnswered >= questionCount)) return "completed"
  if (questionsAnswered > 0) return "playing"
  return "playing"
}

function mapLeaderboardEntry(entry: LeaderboardRow, rank: number | null) {
  const joinedAtQuestion = Number(entry.joined_at_question ?? 0)
  const questionsAnswered = parseInt(String(entry.questions_answered ?? 0), 10)
  const questionCount = parseInt(String(entry.question_count ?? 0), 10)
  const completedAt = entry.completed_at as string | null
  const status = participantStatus(joinedAtQuestion, questionsAnswered, questionCount, completedAt)
  const rosterName = String(entry.roster_full_name ?? entry.student_name ?? "").trim()
  const displayName = resolvePlaygroundDisplayName({
    nickname: entry.nickname,
    display_name: entry.display_name,
    student_name: rosterName || entry.student_name,
    student_id: entry.student_id,
  })

  return {
    rank,
    resultId: entry.result_id,
    studentId: entry.student_id,
    studentName: rosterName || String(entry.student_name ?? ""),
    displayName,
    nickname: entry.nickname ? String(entry.nickname) : null,
    score: parseInt(String(entry.score ?? entry.total_score ?? 0), 10),
    questionsAnswered: parseInt(String(entry.questions_answered ?? entry.total_questions_answered ?? 0), 10),
    correctAnswers: parseInt(String(entry.correct_answers ?? entry.total_correct_answers ?? 0), 10),
    accuracyPercentage: parseFloat(String(entry.accuracy_percentage ?? 0)),
    completedAt: entry.completed_at || entry.last_completed_at || null,
    sessionCode: entry.session_code ? String(entry.session_code) : null,
    sessionsPlayed: parseInt(String(entry.sessions_played ?? 1), 10),
    status,
    joinedAtQuestion,
  }
}

function rankSessionLeaderboard(rows: LeaderboardRow[]): ReturnType<typeof mapLeaderboardEntry>[] {
  const sorted = [...rows].sort((a, b) => {
    const aWaiting = Number(a.joined_at_question ?? 0) < 0
    const bWaiting = Number(b.joined_at_question ?? 0) < 0
    if (aWaiting !== bWaiting) return aWaiting ? 1 : -1
    const scoreDiff = Number(b.score ?? 0) - Number(a.score ?? 0)
    if (scoreDiff !== 0) return scoreDiff
    const aCompleted = a.completed_at ? new Date(String(a.completed_at)).getTime() : Number.MAX_SAFE_INTEGER
    const bCompleted = b.completed_at ? new Date(String(b.completed_at)).getTime() : Number.MAX_SAFE_INTEGER
    return aCompleted - bCompleted
  })

  let rank = 0
  return sorted.map((entry) => {
    const isWaiting = Number(entry.joined_at_question ?? 0) < 0
    if (!isWaiting) rank += 1
    return mapLeaderboardEntry(entry, isWaiting ? null : rank)
  })
}

/**
 * GET - Fetch playground leaderboard with session filtering
 */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response
    const psScope = await resolvePlaygroundClassroomInstructorScopeSql(
      "ps",
      scope.course.id,
      scope.instructorId,
      scope.course.course_code,
    )
    const termScope = await sqlPlaygroundTermScope(request)
    const rosterScopeLr = await sqlPlaygroundResultRosterScope(request, scope.course.id, "lr.student_id")
    const rosterScopePr = await sqlPlaygroundResultRosterScope(request, scope.course.id, "pr.student_id")
    const rosterJoinPr = await sqlPlaygroundResultRosterJoinOnScope(request, scope.course.id, "pr.student_id")

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("sessionId")
    const sessionCode = searchParams.get("sessionCode")

    let leaderboard: LeaderboardRow[]
    let sessionMeta: Record<string, unknown> | null = null

    if (sessionId) {
      const parsedSessionId = Number.parseInt(sessionId, 10)
      const sessionRows = await sql`
        SELECT
          ps.id,
          ps.session_code,
          ps.selected_topics,
          ps.question_count,
          ps.is_active,
          ps.game_started,
          ps.created_at
        FROM playground_sessions ps
        WHERE ps.id = ${parsedSessionId}
          AND ps.mode = 'CLASSROOM'
          AND (${psScope})
          ${termScope}
        LIMIT 1
      `
      if (sessionRows.length === 0) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
      }
      if (sessionRows.length > 0) {
        const row = sessionRows[0] as {
          id: number
          session_code: string
          selected_topics: string[] | null
          question_count: number
          is_active: boolean
          game_started: boolean
          created_at: string
        }
        sessionMeta = {
          id: row.id,
          sessionCode: row.session_code,
          label: sessionLabelFromTopics(row.selected_topics, row.session_code),
          questionCount: row.question_count,
          isActive: row.is_active,
          gameStarted: row.game_started,
          createdAt: row.created_at,
        }
      }

      leaderboard = (await sql`
        WITH latest_results AS (
          SELECT DISTINCT ON (pr.student_id)
            pr.id,
            pr.student_id,
            pr.student_name,
            pr.display_name,
            pr.nickname,
            pr.score,
            pr.questions_answered,
            pr.correct_answers,
            pr.completed_at,
            pr.joined_at_question,
            pr.session_id
          FROM playground_results pr
          WHERE pr.session_id = ${parsedSessionId}
            ${rosterScopePr}
          ORDER BY pr.student_id, pr.id DESC
        )
        SELECT 
          lr.id as result_id,
          lr.student_id,
          lr.student_name,
          lr.display_name,
          lr.nickname,
          lr.score,
          lr.questions_answered,
          lr.correct_answers,
          lr.completed_at,
          lr.joined_at_question,
          s.full_name as roster_full_name,
          ps.session_code,
          ps.question_count,
          ROUND((lr.correct_answers::NUMERIC / NULLIF(lr.questions_answered, 0)) * 100, 2) as accuracy_percentage
        FROM latest_results lr
        JOIN playground_sessions ps ON lr.session_id = ps.id
        LEFT JOIN students s ON s.deleted_at IS NULL
          AND (s.student_id = lr.student_id OR lr.student_id = s.id::text)
        WHERE ps.mode = 'CLASSROOM'
          AND (${psScope})
          ${termScope}
          ${rosterScopeLr}
      `) as LeaderboardRow[]
    } else if (sessionCode) {
      const sessionVariants = normalizedSectionVariantsForSql(sessionCode)
      leaderboard = (await sql`
        SELECT 
          pr.id as result_id,
          pr.student_id,
          pr.student_name,
          pr.display_name,
          pr.nickname,
          pr.score,
          pr.questions_answered,
          pr.correct_answers,
          pr.completed_at,
          pr.joined_at_question,
          s.full_name as roster_full_name,
          ps.session_code,
          ps.question_count,
          ROUND((pr.correct_answers::NUMERIC / NULLIF(pr.questions_answered, 0)) * 100, 2) as accuracy_percentage
        FROM playground_results pr
        JOIN playground_sessions ps ON pr.session_id = ps.id
        LEFT JOIN students s ON s.deleted_at IS NULL
          AND (s.student_id = pr.student_id OR pr.student_id = s.id::text)
        WHERE TRIM(ps.session_code) = ANY(${sessionVariants}::text[])
          AND ps.mode = 'CLASSROOM'
          AND (${psScope})
          ${termScope}
          ${rosterScopePr}
      `) as LeaderboardRow[]
    } else {
      leaderboard = (await sql`
        SELECT 
          pr.id as result_id,
          pr.student_id,
          pr.student_name,
          pr.display_name,
          pr.nickname,
          SUM(pr.score) as total_score,
          SUM(pr.questions_answered) as total_questions_answered,
          SUM(pr.correct_answers) as total_correct_answers,
          MAX(pr.completed_at) as last_completed_at,
          COUNT(DISTINCT pr.session_id) as sessions_played,
          ROUND((SUM(pr.correct_answers)::NUMERIC / NULLIF(SUM(pr.questions_answered), 0)) * 100, 2) as accuracy_percentage
        FROM playground_results pr
        JOIN playground_sessions ps ON pr.session_id = ps.id
        WHERE ps.mode = 'CLASSROOM'
          AND (${psScope})
          ${termScope}
          AND pr.joined_at_question >= 0
          ${rosterScopePr}
        GROUP BY pr.student_id, pr.student_name, pr.display_name, pr.nickname
        ORDER BY total_score DESC, last_completed_at ASC NULLS LAST
        LIMIT 100
      `) as LeaderboardRow[]
    }

    const rankedLeaderboard =
      sessionId || sessionCode
        ? rankSessionLeaderboard(leaderboard)
        : leaderboard.map((entry, index) => mapLeaderboardEntry(entry, index + 1))

    let statsQuery
    if (sessionId) {
      statsQuery = sql`
        SELECT 
          COUNT(DISTINCT ps.id) as total_sessions,
          COUNT(DISTINCT pr.student_id) as unique_students,
          COUNT(pr.id) as total_attempts,
          COUNT(pr.id) FILTER (WHERE pr.joined_at_question >= 0) as active_participants,
          COUNT(pr.id) FILTER (WHERE pr.joined_at_question < 0) as waiting_participants,
          AVG(pr.score) FILTER (WHERE pr.joined_at_question >= 0) as avg_score,
          MAX(pr.score) as max_score,
          AVG((pr.correct_answers::NUMERIC / NULLIF(pr.questions_answered, 0)) * 100)
            FILTER (WHERE pr.questions_answered > 0) as avg_accuracy
        FROM playground_sessions ps
        LEFT JOIN playground_results pr ON ps.id = pr.session_id
          ${rosterJoinPr}
        WHERE ps.mode = 'CLASSROOM' AND ps.id = ${Number.parseInt(sessionId, 10)}
          AND (${psScope})
          ${termScope}
      `
    } else if (sessionCode) {
      const sessionVariants = normalizedSectionVariantsForSql(sessionCode)
      statsQuery = sql`
        SELECT 
          COUNT(DISTINCT ps.id) as total_sessions,
          COUNT(DISTINCT pr.student_id) as unique_students,
          COUNT(pr.id) as total_attempts,
          COUNT(pr.id) FILTER (WHERE pr.joined_at_question >= 0) as active_participants,
          COUNT(pr.id) FILTER (WHERE pr.joined_at_question < 0) as waiting_participants,
          AVG(pr.score) FILTER (WHERE pr.joined_at_question >= 0) as avg_score,
          MAX(pr.score) as max_score,
          AVG((pr.correct_answers::NUMERIC / NULLIF(pr.questions_answered, 0)) * 100)
            FILTER (WHERE pr.questions_answered > 0) as avg_accuracy
        FROM playground_sessions ps
        LEFT JOIN playground_results pr ON ps.id = pr.session_id
          ${rosterJoinPr}
        WHERE ps.mode = 'CLASSROOM' AND TRIM(ps.session_code) = ANY(${sessionVariants}::text[])
          AND (${psScope})
          ${termScope}
      `
    } else {
      statsQuery = sql`
        SELECT 
          COUNT(DISTINCT ps.id) as total_sessions,
          COUNT(DISTINCT pr.student_id) as unique_students,
          COUNT(pr.id) as total_attempts,
          COUNT(pr.id) FILTER (WHERE pr.joined_at_question >= 0) as active_participants,
          COUNT(pr.id) FILTER (WHERE pr.joined_at_question < 0) as waiting_participants,
          AVG(pr.score) FILTER (WHERE pr.joined_at_question >= 0) as avg_score,
          MAX(pr.score) as max_score,
          AVG((pr.correct_answers::NUMERIC / NULLIF(pr.questions_answered, 0)) * 100)
            FILTER (WHERE pr.questions_answered > 0) as avg_accuracy
        FROM playground_sessions ps
        LEFT JOIN playground_results pr ON ps.id = pr.session_id
          ${rosterJoinPr}
        WHERE ps.mode = 'CLASSROOM'
          AND (${psScope})
          ${termScope}
      `
    }

    const stats = await statsQuery

    return NextResponse.json({
      session: sessionMeta,
      leaderboard: rankedLeaderboard,
      stats: {
        totalSessions: parseInt(String(stats[0]?.total_sessions ?? 0), 10),
        uniqueStudents: parseInt(String(stats[0]?.unique_students ?? 0), 10),
        totalAttempts: parseInt(String(stats[0]?.total_attempts ?? 0), 10),
        activeParticipants: parseInt(String(stats[0]?.active_participants ?? 0), 10),
        waitingParticipants: parseInt(String(stats[0]?.waiting_participants ?? 0), 10),
        avgScore: parseFloat(String(stats[0]?.avg_score ?? 0)),
        maxScore: parseInt(String(stats[0]?.max_score ?? 0), 10),
        avgAccuracy: parseFloat(String(stats[0]?.avg_accuracy ?? 0)),
      },
    })
  } catch (error) {
    console.error("[instructor playground leaderboard]", error)
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
  }
}
