import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  resolveStudentCourseContextByDbId,
  sqlQuizInStudentCourse,
} from "@/lib/student-course-scope"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"
import { getAttemptDisplayGradesBatch } from "@/lib/attempt-grade-display"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const maxDuration = 30

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    const auth = await requireStudentIdParamMatchesCaller(request, studentId)
    if (!auth.ok) return auth.response

    const studentDbId = auth.studentDbId

    const courseCtx = await resolveStudentCourseContextByDbId(studentDbId)
    const courseFilter =
      courseCtx?.courseId != null
        ? sqlQuizInStudentCourse("q", courseCtx.courseId)
        : sql.unsafe("(TRUE)")

    const attempts = await sql`
      SELECT 
        qa.id as attempt_id,
        qa.quiz_id,
        qa.score,
        qa.total_questions,
        qa.started_at,
        qa.completed_at,
        qa.attempt_number,
        COALESCE(qa.is_final_grade, true) as is_final_grade,
        q.title as quiz_title,
        q.retake_enabled,
        q.retake_limit,
        q.retake_policy,
        COALESCE(
          (SELECT COUNT(*) FROM quiz_answers qa3 WHERE qa3.attempt_id = qa.id AND qa3.is_correct = true),
          0
        ) as correct_answers
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.student_id = ${studentDbId}
        AND qa.deleted_at IS NULL
        AND ${courseFilter}
      ORDER BY qa.completed_at DESC NULLS LAST, qa.started_at DESC
    `

    const attemptIds = (attempts as { attempt_id: number }[]).map((a) => Number(a.attempt_id))
    const displayGrades = await getAttemptDisplayGradesBatch(attemptIds)

    const quizMap = new Map<
      number,
      {
        quiz_id: number
        quiz_title: string
        retake_enabled: boolean
        retake_limit: number | null
        retake_policy: string
        attempts: Array<{
          attempt_id: number
          attempt_number: number
          score: number
          total_questions: number
          correct_answers: number
          percentage: number
          started_at: string
          completed_at: string
          is_final_grade: boolean
        }>
      }
    >()

    for (const attempt of attempts as Array<Record<string, unknown>>) {
      const quizId = Number(attempt.quiz_id)
      const attemptId = Number(attempt.attempt_id)
      const grade = displayGrades.get(attemptId)

      if (!quizMap.has(quizId)) {
        quizMap.set(quizId, {
          quiz_id: quizId,
          quiz_title: String(attempt.quiz_title ?? ""),
          retake_enabled: Boolean(attempt.retake_enabled),
          retake_limit: attempt.retake_limit as number | null,
          retake_policy: String(attempt.retake_policy ?? ""),
          attempts: [],
        })
      }

      quizMap.get(quizId)!.attempts.push({
        attempt_id: attemptId,
        attempt_number: Number(attempt.attempt_number ?? 1),
        score: grade?.score ?? Number(attempt.score ?? 0),
        total_questions: grade?.totalPoints ?? Number(attempt.total_questions ?? 0),
        correct_answers: Number(attempt.correct_answers ?? 0),
        percentage: grade?.percentage ?? 0,
        started_at: String(attempt.started_at ?? ""),
        completed_at: String(attempt.completed_at ?? ""),
        is_final_grade: Boolean(attempt.is_final_grade ?? true),
      })
    }

    const quizHistory = Array.from(quizMap.values())

    return NextResponse.json({
      quizHistory,
      metadata: {
        totalQuizzes: quizHistory.length,
        totalAttempts: attempts.length,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("[v0] Failed to fetch quiz history:", error)
    return NextResponse.json({ error: "Failed to fetch quiz history" }, { status: 500 })
  }
}
