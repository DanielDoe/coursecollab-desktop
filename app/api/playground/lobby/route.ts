import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizePlaygroundPasscode } from "@/lib/playground-passcode"
import {
  claimedStudentIdFromPlaygroundRequest,
  requirePlaygroundStudentOrInstructor,
} from "@/lib/playground-request-auth"
import { sanitizePlaygroundEntryForStudent } from "@/lib/student-privacy"
import { resolvePlaygroundDisplayName } from "@/lib/playground-display-name"
import { isPlaygroundAttemptFinished } from "@/lib/playground-attempt-status"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { sqlPlaygroundResultRosterScope } from "@/lib/playground-instructor-scope"

export const dynamic = "force-dynamic"

/**
 * GET - Poll lobby / waiting room state for a student or instructor preview
 */
export async function GET(request: NextRequest) {
  try {
    const access = await requirePlaygroundStudentOrInstructor(
      request,
      claimedStudentIdFromPlaygroundRequest(request),
    )
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const sessionId = parseInt(searchParams.get("sessionId") || "", 10)
    const resultId = parseInt(searchParams.get("resultId") || "", 10)
    let studentId: string | null = null

    if (access.role === "student") {
      const rosterRows = await sql`
        SELECT student_id FROM students
        WHERE id = ${access.studentDbId} AND deleted_at IS NULL
        LIMIT 1
      `
      if (rosterRows.length === 0) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }
      studentId = String((rosterRows[0] as { student_id: string }).student_id)

      if (Number.isFinite(resultId)) {
        const owned = await sql`
          SELECT 1
          FROM playground_results pr
          JOIN students s ON s.deleted_at IS NULL
            AND (s.student_id = pr.student_id OR pr.student_id = s.id::text)
          WHERE pr.id = ${resultId}
            AND s.id = ${access.studentDbId}
          LIMIT 1
        `
        if (owned.length === 0) {
          return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }
      }
    }

    if (!Number.isFinite(sessionId)) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }

    const sessionRows = await sql`
      SELECT
        ps.id,
        ps.session_code,
        ps.join_passcode,
        ps.is_active,
        ps.game_started,
        ps.duration_sec,
        ps.question_count,
        ps.current_question_index,
        ps.selected_topics,
        ps.lobby_opened_at,
        ps.game_started_at
      FROM playground_sessions ps
      WHERE ps.id = ${sessionId}
        AND ps.mode = 'CLASSROOM'
      LIMIT 1
    `

    if (!sessionRows.length) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const session = sessionRows[0] as {
      id: number
      session_code: string
      join_passcode: string | null
      is_active: boolean
      game_started: boolean
      duration_sec: number
      question_count: number
      current_question_index: number
      selected_topics: string[] | null
      lobby_opened_at: string | null
      game_started_at: string | null
    }

    const participants =
      access.role === "student"
        ? await sql`
            SELECT
              pr.id AS result_id,
              pr.display_name,
              pr.nickname,
              pr.student_name,
              pr.student_id,
              pr.joined_at_question,
              pr.completed_at,
              pr.questions_answered,
              pr.score,
              pr.correct_answers
            FROM playground_results pr
            LEFT JOIN students s ON s.deleted_at IS NULL
              AND (s.student_id = pr.student_id OR pr.student_id = s.id::text)
            WHERE pr.session_id = ${sessionId}
              AND (
                pr.student_id = ${studentId}
                OR pr.student_id = ${String(access.studentDbId)}
                OR s.session_id = (
                  SELECT st.session_id FROM students st
                  WHERE st.id = ${access.studentDbId} AND st.deleted_at IS NULL
                  LIMIT 1
                )
              )
            ORDER BY pr.id ASC
          `
        : await (async () => {
            const courseScope = await requireInstructorCourse(request)
            const rosterScope = courseScope.ok
              ? await sqlPlaygroundResultRosterScope(request, courseScope.course.id, "pr.student_id")
              : sql``
            return sql`
              SELECT
                pr.id AS result_id,
                pr.display_name,
                pr.nickname,
                pr.student_name,
                pr.student_id,
                pr.joined_at_question,
                pr.completed_at,
                pr.questions_answered,
                pr.score,
                pr.correct_answers
              FROM playground_results pr
              WHERE pr.session_id = ${sessionId}
                ${rosterScope}
              ORDER BY pr.id ASC
            `
          })()

    let myResult = null
    if (Number.isFinite(resultId)) {
      myResult =
        (participants as {
          result_id: number
          completed_at: string | null
          joined_at_question: number
          questions_answered: number
        }[]).find((p) => p.result_id === resultId) ?? null
    }

    const attemptRevoked = Number.isFinite(resultId) && !myResult

    const topics = session.selected_topics ?? []
    const label =
      topics.find((t) => t.includes("—") || t.toLowerCase().includes("lecture")) ??
      topics[0] ??
      session.session_code

    const participantRows = participants.map((p: Record<string, unknown>) => ({
      resultId: p.result_id,
      displayName: resolvePlaygroundDisplayName(p),
      nickname: p.nickname,
      studentName: p.student_name,
      studentId: p.student_id,
      inWaitingRoom: Number(p.joined_at_question) < 0,
      joinedAt: p.completed_at,
    }))

    const sanitizedParticipants = studentId
      ? participantRows.map((p) => sanitizePlaygroundEntryForStudent(p, studentId))
      : participantRows

    const myResultPayload = myResult
      ? {
          resultId: (myResult as { result_id: number }).result_id,
          score: Number((myResult as { score: number }).score ?? 0),
          correctAnswers: Number((myResult as { correct_answers: number }).correct_answers ?? 0),
          completedAt: (myResult as { completed_at: string | null }).completed_at,
          questionsAnswered: Number((myResult as { questions_answered: number }).questions_answered ?? 0),
          attemptComplete: isPlaygroundAttemptFinished(
            {
              attemptComplete: (myResult as { completed_at: string | null }).completed_at != null,
              questionsAnswered: Number((myResult as { questions_answered: number }).questions_answered ?? 0),
            },
            session.question_count,
          ),
          inWaitingRoom: Number((myResult as { joined_at_question: number }).joined_at_question) < 0,
        }
      : null

    return NextResponse.json({
      sessionId: session.id,
      sessionCode: session.session_code,
      sessionLabel: label,
      passcode: session.join_passcode,
      isActive: session.is_active,
      gameStarted: session.game_started,
      durationSec: session.duration_sec,
      questionCount: session.question_count,
      currentQuestionIndex: session.current_question_index,
      participantCount: participants.length,
      participants: sanitizedParticipants,
      myResult: myResultPayload,
      attemptRevoked,
      lobbyOpen: session.is_active && !session.game_started,
      sessionEnded: !session.is_active,
      privacyMode: false,
    })
  } catch {
    return NextResponse.json({ error: "Failed to fetch lobby status" }, { status: 500 })
  }
}

