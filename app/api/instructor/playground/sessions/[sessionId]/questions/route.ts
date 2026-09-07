import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  buildInstructorOwnedCourseScopeSqlFragment,
  resolvePlaygroundClassroomInstructorScopeSql,
} from "@/lib/instructor-default-courses"
import { sqlPlaygroundTermScope } from "@/lib/playground-instructor-scope"
import { PLAYGROUND_ALLOWED_QUESTION_TYPES } from "@/lib/playground-question-utils"
import {
  displayPlaygroundSessionQuestion,
  ensurePlaygroundQuestionSnapshotColumns,
  indexPlaygroundSnapshotsByBankId,
  mergePlaygroundQuestionSnapshot,
  snapshotFromStoredRow,
} from "@/lib/playground-session-question-snapshot"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ sessionId: string }> }

async function assertSessionOwned(
  sessionId: number,
  psScope: ReturnType<typeof sql>,
  termScope: ReturnType<typeof sql>,
) {
  const rows = await sql`
    SELECT ps.id, ps.is_active, ps.game_started, ps.duration_sec, ps.question_count, ps.selected_topics, ps.session_code
    FROM playground_sessions ps
    WHERE ps.id = ${sessionId}
      AND ps.mode = 'CLASSROOM'
      AND (${psScope})
      ${termScope}
    LIMIT 1
  `
  return rows.length > 0 ? (rows[0] as {
    id: number
    is_active: boolean
    game_started: boolean
    duration_sec: number
    question_count: number
    selected_topics: string[] | null
    session_code: string
  }) : null
}

