import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { isLectureAccessibleToStudent } from "@/lib/student-lecture-access"
import { requireStudentLectureCaller } from "@/lib/require-student-lecture-auth"
import {
  parseLectureSamplePractice,
  stripSamplePracticeAnswers,
  evaluateSamplePracticeQuestion,
} from "@/lib/lecture-sample-practice"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const lectureId = Number.parseInt(id, 10)
    if (!Number.isFinite(lectureId)) {
      return NextResponse.json({ error: "Invalid lecture id" }, { status: 400 })
    }

    const auth = await requireStudentLectureCaller(
      request,
      request.nextUrl.searchParams.get("studentId"),
    )
    if (!auth.ok) return auth.response

    const allowed = await isLectureAccessibleToStudent(auth.sessionRow.student_id, lectureId)
    if (!allowed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const studentDbId = auth.studentDbId

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
    if (!config.enabled || config.questions.length === 0) {
      return NextResponse.json({ enabled: false, questions: [] })
    }

    const sanitized = stripSamplePracticeAnswers(config)

    const savedAttempts: Array<{
      question_id: string
      is_correct: boolean
      score_percentage: number
      student_answer: unknown
      completed_at: string
      result?: ReturnType<typeof evaluateSamplePracticeQuestion>
    }> = []
    if (studentDbId != null) {
      try {
        const attemptRows = await sql`
          SELECT question_id, is_correct, score_percentage, student_answer, completed_at
          FROM lecture_sample_practice_attempts
          WHERE student_id = ${studentDbId}
            AND lecture_id = ${lectureId}
        `
        for (const row of attemptRows as Array<{
          question_id: string
          is_correct: boolean
          score_percentage: number
          student_answer: unknown
          completed_at: string
        }>) {
          const question = config.questions.find((q) => q.id === row.question_id)
          let storedAnswer: unknown = row.student_answer
          if (typeof storedAnswer === "string") {
            try {
              storedAnswer = JSON.parse(storedAnswer)
            } catch {
              /* keep string */
            }
          }
          savedAttempts.push({
            ...row,
            result: question ? evaluateSamplePracticeQuestion(question, storedAnswer) : undefined,
          })
        }
      } catch (error: unknown) {
        const code = (error as { code?: string })?.code
        if (code !== "42P01" && code !== "42703") throw error
      }
    }

    return NextResponse.json({
      enabled: true,
      button_label: sanitized.button_label,
      questions: sanitized.questions,
      attempts: savedAttempts,
    })
  } catch (error) {
    console.error("[Student lecture sample practice GET]", error)
    return NextResponse.json({ error: "Failed to load sample practice" }, { status: 500 })
  }
}
