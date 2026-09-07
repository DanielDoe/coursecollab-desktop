import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { assertQuizAccessibleInCourse } from "@/lib/quiz-course-access"
import { serializeQuestionMediaAndCircuitSpec } from "@/lib/question-media-persist"

export const dynamic = "force-dynamic"

/** Persist diagram media for one quiz question without a full assessment save. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> },
) {
  try {
    const { id, questionId } = await params
    const quizId = Number(id)
    const qid = Number(questionId)
    if (!Number.isFinite(quizId) || !Number.isFinite(qid)) {
      return NextResponse.json({ error: "Invalid quiz or question id" }, { status: 400 })
    }

    const access = await assertQuizAccessibleInCourse(request, quizId)
    if (!access.ok) return access.response

    const body = (await request.json()) as { question_media?: unknown; question_type?: string | null }
    const rows = (await sql`
      SELECT id, question_type, circuit_spec
      FROM quiz_questions
      WHERE id = ${qid} AND quiz_id = ${quizId}
      LIMIT 1
    `) as Array<{ id: number; question_type: string | null; circuit_spec: unknown }>

    if (rows.length === 0) {
      return NextResponse.json({ error: "Question not found on this assessment" }, { status: 404 })
    }

    const row = rows[0]
    const { questionMediaJson, circuitSpecJson } = serializeQuestionMediaAndCircuitSpec({
      question_media: body.question_media,
      circuit_spec: row.circuit_spec,
      question_type: body.question_type ?? row.question_type,
    })

    await sql`
      UPDATE quiz_questions
      SET
        question_media = ${questionMediaJson === null ? null : questionMediaJson}::jsonb,
        circuit_spec = ${circuitSpecJson === null ? null : circuitSpecJson}::jsonb
      WHERE id = ${qid} AND quiz_id = ${quizId}
    `

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[quiz-question-media PATCH]", e)
    return NextResponse.json({ error: "Failed to save question media" }, { status: 500 })
  }
}
