import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { bypassesAssessmentAvailabilityWindows, isBetaUser } from "@/lib/membership"
import { NOW_UTC } from "@/lib/central-time"
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id"
import { getQuizIdsWithDeadlineExtensionForStudent } from "@/lib/deadline-extension"
import { getAttemptDisplayGradesBatch } from "@/lib/attempt-grade-display"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import { isPreCourseStudent } from "@/lib/student-course-access-gate"



export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    const auth = await requireBoundStudentCaller(request, studentId)
    if (!auth.ok) return auth.response

    const resolvedId = await resolveStudentDatabaseIdFromParam(studentId.trim())
    if (resolvedId == null) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const studentResult = await sql`
      SELECT
        s.id,
        s.section,
        COALESCE(sess.id, (SELECT id FROM sessions WHERE code = s.section LIMIT 1)) as session_id,
        COALESCE(sess.code, s.section) as session_code
      FROM students s
      LEFT JOIN sessions sess ON s.session_id = sess.id
      WHERE s.id = ${resolvedId}
      LIMIT 1
    `

    if (studentResult.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const student = studentResult[0]
    const studentDatabaseId = student.id

    if (await isPreCourseStudent(studentDatabaseId)) {
      return NextResponse.json({ midSemesters: [], pre_course: true })
    }

    if (!student.session_id) {
      return NextResponse.json({ error: "Student session not found" }, { status: 404 })
    }

    const scheduleBypass = await bypassesAssessmentAvailabilityWindows(studentDatabaseId)

    const midSemesters = await sql`
      SELECT 
        q.id,
        q.title,
        q.description,
        q.time_per_question,
        q.coverage,
        q.created_by,
        q.available_from,
        q.available_until,
        q.retake_enabled,
        q.retake_limit,
        COUNT(qq.id) as question_count,
        qsa.is_active as session_active,
        CASE 
          WHEN qsa.is_active = true 
            AND (
              ${scheduleBypass} = true
              OR (q.available_from IS NULL OR q.available_from <= ${NOW_UTC()})
            )
            AND (
              ${scheduleBypass} = true
              OR (q.available_until IS NULL OR q.available_until >= ${NOW_UTC()})
            )
          THEN true
          ELSE false
        END as is_active,
        COALESCE(
          SUM(COALESCE(qq.time_limit, q.time_per_question)),
          q.time_per_question * COUNT(qq.id)
        ) as total_duration
      FROM quizzes q
      LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
      LEFT JOIN quiz_session_access qsa ON q.id = qsa.quiz_id AND qsa.session_id = ${student.session_id}
      WHERE qsa.id IS NOT NULL
        AND qsa.is_active = true
        AND q.assessment_type = 'mid_semester'
        AND q.deleted_at IS NULL
        AND (
          (NOT COALESCE(q.restrict_access_to_students, false))
          OR (COALESCE(q.allowed_student_ids, '[]'::jsonb) @> to_jsonb(${studentDatabaseId}::integer))
        )
      GROUP BY q.id, q.title, q.description, q.time_per_question, q.coverage, q.created_by, q.available_from, q.available_until, q.retake_enabled, q.retake_limit, qsa.is_active
      ORDER BY q.created_at DESC
    `

    const attempts = await sql`
      SELECT 
        id as attempt_id, 
        quiz_id as mid_semester_id, 
        score, 
        total_questions,
        completed_at,
        attempt_number,
        has_viewed_report,
        is_final_grade
      FROM quiz_attempts
      WHERE student_id = ${studentDatabaseId}
        AND deleted_at IS NULL
        AND quiz_id IN (SELECT id FROM quizzes WHERE assessment_type = 'mid_semester')
      ORDER BY attempt_number DESC, id DESC
    `

    // Use canRetakeAssessment to properly respect student donation/membership benefits
    const { canRetakeAssessment } = await import("@/lib/retake-utils")

    const extensionQuizIds = await getQuizIdsWithDeadlineExtensionForStudent(
      studentDatabaseId,
      (midSemesters as { id: number }[]).map((e) => e.id)
    )
    
    const midSemestersWithAttempts = await Promise.all(
      midSemesters.map(async (exam) => {
        const examAttempts = attempts.filter((a) => a.mid_semester_id === exam.id)
        const completedAttempts = examAttempts
          .filter((a) => a.completed_at)
          .sort(
            (a, b) =>
              (b.attempt_number || 0) - (a.attempt_number || 0) ||
              (b.attempt_id || 0) - (a.attempt_id || 0),
          )
        const latestCompletedAttempt = completedAttempts[0] ?? null
        const latestAttempt = examAttempts[0]

        const isCompleted = completedAttempts.length > 0

        const hasDeadlineExtension = extensionQuizIds.has(exam.id)
        // Calendar is_active is false after available_until; UI gates Start on is_active — extend when rollover/override applies
        const effectiveIsActive = Boolean(exam.is_active) || hasDeadlineExtension

        // Use proper retake logic that respects student donation/membership benefits
        const retakeCheck = await canRetakeAssessment(
          studentDatabaseId,
          exam.id,
          exam.retake_limit,
          exam.retake_enabled,
          completedAttempts.length,
          undefined,
          {
            availableUntil: exam.available_until,
            hasDeadlineExtension: hasDeadlineExtension,
            bypassCalendarRetakeExpiry: await isBetaUser(studentDatabaseId),
          },
        )

        const canRetake = false
        const canTakeExam = !isCompleted

        // Use latest completed attempt for report/score (same as quizzes API) — incomplete attempts return 404
        const scoreAttempt = latestCompletedAttempt || latestAttempt

        return {
          ...exam,
          is_active: effectiveIsActive,
          time_per_question: Math.round(Number(exam.total_duration)),
          attempted: examAttempts.length > 0,
          completed: isCompleted,
          can_retake: canRetake,
          can_take: canTakeExam,
          attempt_id: scoreAttempt?.attempt_id,
          score: scoreAttempt?.score,
          total_questions: scoreAttempt?.total_questions,
          attempts_used: completedAttempts.length,
          attempts_remaining: 0,
          calendar_retake_perks_expired: retakeCheck.calendarRetakePerksExpired ?? false,
          expired_retake_slots: retakeCheck.expiredRetakeSlots ?? null,
        }
      })
    )

    const attemptIdsForDisplay = midSemestersWithAttempts
      .map((e) => e.attempt_id as number | undefined)
      .filter((id): id is number => typeof id === "number" && id > 0)
    if (attemptIdsForDisplay.length > 0) {
      const displayGrades = await getAttemptDisplayGradesBatch(attemptIdsForDisplay)
      const enriched = midSemestersWithAttempts.map((exam) => {
        const aid = exam.attempt_id as number | undefined
        if (!aid) return exam
        const grade = displayGrades.get(aid)
        if (!grade) return exam
        return {
          ...exam,
          score: grade.score,
          total_questions: grade.totalPoints,
          display_percentage: grade.percentage,
        }
      })
      return NextResponse.json({ midSemesters: enriched })
    }

    return NextResponse.json({ midSemesters: midSemestersWithAttempts })
  } catch (error) {
    console.error("[v0] Failed to fetch mid-semester exams:", error)
    return NextResponse.json({ error: "Failed to fetch mid-semester exams" }, { status: 500 })
  }
}
