import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getPlaygroundLeaderboardBlurPeerNames } from "@/lib/playground-leaderboard-privacy"
import { resolvePlaygroundDisplayName } from "@/lib/playground-display-name"
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope"
import { sanitizePlaygroundEntryForStudent } from "@/lib/student-privacy"
import {
  claimedStudentIdFromPlaygroundRequest,
  requirePlaygroundStudentOrInstructor,
} from "@/lib/playground-request-auth"
import { resolvePlaygroundLeaderboardViewer } from "@/lib/playground-leaderboard-viewer"
import {
  playgroundLeaderboardShouldPoll,
  playgroundParticipantStatus,
} from "@/lib/playground-leaderboard-utils"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { sqlPlaygroundResultRosterScope } from "@/lib/playground-instructor-scope"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const access = await requirePlaygroundStudentOrInstructor(
      request,
      claimedStudentIdFromPlaygroundRequest(request),
    )
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("sessionId")

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 })
    }

    const parsedSessionId = parseInt(sessionId, 10)
    if (!Number.isFinite(parsedSessionId) || parsedSessionId <= 0) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 })
    }

    const sessionRows = await sql`
      SELECT id, question_count, is_active, game_started
      FROM playground_sessions
      WHERE id = ${parsedSessionId}
      LIMIT 1
    `
    const sessionRow = sessionRows[0] as Record<string, unknown> | undefined
    if (!sessionRow) {
      return NextResponse.json({
        leaderboard: [],
        session: null,
        leaderboardFinalized: true,
        privacyMode: false,
        leaderboardPrivacy: { blurPeerNames: false },
      })
    }

    const questionCount = parseInt(String(sessionRow.question_count ?? 0), 10)
    const sessionMeta = {
      isActive: Boolean(sessionRow.is_active),
      gameStarted: Boolean(sessionRow.game_started),
    }

    const viewer =
      access.role === "student"
        ? await resolvePlaygroundLeaderboardViewer(access.studentDbId)
        : null
    if (access.role === "student" && !viewer) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    let blurPeerNames = false
    let leaderboard

    if (viewer) {
      const studentCtx = await resolveStudentCourseContextByDbId(viewer.dbId)
      blurPeerNames = await getPlaygroundLeaderboardBlurPeerNames(studentCtx?.courseId ?? null)

      leaderboard = await sql`
        WITH latest_results AS (
          SELECT DISTINCT ON (pr.student_id)
            pr.id,
            pr.display_name,
            pr.nickname,
            pr.student_name,
            pr.student_id,
            pr.score,
            pr.questions_answered,
            pr.correct_answers,
            pr.completed_at,
            pr.joined_at_question
          FROM playground_results pr
          WHERE pr.session_id = ${parsedSessionId}
          ORDER BY pr.student_id, pr.id DESC
        )
        SELECT
          lr.id,
          lr.display_name,
          lr.nickname,
          lr.student_name,
          lr.student_id,
          lr.score,
          lr.questions_answered,
          lr.correct_answers,
          lr.completed_at,
          lr.joined_at_question
        FROM latest_results lr
        LEFT JOIN students s ON s.deleted_at IS NULL
          AND (s.student_id = lr.student_id OR lr.student_id = s.id::text)
        WHERE lr.student_id = ${viewer.rosterStudentId}
          OR lr.student_id = ${String(viewer.dbId)}
          OR (${viewer.sessionId}::int IS NOT NULL AND s.session_id = ${viewer.sessionId})
          OR (
            ${viewer.sessionId}::int IS NULL
            AND cardinality(${viewer.sectionVariants}::text[]) > 0
            AND TRIM(COALESCE(s.section, '')) = ANY(${viewer.sectionVariants}::text[])
          )
        ORDER BY lr.score DESC, lr.completed_at ASC NULLS LAST
      `
    } else {
      const courseScope = await requireInstructorCourse(request)
      const rosterScope = courseScope.ok
        ? await sqlPlaygroundResultRosterScope(request, courseScope.course.id, "pr.student_id")
        : sql``
      blurPeerNames = false
      leaderboard = await sql`
        WITH latest_results AS (
          SELECT DISTINCT ON (pr.student_id)
            pr.id,
            pr.display_name,
            pr.nickname,
            pr.student_name,
            pr.student_id,
            pr.score,
            pr.questions_answered,
            pr.correct_answers,
            pr.completed_at,
            pr.joined_at_question
          FROM playground_results pr
          WHERE pr.session_id = ${parsedSessionId}
            ${rosterScope}
          ORDER BY pr.student_id, pr.id DESC
        )
        SELECT
          id,
          display_name,
          nickname,
          student_name,
          student_id,
          score,
          questions_answered,
          correct_answers,
          completed_at,
          joined_at_question
        FROM latest_results
        ORDER BY score DESC, completed_at ASC NULLS LAST
      `
    }

    const rankedLeaderboard = leaderboard.map((entry: Record<string, unknown>, index: number) => {
      const joinedAtQuestion = Number(entry.joined_at_question ?? 0)
      const questionsAnswered = parseInt(String(entry.questions_answered ?? 0), 10)
      const completedAt = entry.completed_at as string | null
      const status = playgroundParticipantStatus(
        joinedAtQuestion,
        questionsAnswered,
        questionCount,
        completedAt,
      )

      return {
        rank: index + 1,
        resultId: entry.id,
        displayName: resolvePlaygroundDisplayName(entry),
        nickname: entry.nickname,
        studentName: entry.student_name,
        studentId: entry.student_id,
        score: Number(entry.score ?? 0),
        questionsAnswered: entry.questions_answered,
        correctAnswers: Number(entry.correct_answers ?? 0),
        status,
      }
    })

    const sanitizedLeaderboard = viewer
      ? rankedLeaderboard.map((entry) =>
          sanitizePlaygroundEntryForStudent(entry, viewer.rosterStudentId, { blurPeerNames }),
        )
      : rankedLeaderboard

    const leaderboardFinalized = !playgroundLeaderboardShouldPoll(
      sanitizedLeaderboard,
      null,
      sessionMeta,
    )

    return NextResponse.json({
      leaderboard: sanitizedLeaderboard,
      session: sessionMeta,
      leaderboardFinalized,
      privacyMode: Boolean(viewer && blurPeerNames),
      leaderboardPrivacy: {
        blurPeerNames: Boolean(viewer && blurPeerNames),
      },
    })
  } catch (error) {
    console.error("Error fetching playground leaderboard:", error)
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 })
  }
}
