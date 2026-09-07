import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  claimedStudentIdFromPlaygroundRequest,
  requirePlaygroundStudentOrInstructor,
} from "@/lib/playground-request-auth"
import {
  getPlaygroundSessionById,
  isClassroomSessionEnded,
  PLAYGROUND_SESSION_ENDED_MESSAGE,
} from "@/lib/playground-session-guard"
import {
  PLAYGROUND_ALLOWED_QUESTION_TYPES,
} from "@/lib/playground-question-utils"
import {
  displayPlaygroundSessionQuestion,
  ensurePlaygroundQuestionSnapshotColumns,
} from "@/lib/playground-session-question-snapshot"

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

    if (access.role === "student") {
      const joined = await sql`
        SELECT 1
        FROM playground_results pr
        JOIN students s ON s.student_id = pr.student_id AND s.deleted_at IS NULL
        WHERE pr.session_id = ${Number(sessionId)}
          AND s.id = ${access.studentDbId}
        LIMIT 1
      `
      if (joined.length === 0) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }
    }

    const session = await getPlaygroundSessionById(Number(sessionId))
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }
    if (isClassroomSessionEnded(session)) {
      return NextResponse.json(
        { error: PLAYGROUND_SESSION_ENDED_MESSAGE, sessionEnded: true },
        { status: 403 },
      )
    }

    await ensurePlaygroundQuestionSnapshotColumns()

    const questions = await sql`
      SELECT 
        pq.id as playground_question_id,
        pq.question_order,
        qb.id as bank_question_id,
        qb.question_text,
        qb.question_type,
        qb.hint,
        qb.difficulty,
        qb.topic,
        qb.options,
        qb.correct_answer,
        pq.snapshot_question_text,
        pq.snapshot_question_type,
        pq.snapshot_difficulty,
        pq.snapshot_topic,
        pq.snapshot_options,
        pq.snapshot_correct_answer
      FROM playground_questions pq
      JOIN question_bank qb ON pq.bank_question_id = qb.id
      WHERE pq.session_id = ${sessionId}
        AND qb.question_type = ANY(${[...PLAYGROUND_ALLOWED_QUESTION_TYPES]})
      ORDER BY pq.question_order ASC
    `

    const formattedQuestions = questions.map((q: Record<string, unknown>) => {
      const displayed = displayPlaygroundSessionQuestion(q)
      return {
        id: q.playground_question_id,
        bankQuestionId: q.bank_question_id,
        questionText: displayed.questionText,
        questionType: displayed.questionType.toUpperCase(),
        options: displayed.options,
        hint: q.hint,
        difficulty: displayed.difficulty,
        topic: displayed.topic,
      }
    })

    return NextResponse.json({ questions: formattedQuestions })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 })
  }
}