/**
 * POST - Validate passcode without joining (optional preview)
 */
export async function POST(request: NextRequest) {
  try {
    const access = await requirePlaygroundStudentOrInstructor(
      request,
      claimedStudentIdFromPlaygroundRequest(request),
    )
    if (!access.ok) return access.response

    const { passcode } = await request.json()
    const code = normalizePlaygroundPasscode(passcode)
    if (code.length !== 5) {
      return NextResponse.json({ error: "Enter a 5-character passcode" }, { status: 400 })
    }

    const rows = await sql`
      SELECT
        ps.id,
        ps.session_code,
        ps.is_active,
        ps.game_started,
        ps.question_count,
        ps.selected_topics
      FROM playground_sessions ps
      WHERE ps.mode = 'CLASSROOM'
        AND ps.is_active = true
        AND UPPER(ps.join_passcode) = ${code}
      LIMIT 1
    `

    if (!rows.length) {
      return NextResponse.json({ error: "Invalid or expired passcode" }, { status: 404 })
    }

    const session = rows[0] as {
      id: number
      session_code: string
      game_started: boolean
      question_count: number
      selected_topics: string[] | null
    }

    const topics = session.selected_topics ?? []
    const label =
      topics.find((t) => t.includes("—") || t.toLowerCase().includes("lecture")) ??
      topics[0] ??
      session.session_code

    return NextResponse.json({
      valid: true,
      sessionId: session.id,
      sessionCode: session.session_code,
      sessionLabel: label,
      questionCount: session.question_count,
      gameStarted: session.game_started,
      canJoin: !session.game_started,
    })
  } catch {
    return NextResponse.json({ error: "Failed to validate passcode" }, { status: 500 })
  }
}
