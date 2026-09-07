import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { isBetaUser } from "@/lib/membership"
import { NOW_UTC } from "@/lib/central-time"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"
import { getAttemptDisplayGradesBatch } from "@/lib/attempt-grade-display"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionParam = searchParams.get("session")
    const studentId =
      searchParams.get("studentDatabaseId") ?? searchParams.get("studentId")
    const typeFilter = searchParams.get("type")

    if (!sessionParam) {
      return NextResponse.json({ error: "Session parameter is required" }, { status: 400 })
    }

    if (!studentId) {
      return NextResponse.json({ error: "Student ID parameter is required" }, { status: 401 })
    }

    const auth = await requireStudentIdParamMatchesCaller(request, studentId)
    if (!auth.ok) return auth.response

    const internalStudentId = auth.studentDbId

    const studentLookup = await sql`
      SELECT id, session_id FROM students WHERE id = ${internalStudentId}
    `

    if (studentLookup.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const studentSessionId = studentLookup[0].session_id

    if (!studentSessionId) {
      return NextResponse.json({ error: "Student session not found" }, { status: 404 })
    }

    const isBeta = await isBetaUser(internalStudentId)

    const rows = await sql`
      SELECT 
        q.id,
        q.title,
        q.description,
        q.time_per_question,
        q.available_from,
        q.available_until,
        q.retake_limit,
        q.assessment_type,
        q.created_at,
        q.updated_at,
        qa.id as attempt_id,
        qa.started_at,
        qa.completed_at,
        qa.score,
        qa.total_questions as attempt_questions,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM quiz_attempts qa2 
            WHERE qa2.quiz_id = q.id AND qa2.student_id = ${internalStudentId} 
            AND qa2.completed_at IS NOT NULL AND qa2.deleted_at IS NULL
          ) THEN 'completed'
          WHEN ${isBeta} = false AND q.available_until IS NOT NULL AND q.available_until <= ${NOW_UTC()} THEN 'overdue'
          ELSE 'pending'
        END as status,
        COALESCE(
          (SELECT COUNT(*) FROM quiz_answers qa3 WHERE qa3.attempt_id = qa.id AND qa3.is_correct = true),
          0
        ) as correct_answers
      FROM quizzes q
      LEFT JOIN quiz_session_access qsa ON q.id = qsa.quiz_id AND qsa.session_id = ${studentSessionId} AND qsa.is_active = true
      LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.student_id = ${internalStudentId} AND qa.deleted_at IS NULL
      WHERE q.deleted_at IS NULL
      AND qsa.id IS NOT NULL
      AND LOWER(TRIM(q.assessment_type::text)) IN ('quiz', 'homework', 'mid_semester', 'midsem', 'final')
      ORDER BY q.available_until DESC NULLS LAST, qa.started_at DESC NULLS LAST
    `

    const attemptIds = (rows as { attempt_id: number | null }[])
      .map((row) => row.attempt_id)
      .filter((id): id is number => id != null)
    const displayGrades = await getAttemptDisplayGradesBatch(attemptIds)

    const groupedHistory = (rows as Array<Record<string, unknown>>).reduce(
      (acc: Record<number, Record<string, unknown>>, row) => {
        const id = row.id as number
        if (!acc[id]) {
          acc[id] = {
            id,
            title: row.title,
            description: row.description,
            time_per_question: row.time_per_question,
            available_from: row.available_from,
            available_until: row.available_until,
            retake_limit: row.retake_limit,
            assessment_type: row.assessment_type,
            created_at: row.created_at,
            updated_at: row.updated_at,
            status: row.status,
            attempts: [] as Array<Record<string, unknown>>,
          }
        }

        if (row.attempt_id) {
          const attemptId = Number(row.attempt_id)
          const grade = displayGrades.get(attemptId)
          ;(acc[id].attempts as Array<Record<string, unknown>>).push({
            id: attemptId,
            started_at: row.started_at,
            completed_at: row.completed_at,
            is_completed: row.completed_at !== null,
            score: grade?.score ?? Number(row.score ?? 0),
            total_questions: grade?.totalPoints ?? Number(row.attempt_questions ?? 0),
            correct_answers: row.correct_answers || 0,
            percentage: grade?.percentage ?? 0,
          })
        }

        return acc
      },
      {},
    )

    let historyArray = Object.values(groupedHistory)

    if (typeFilter) {
      const normalizedFilter = typeFilter.toLowerCase().replace(/-/g, "_")
      historyArray = historyArray.filter((item) => {
        const t = String(item.assessment_type ?? "").toLowerCase().replace(/-/g, "_")
        if (normalizedFilter === "mid_semester") return t === "mid_semester" || t === "midsem"
        return t === normalizedFilter
      })
    }

    return NextResponse.json({
      success: true,
      assessmentHistory: historyArray,
      stats: {
        total: historyArray.length,
        completed: historyArray.filter((h) => h.status === "completed").length,
        pending: historyArray.filter((h) => h.status === "pending").length,
        overdue: historyArray.filter((h) => h.status === "overdue").length,
      },
    })
  } catch (error) {
    console.error("[v0] Error fetching assessment history:", error)
    return NextResponse.json({ error: "Failed to fetch assessment history" }, { status: 500 })
  }
}
