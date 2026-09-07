import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  buildInstructorOwnedCourseScopeSqlFragment,
  getPlaygroundSessionsScopeColumns,
  resolvePlaygroundClassroomInstructorScopeSql,
} from "@/lib/instructor-default-courses"
import {
  resolvePlaygroundActivationAllowedIds,
  resolvePlaygroundAllowedSessionsForCreate,
  sqlPlaygroundAllowedSessionsOverlapScope,
  sqlPlaygroundTermScope,
} from "@/lib/playground-instructor-scope"
import { generateUniquePlaygroundPasscode } from "@/lib/playground-passcode"
import { getPlaygroundPolicyForCourse } from "@/lib/playground-policy-settings.server"
import { PLAYGROUND_ALLOWED_QUESTION_TYPES } from "@/lib/playground-question-utils"
import {
  countPlaygroundRows,
  logPlaygroundDeleteAudit,
} from "@/lib/playground-delete-audit"
import { clearPlaygroundSessionAttempts, clearPlaygroundWaitingRoomAttempts } from "@/lib/playground-session-reset"
import {
  checkPlaygroundStudentDataDeleteAllowed,
  playgroundDeleteGuardResponse,
} from "@/lib/playground-production-guard"
export const dynamic = "force-dynamic"

/**
 * GET - Fetch all playground sessions with stats
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
    const page = Math.max(1, Math.trunc(Number(request.nextUrl.searchParams.get("page") ?? 1)) || 1)
    const pageSize = Math.min(
      200,
      Math.max(1, Math.trunc(Number(request.nextUrl.searchParams.get("limit") ?? 50)) || 50),
    )
    const offset = (page - 1) * pageSize

    const countRows = (await sql`
      SELECT COUNT(*)::int AS total
      FROM playground_sessions ps
      WHERE ps.mode = 'CLASSROOM'
        AND (${psScope})
        ${termScope}
    `) as { total: number }[]
    const total = Number(countRows[0]?.total ?? 0)

    const sessions = await sql`
      SELECT 
        ps.id,
        ps.session_code,
        ps.mode,
        ps.duration_sec,
        ps.is_active,
        ps.game_started,
        ps.join_passcode,
        ps.selected_topics,
        ps.question_count,
        ps.current_question_index,
        ps.created_at,
        ps.ended_at,
        ps.lobby_opened_at,
        ps.game_started_at,
        ps.allowed_sessions,
        COUNT(DISTINCT pr.id) as participant_count,
        COUNT(DISTINCT pr.id) FILTER (WHERE pr.joined_at_question < 0) as waiting_count,
        COUNT(DISTINCT pq.id) as question_count_actual
      FROM playground_sessions ps
      LEFT JOIN playground_results pr ON ps.id = pr.session_id
      LEFT JOIN playground_questions pq ON ps.id = pq.session_id
      WHERE ps.mode = 'CLASSROOM'
        AND (${psScope})
        ${termScope}
      GROUP BY ps.id, ps.session_code, ps.mode, ps.duration_sec, ps.is_active,
               ps.game_started, ps.join_passcode, ps.selected_topics, ps.question_count,
               ps.current_question_index, ps.created_at, ps.ended_at, ps.lobby_opened_at,
               ps.game_started_at, ps.allowed_sessions
      ORDER BY ps.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `

    return NextResponse.json({ sessions, total, page, pageSize })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 })
  }
}

/**
 * POST - Create or update a playground session
 */
