import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { ensureQuizSessionTaVisibleColumn } from "@/lib/ensure-quiz-session-ta-visible"
import { loadQuizAccessActor, sqlQuizVisibleInCourse } from "@/lib/quiz-course-access"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }
    const { instructorId, course } = scope
    const courseId = course.id

    const accessActor = await loadQuizAccessActor(instructorId, course)
    if (!accessActor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { actor, courseOwnerId } = accessActor

    const { searchParams } = new URL(request.url)
    const savedOnly = searchParams.get("saved") === "true"
    const rawType = searchParams.get("assessment_type") || searchParams.get("assessmentType")
    const assessmentType =
      rawType === "midsem"
        ? "mid_semester"
        : rawType === "finals"
          ? "final"
          : rawType

    const assessmentTypeFilter = !assessmentType
      ? ""
      : assessmentType === "quiz"
        ? " AND (q.assessment_type = 'quiz' OR q.assessment_type IS NULL)"
        : ` AND q.assessment_type = '${String(assessmentType).replace(/'/g, "''")}'`

    let quizResults
    if (savedOnly) {
      quizResults = await sql`
        SELECT 
          q.id,
          q.title,
          q.assessment_type,
          q.description,
          q.is_public,
          q.time_per_question,
          q.created_at,
          q.is_saved,
          q.available_from,
          q.available_until,
          COUNT(DISTINCT qq.id) as question_count,
          COUNT(DISTINCT qa.id) as total_attempts,
          COUNT(DISTINCT CASE 
            WHEN qa.student_id IS NOT NULL 
            AND NOT EXISTS (
              SELECT 1 FROM quiz_attempts qa2 
              WHERE qa2.quiz_id = q.id 
              AND qa2.student_id = qa.student_id 
              AND qa2.is_final_grade = true
            )
            THEN qa.student_id 
          END) as unfinalized_count
        FROM quizzes q
        LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
        LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.completed_at IS NOT NULL
        WHERE q.deleted_at IS NULL
        AND q.is_saved = true
        AND ${sqlQuizVisibleInCourse("q", actor, instructorId, courseOwnerId, courseId)}
        ${sql.unsafe(assessmentTypeFilter)}
        GROUP BY q.id, q.title, q.assessment_type, q.description, q.is_public, q.time_per_question, q.created_at, q.is_saved, q.available_from, q.available_until
        ORDER BY q.created_at DESC
      `
    } else {
      quizResults = await sql`
        SELECT 
          q.id,
          q.title,
          q.assessment_type,
          q.description,
          q.is_public,
          q.time_per_question,
          q.created_at,
          q.is_saved,
          q.available_from,
          q.available_until,
          COUNT(DISTINCT qq.id) as question_count,
          COUNT(DISTINCT qa.id) as total_attempts,
          COUNT(DISTINCT CASE 
            WHEN qa.student_id IS NOT NULL 
            AND NOT EXISTS (
              SELECT 1 FROM quiz_attempts qa2 
              WHERE qa2.quiz_id = q.id 
              AND qa2.student_id = qa.student_id 
              AND qa2.is_final_grade = true
            )
            THEN qa.student_id 
          END) as unfinalized_count
        FROM quizzes q
        LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
        LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.completed_at IS NOT NULL
        WHERE q.deleted_at IS NULL
        AND ${sqlQuizVisibleInCourse("q", actor, instructorId, courseOwnerId, courseId)}
        ${sql.unsafe(assessmentTypeFilter)}
        GROUP BY q.id, q.title, q.assessment_type, q.description, q.is_public, q.time_per_question, q.created_at, q.is_saved, q.available_from, q.available_until
        ORDER BY q.created_at DESC
      `
    }

    await ensureQuizSessionTaVisibleColumn()
    const isTaViewer = actor.role === "ta"

    const quizIds = quizResults.map((q: { id: number }) => q.id)
    const sessionAccessByQuiz: Record<number, { code: string; is_active: boolean; ta_visible: boolean }[]> = {}
    if (quizIds.length > 0) {
      const allSessionAccess = await sql`
        SELECT qsa.quiz_id, s.code, qsa.is_active, qsa.ta_visible
        FROM quiz_session_access qsa
        JOIN sessions s ON qsa.session_id = s.id
        WHERE qsa.quiz_id = ANY(${quizIds}::int[])
      `
      for (const row of allSessionAccess as {
        quiz_id: number
        code: string
        is_active: boolean
        ta_visible: boolean
      }[]) {
        if (!sessionAccessByQuiz[row.quiz_id]) sessionAccessByQuiz[row.quiz_id] = []
        sessionAccessByQuiz[row.quiz_id].push({
          code: row.code,
          is_active: row.is_active,
          ta_visible: row.ta_visible,
        })
      }
    }

    const now = new Date()
    const quizzesWithAccess = quizResults.map((quiz: Record<string, unknown>) => {
      const qid = quiz.id as number
      const rows = sessionAccessByQuiz[qid] || []
      const sessionAccessObj = rows.reduce(
        (acc, r) => {
          acc[r.code] = Boolean(acc[r.code]) || Boolean(r.is_active)
          return acc
        },
        {} as Record<string, boolean>,
      )
      const taSessionAccessObj = rows.reduce(
        (acc, r) => {
          acc[r.code] = r.ta_visible
          return acc
        },
        {} as Record<string, boolean>,
      )
      const taContentVisible = rows.some((r) => r.ta_visible)
      const availableFrom = quiz.available_from ? new Date(quiz.available_from as string) : null
      const availableUntil = quiz.available_until ? new Date(quiz.available_until as string) : null
      const availableFromOk = !availableFrom || availableFrom.getTime() <= now.getTime()
      const availableUntilOk = !availableUntil || availableUntil.getTime() >= now.getTime()
      const hasActiveSession = rows.some((r) => r.is_active)
      const is_active = hasActiveSession && availableFromOk && availableUntilOk && quiz.is_public
      return {
        ...quiz,
        session_access: sessionAccessObj,
        ta_session_access: taSessionAccessObj,
        ta_content_visible: taContentVisible,
        ta_content_restricted: isTaViewer && !taContentVisible,
        is_active,
      }
    })

    return NextResponse.json({ quizzes: quizzesWithAccess })
  } catch (error) {
    console.error("[v0] Failed to fetch quizzes:", error)
    return NextResponse.json({ error: "Failed to fetch quizzes", quizzes: [] }, { status: 500 })
  }
}