/**
 * GET - List questions linked to a playground session
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const { sessionId: sessionIdRaw } = await context.params
    const sessionId = parseInt(sessionIdRaw, 10)
    if (!Number.isFinite(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 })
    }

    const psScope = await resolvePlaygroundClassroomInstructorScopeSql(
      "ps",
      scope.course.id,
      scope.instructorId,
      scope.course.course_code,
    )
    const termScope = await sqlPlaygroundTermScope(request)

    const session = await assertSessionOwned(sessionId, psScope, termScope)
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    await ensurePlaygroundQuestionSnapshotColumns()

    const rows = await sql`
      SELECT
        pq.id,
        pq.question_order,
        pq.bank_question_id,
        qb.question_text,
        qb.question_type,
        qb.difficulty,
        qb.topic,
        qb.options,
        qb.correct_answer,
        qb.explanation,
        pq.snapshot_question_text,
        pq.snapshot_question_type,
        pq.snapshot_difficulty,
        pq.snapshot_topic,
        pq.snapshot_options,
        pq.snapshot_correct_answer,
        pq.snapshot_explanation
      FROM playground_questions pq
      JOIN question_bank qb ON pq.bank_question_id = qb.id
      WHERE pq.session_id = ${sessionId}
        AND qb.question_type = ANY(${[...PLAYGROUND_ALLOWED_QUESTION_TYPES]})
      ORDER BY pq.question_order ASC
    `

    const questions = rows.map((q: Record<string, unknown>) => {
      const displayed = displayPlaygroundSessionQuestion(q)
      return {
        id: q.id,
        bankQuestionId: q.bank_question_id,
        questionOrder: q.question_order,
        ...displayed,
      }
    })

    return NextResponse.json({
      session: {
        id: session.id,
        sessionCode: session.session_code,
        isActive: session.is_active,
        durationSec: session.duration_sec,
        questionCount: session.question_count,
        selectedTopics: session.selected_topics,
      },
      questions,
    })
  } catch {
    return NextResponse.json({ error: "Failed to fetch session questions" }, { status: 500 })
  }
}

/**
 * PUT - Replace session question list and optionally update duration
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const { sessionId: sessionIdRaw } = await context.params
    const sessionId = parseInt(sessionIdRaw, 10)
    if (!Number.isFinite(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 })
    }

    const { questionIds, durationSec, questions } = await request.json()

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return NextResponse.json({ error: "At least one question is required" }, { status: 400 })
    }
    if (questionIds.length > 50) {
      return NextResponse.json({ error: "Maximum 50 questions per session" }, { status: 400 })
    }

    const psScope = await resolvePlaygroundClassroomInstructorScopeSql(
      "ps",
      scope.course.id,
      scope.instructorId,
      scope.course.course_code,
    )
    const termScope = await sqlPlaygroundTermScope(request)
    const qbScope = buildInstructorOwnedCourseScopeSqlFragment(
      "question_bank",
      "course_id",
      scope.course.id,
      scope.instructorId,
    )

    const session = await assertSessionOwned(sessionId, psScope, termScope)
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }
    if (session.game_started) {
      return NextResponse.json(
        { error: "End the live game before editing its questions" },
        { status: 400 },
      )
    }

    const uniqueIds = [...new Set(questionIds.map((id: unknown) => Number(id)).filter(Number.isFinite))]
    if (uniqueIds.length !== questionIds.length) {
      return NextResponse.json({ error: "Duplicate question IDs are not allowed" }, { status: 400 })
    }

    const allowed = await sql`
      SELECT qb.id
      FROM question_bank qb
      WHERE qb.id = ANY(${uniqueIds})
        AND qb.deleted_at IS NULL
        AND qb.question_type = ANY(${[...PLAYGROUND_ALLOWED_QUESTION_TYPES]})
        AND (${qbScope})
    `
    if (allowed.length !== uniqueIds.length) {
      return NextResponse.json(
        { error: "One or more questions are unavailable for this course" },
        { status: 400 },
      )
    }

    const nextDuration =
      durationSec !== undefined ? Math.min(60, Math.max(5, Number(durationSec))) : session.duration_sec

    await ensurePlaygroundQuestionSnapshotColumns()

    const incomingSnapshots = indexPlaygroundSnapshotsByBankId(questions)
    const storedRows = (await sql`
      SELECT
        bank_question_id,
        snapshot_question_text,
        snapshot_question_type,
        snapshot_difficulty,
        snapshot_topic,
        snapshot_options,
        snapshot_correct_answer,
        snapshot_explanation
      FROM playground_questions
      WHERE session_id = ${sessionId}
    `) as Record<string, unknown>[]
    const existingSnapshots = new Map(
      storedRows
        .map((row) => snapshotFromStoredRow(row))
        .filter((snapshot): snapshot is NonNullable<typeof snapshot> => snapshot != null)
        .map((snapshot) => [snapshot.bankQuestionId, snapshot]),
    )

    await sql`DELETE FROM playground_questions WHERE session_id = ${sessionId}`

    for (let i = 0; i < uniqueIds.length; i++) {
      const bankQuestionId = uniqueIds[i]
      const snapshot = mergePlaygroundQuestionSnapshot(
        incomingSnapshots.get(bankQuestionId),
        existingSnapshots.get(bankQuestionId),
      )
      await sql`
        INSERT INTO playground_questions (
          session_id,
          bank_question_id,
          question_order,
          snapshot_question_text,
          snapshot_question_type,
          snapshot_difficulty,
          snapshot_topic,
          snapshot_options,
          snapshot_correct_answer,
          snapshot_explanation
        )
        VALUES (
          ${sessionId},
          ${bankQuestionId},
          ${i + 1},
          ${snapshot?.questionText ?? null},
          ${snapshot?.questionType ?? null},
          ${snapshot?.difficulty ?? null},
          ${snapshot?.topic ?? null},
          ${snapshot?.options ? JSON.stringify(snapshot.options) : null}::jsonb,
          ${snapshot?.correctAnswer ?? null},
          ${snapshot?.explanation ?? null}
        )
      `
    }

    await sql`
      UPDATE playground_sessions
      SET question_count = ${uniqueIds.length},
          duration_sec = ${nextDuration},
          current_question_index = LEAST(current_question_index, GREATEST(${uniqueIds.length} - 1, 0))
      WHERE id = ${sessionId}
    `

    return NextResponse.json({
      success: true,
      questionCount: uniqueIds.length,
      durationSec: nextDuration,
    })
  } catch (error) {
    console.error("[playground/sessions/questions PUT]", error)
    return NextResponse.json({ error: "Failed to update session questions" }, { status: 500 })
  }
}
