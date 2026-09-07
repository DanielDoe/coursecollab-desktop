import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { isLectureAccessibleToStudent } from "@/lib/student-lecture-access"
import { requireStudentLectureCaller } from "@/lib/require-student-lecture-auth"
import {
  evaluateSamplePracticeQuestion,
  parseLectureSamplePractice,
} from "@/lib/lecture-sample-practice"
import {
  getSamplePracticeAttempt,
  recordSamplePracticeAttempt,
} from "@/lib/lecture-sample-practice-engagement"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const lectureId = Number.parseInt(id, 10)
    if (!Number.isFinite(lectureId)) {
      return NextResponse.json({ error: "Invalid lecture id" }, { status: 400 })
    }

    const body = (await request.json()) as {
      studentId?: string
      questionId?: string
      answer?: unknown
    }

    const questionId = body.questionId?.trim()
    const auth = await requireStudentLectureCaller(request, body.studentId ?? null)
    if (!auth.ok) return auth.response
    if (!questionId) {
      return NextResponse.json({ error: "studentId and questionId are required" }, { status: 400 })
    }

    const allowed = await isLectureAccessibleToStudent(auth.sessionRow.student_id, lectureId)
    if (!allowed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const rows = await sql`
      SELECT sample_practice
      FROM lectures
      WHERE id = ${lectureId}
        AND deleted_at IS NULL
      LIMIT 1
    `
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const config = parseLectureSamplePractice(rows[0].sample_practice)
    if (!config.enabled) {
      return NextResponse.json({ error: "Sample practice is not enabled" }, { status: 400 })
    }

    const question = config.questions.find((q) => q.id === questionId)
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    const existing = await getSamplePracticeAttempt(auth.studentDbId, lectureId, questionId)
    if (existing) {
      let storedAnswer: unknown = existing.student_answer
      if (typeof storedAnswer === "string") {
        try {
          storedAnswer = JSON.parse(storedAnswer)
        } catch {
          /* keep string */
        }
      }
      const result = evaluateSamplePracticeQuestion(question, storedAnswer)
      return NextResponse.json({
        result,
        engagement: { recorded: true, pointsSynced: false, locked: true },
      })
    }

    const result = evaluateSamplePracticeQuestion(question, body.answer)

    const sessionRow = auth.sessionRow
    let engagement: { recorded: boolean; pointsSynced: boolean; locked?: boolean } | null = null
    if (sessionRow) {
      const scorePct = Math.round(result.mcq_earned_fraction * 100)
      try {
        engagement = await recordSamplePracticeAttempt({
          studentDbId: auth.studentDbId,
          sessionCode: sessionRow.session_code || sessionRow.section || "ALL",
          lectureId,
          questionId,
          scorePercentage: scorePct,
          isCorrect: result.is_mcq_correct,
          studentAnswer: body.answer,
        })
      } catch (recordError) {
        console.warn("[Student lecture sample practice evaluate] record failed", recordError)
        engagement = { recorded: false, pointsSynced: false }
      }
    }

    return NextResponse.json({ result, engagement })
  } catch (error) {
    console.error("[Student lecture sample practice evaluate]", error)
    return NextResponse.json({ error: "Failed to evaluate answer" }, { status: 500 })
  }
}