export async function POST(request: NextRequest) {
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
    const qbScope = buildInstructorOwnedCourseScopeSqlFragment(
      "qb",
      "course_id",
      scope.course.id,
      scope.instructorId,
      { scopeCourseCode: scope.course.course_code },
    )
    const playgroundCols = await getPlaygroundSessionsScopeColumns()

    const { action, sessionId, topics, questionCount, durationSec, questionIds, allowedSessions, confirmPhrase } =
      await request.json()

    if (action === "start") {
      const policy = await getPlaygroundPolicyForCourse(scope.course.id)
      const resolvedQuestionCount = Number(questionCount) || policy.default_question_count
      const resolvedDuration = Number(durationSec) || policy.default_duration_sec

      if (resolvedQuestionCount < 1 || resolvedQuestionCount > policy.max_questions_per_session) {
        return NextResponse.json(
          {
            error: `Question count must be between 1 and ${policy.max_questions_per_session}`,
          },
          { status: 400 },
        )
      }

      if (
        resolvedDuration < policy.min_duration_sec ||
        resolvedDuration > policy.max_duration_sec
      ) {
        return NextResponse.json(
          {
            error: `Duration must be between ${policy.min_duration_sec} and ${policy.max_duration_sec} seconds`,
          },
          { status: 400 },
        )
      }

      const hasAllowedSessions =
        allowedSessions && Array.isArray(allowedSessions) && allowedSessions.length > 0
      const finalAllowedSessions = await resolvePlaygroundAllowedSessionsForCreate(
        request,
        hasAllowedSessions ? allowedSessions : null,
      )
      if (policy.require_session_restriction && !finalAllowedSessions?.length) {
        return NextResponse.json(
          { error: "Select at least one class section for this playground session." },
          { status: 400 },
        )
      }

      const lobbyOverlapScope = sqlPlaygroundAllowedSessionsOverlapScope(finalAllowedSessions)

      const liveGames =
        finalAllowedSessions && finalAllowedSessions.length > 0
          ? await sql`
        SELECT ps.id FROM playground_sessions ps
        WHERE ps.mode = 'CLASSROOM' AND ps.is_active = true AND ps.game_started = true
          AND (${psScope})
          AND (${lobbyOverlapScope})
      `
          : await sql`
        SELECT ps.id FROM playground_sessions ps
        WHERE ps.mode = 'CLASSROOM' AND ps.is_active = true AND ps.game_started = true
          AND (${psScope})
          ${termScope}
      `
      if (liveGames.length >= policy.max_concurrent_live_sessions) {
        return NextResponse.json(
          {
            error:
              "Maximum live playground sessions reached. Stop an active game before opening a new lobby.",
            liveSessionId: (liveGames[0] as { id: number }).id,
          },
          { status: 409 },
        )
      }

      // Close only waiting-room lobbies — never end a session where students are already playing.
      if (finalAllowedSessions && finalAllowedSessions.length > 0) {
        await sql`
        UPDATE playground_sessions ps
        SET is_active = false, game_started = false, ended_at = CURRENT_TIMESTAMP
        WHERE ps.mode = 'CLASSROOM' AND ps.is_active = true AND ps.game_started = false
          AND (${psScope})
          AND (${lobbyOverlapScope})
      `
      }

      const joinPasscode = await generateUniquePlaygroundPasscode()

      const newSession =
        playgroundCols.hasCourseId && playgroundCols.hasInstructorId
          ? await sql`
        INSERT INTO playground_sessions (
          mode, 
          duration_sec, 
          is_active, 
          selected_topics, 
          question_count,
          current_question_index,
          allowed_sessions,
          course_id,
          instructor_id,
          join_passcode,
          game_started,
          lobby_opened_at
        )
        VALUES (
          'CLASSROOM', 
          ${resolvedDuration}, 
          true, 
          ${topics || []}, 
          ${resolvedQuestionCount},
          0,
          ${finalAllowedSessions},
          ${scope.course.id},
          ${scope.instructorId},
          ${joinPasscode},
          false,
          CURRENT_TIMESTAMP
        )
        RETURNING id, session_code, duration_sec, selected_topics, question_count, created_at, allowed_sessions, join_passcode
      `
          : await sql`
        INSERT INTO playground_sessions (
          mode, 
          duration_sec, 
          is_active, 
          selected_topics, 
          question_count,
          current_question_index,
          allowed_sessions,
          join_passcode,
          game_started,
          lobby_opened_at
        )
        VALUES (
          'CLASSROOM', 
          ${resolvedDuration}, 
          true, 
          ${topics || []}, 
          ${resolvedQuestionCount},
          0,
          ${finalAllowedSessions},
          ${joinPasscode},
          false,
          CURRENT_TIMESTAMP
        )
        RETURNING id, session_code, duration_sec, selected_topics, question_count, created_at, allowed_sessions, join_passcode
      `

      const sessionIdNew = newSession[0].id

      if (questionIds && Array.isArray(questionIds) && questionIds.length > 0) {
        const allowed = await sql`
          SELECT qb.id
          FROM question_bank qb
          WHERE qb.id = ANY(${questionIds})
            AND qb.deleted_at IS NULL
            AND qb.question_type = ANY(${[...PLAYGROUND_ALLOWED_QUESTION_TYPES]})
            AND (${qbScope})
        `
        if (allowed.length !== questionIds.length) {
          await sql`DELETE FROM playground_sessions WHERE id = ${sessionIdNew}`
          return NextResponse.json(
            {
              error:
                "One or more questions are unavailable. Playground supports MCQ and True/False only (select_all is not allowed). LEGACY, ELEG1301, and ELEG1304 share the same bank; other courses only see their own course questions.",
            },
            { status: 400 },
          )
        }
        for (let i = 0; i < questionIds.length; i++) {
          await sql`
            INSERT INTO playground_questions (session_id, bank_question_id, question_order)
            VALUES (${sessionIdNew}, ${questionIds[i]}, ${i + 1})
            ON CONFLICT (session_id, question_order) DO NOTHING
          `
        }
      } else if (topics && topics.length > 0) {
        const availableQuestions = await sql`
          SELECT qb.id
          FROM question_bank qb
          WHERE qb.question_type = ANY(${[...PLAYGROUND_ALLOWED_QUESTION_TYPES]})
          AND qb.topic = ANY(${topics})
          AND qb.deleted_at IS NULL
          AND (${qbScope})
          ORDER BY RANDOM()
          LIMIT ${questionCount || 10}
        `

        if (availableQuestions.length === 0) {
          await sql`DELETE FROM playground_sessions WHERE id = ${sessionIdNew}`
          return NextResponse.json(
            {
              error:
                "No MCQ or True/False questions in scope for this course and topics. Add questions to the question bank or switch course (LEGACY / 1301 / 1304 share a pool).",
            },
            { status: 400 },
          )
        }

        for (let i = 0; i < availableQuestions.length; i++) {
          await sql`
            INSERT INTO playground_questions (session_id, bank_question_id, question_order)
            VALUES (${sessionIdNew}, ${availableQuestions[i].id}, ${i + 1})
            ON CONFLICT (session_id, question_order) DO NOTHING
          `
        }
      } else {
        await sql`DELETE FROM playground_sessions WHERE id = ${sessionIdNew}`
        return NextResponse.json({ error: "Either topics or questionIds must be provided" }, { status: 400 })
      }

      return NextResponse.json({
        sessionId: sessionIdNew,
        sessionCode: newSession[0].session_code,
        joinPasscode: newSession[0].join_passcode,
        durationSec: newSession[0].duration_sec,
        topics: newSession[0].selected_topics,
        questionCount: newSession[0].question_count,
        createdAt: newSession[0].created_at,
        gameStarted: false,
      })
    } else if (action === "stop" && sessionId) {
      const stopped = await sql`
        UPDATE playground_sessions ps
        SET is_active = false, game_started = false, ended_at = CURRENT_TIMESTAMP
        WHERE ps.id = ${sessionId}
          AND (${psScope})
        ${termScope}
        RETURNING ps.id
      `
      if (stopped.length === 0) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
      }

      return NextResponse.json({ success: true, message: "Session stopped" })
    } else if (action === "update" && sessionId) {
      const owned = await sql`
        SELECT 1 FROM playground_sessions ps WHERE ps.id = ${sessionId} AND (${psScope}) ${termScope} LIMIT 1
      `
      if (owned.length === 0) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
      }

      const updates: string[] = []
      if (durationSec !== undefined) updates.push(`duration_sec = ${Number(durationSec)}`)
      if (topics !== undefined) updates.push(`selected_topics = ${JSON.stringify(topics)}::TEXT[]`)

      if (updates.length > 0) {
        await sql.unsafe(`
          UPDATE playground_sessions
          SET ${updates.join(", ")}
          WHERE id = ${Number(sessionId)}
        `)
      }

      return NextResponse.json({ success: true, message: "Session updated" })
    } else if (action === "set-all-sessions" && sessionId) {
      const updated = await sql`
        UPDATE playground_sessions ps
        SET allowed_sessions = NULL
        WHERE ps.id = ${sessionId}
          AND (${psScope})
        ${termScope}
        RETURNING ps.id
      `
      if (updated.length === 0) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
      }

      return NextResponse.json({ success: true, message: "Session now accessible by all sessions" })
    } else if (action === "open-lobby" || action === "reactivate") {
      if (!sessionId) {
        return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
      }

      const targetRows = await sql`
        SELECT ps.is_active, ps.game_started, ps.allowed_sessions
        FROM playground_sessions ps
        WHERE ps.id = ${sessionId}
          AND (${psScope})
          ${termScope}
        LIMIT 1
      `
      if (targetRows.length === 0) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
      }
      const target = targetRows[0] as {
        is_active: boolean
        game_started: boolean
        allowed_sessions: number[] | null
      }
      if (target.is_active && target.game_started) {
        return NextResponse.json(
          { error: "Cannot reopen lobby while students are still playing this session." },
          { status: 409 },
        )
      }

      const activationIds = await resolvePlaygroundActivationAllowedIds(request, target.allowed_sessions)
      const lobbyOverlapScope = sqlPlaygroundAllowedSessionsOverlapScope(activationIds)

      if (activationIds && activationIds.length > 0) {
        await sql`
        UPDATE playground_sessions ps
        SET is_active = false, game_started = false, ended_at = CURRENT_TIMESTAMP
        WHERE ps.mode = 'CLASSROOM' AND ps.is_active = true AND ps.game_started = false AND ps.id != ${sessionId}
          AND (${psScope})
          AND (${lobbyOverlapScope})
      `
      }

      const joinPasscode = await generateUniquePlaygroundPasscode()

      const cleared = await clearPlaygroundWaitingRoomAttempts(sessionId)

      if (cleared.deletedResults > 0 || cleared.deletedAnswers > 0) {
        await logPlaygroundDeleteAudit({
          source: "api:instructor/playground/sessions:open-lobby",
          actorId: scope.instructorId,
          actorType: "instructor",
          courseId: scope.course.id,
          sessionId,
          rowsBefore: cleared.rowsBefore,
          rowsDeleted: {
            answers: cleared.deletedAnswers,
            results: cleared.deletedResults,
          },
          metadata: {
            note: "cleared waiting-room rows only; completed attempts preserved",
            live_session: false,
          },
        })
      }

      const result = await sql`
        UPDATE playground_sessions ps
        SET
          is_active = true,
          game_started = false,
          ended_at = NULL,
          join_passcode = ${joinPasscode},
          lobby_opened_at = CURRENT_TIMESTAMP,
          game_started_at = NULL,
          current_question_index = 0
        WHERE ps.id = ${sessionId}
          AND (${psScope})
        ${termScope}
        RETURNING ps.id, ps.is_active, ps.join_passcode, ps.session_code
      `

      if (result.length === 0) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        message: "Lobby opened — share the passcode with students",
        session: result[0],
        joinPasscode: result[0].join_passcode,
      })
    } else if (action === "start-game") {
      if (!sessionId) {
        return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
      }

      const owned = await sql`
        SELECT ps.id, ps.is_active, ps.game_started
        FROM playground_sessions ps
        WHERE ps.id = ${sessionId}
          AND (${psScope})
        ${termScope}
        LIMIT 1
      `
      if (owned.length === 0) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
      }

      const target = owned[0] as { is_active: boolean; game_started: boolean }
      if (!target.is_active || target.game_started) {
        return NextResponse.json(
          { error: "Session not found, lobby is closed, or game already started" },
          { status: 400 },
        )
      }

      const started = await sql`
        UPDATE playground_sessions ps
        SET
          game_started = true,
          game_started_at = CURRENT_TIMESTAMP,
          current_question_index = 0
        WHERE ps.id = ${sessionId}
          AND ps.is_active = true
          AND ps.game_started = false
          AND (${psScope})
        ${termScope}
        RETURNING ps.id, ps.session_code, ps.join_passcode
      `

      if (started.length === 0) {
        return NextResponse.json(
          { error: "Session not found, lobby is closed, or game already started" },
          { status: 400 },
        )
      }

      await sql`
        UPDATE playground_results
        SET joined_at_question = 0
        WHERE session_id = ${sessionId}
          AND joined_at_question < 0
      `

      return NextResponse.json({
        success: true,
        message: "Game started",
        session: started[0],
        reset: {
          clearedAttempts: false,
          deletedResults: 0,
          deletedAnswers: 0,
        },
      })
    } else if (action === "reset-attempts" && sessionId) {
      const owned = await sql`
        SELECT ps.id, ps.is_active
        FROM playground_sessions ps
        WHERE ps.id = ${sessionId}
          AND (${psScope})
        ${termScope}
        LIMIT 1
      `
      if (owned.length === 0) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
      }

      const isActive = Boolean(owned[0]?.is_active)
      const cleared = await clearPlaygroundSessionAttempts(sessionId)
      if (cleared.remainingResults > 0) {
        return NextResponse.json(
          { error: "Reset incomplete — some attempt rows could not be removed." },
          { status: 500 },
        )
      }

      await logPlaygroundDeleteAudit({
        source: "api:instructor/playground/sessions:reset-attempts",
        actorId: scope.instructorId,
        actorType: "instructor",
        courseId: scope.course.id,
        sessionId,
        rowsBefore: cleared.rowsBefore,
        rowsDeleted: {
          answers: cleared.deletedAnswers,
          results: cleared.deletedResults,
        },
        metadata: { note: "instructor reset student attempts", live_session: isActive },
      })

      return NextResponse.json({
        success: true,
        message: "Session reset — scores, attempts, and leaderboard cleared. Students can join again.",
        deletedResults: cleared.deletedResults,
        deletedAnswers: cleared.deletedAnswers,
      })
    } else if (action === "delete" && sessionId) {
      const target = await sql`
        SELECT ps.id, ps.is_active
        FROM playground_sessions ps
        WHERE ps.id = ${sessionId}
          AND ps.mode = 'CLASSROOM'
          AND (${psScope})
        ${termScope}
        LIMIT 1
      `
      if (target.length === 0) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
      }
      if (target[0].is_active) {
        return NextResponse.json(
          { error: "Stop the session before deleting it" },
          { status: 400 },
        )
      }

      const rowsBefore = await countPlaygroundRows({ sessionId })
      const guard = checkPlaygroundStudentDataDeleteAllowed({
        bulk: false,
        confirmPhrase,
        studentResultRows: rowsBefore.results,
      })
      if (guard.blocked) return playgroundDeleteGuardResponse(guard)

      await sql`
        DELETE FROM playground_answers pa
        USING playground_results pr
        WHERE pa.result_id = pr.id AND pr.session_id = ${sessionId}
      `
      await sql`DELETE FROM playground_results WHERE session_id = ${sessionId}`
      await sql`DELETE FROM playground_questions WHERE session_id = ${sessionId}`
      await sql`DELETE FROM playground_sessions WHERE id = ${sessionId}`

      await logPlaygroundDeleteAudit({
        source: "api:instructor/playground/sessions:delete",
        actorId: scope.instructorId,
        actorType: "instructor",
        courseId: scope.course.id,
        sessionId,
        rowsBefore,
        rowsDeleted: {
          answers: rowsBefore.answers,
          results: rowsBefore.results,
          questions: rowsBefore.questions,
          sessions: 1,
        },
      })

      return NextResponse.json({ success: true, message: "Session deleted" })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("[instructor/playground/sessions]", error)
    const details = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        error: "Failed to manage session",
        ...(process.env.NODE_ENV !== "production" ? { details } : {}),
      },
      { status: 500 },
    )
  }
}
