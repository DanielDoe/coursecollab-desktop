import { sql } from "@/lib/db"
import { getAttemptDisplayGradesBatch } from "@/lib/attempt-grade-display"

export type StudentPlatformRecord = {
  student: {
    id: number
    student_id: string
    full_name: string
    email: string | null
    section: string
    session_code: string | null
    created_at: string | null
  }
  summary: {
    total_attempts: number
    completed_attempts: number
    finalized_attempts: number
    deleted_attempts: number
    practice_attempts: number
    assessment_types: string[]
  }
  attempts: Array<{
    id: number
    quiz_id: number
    quiz_title: string
    assessment_type: string
    attempt_number: number
    score: number | null
    display_score: number | null
    completed_at: string | null
    attempted_at: string | null
    results_finalized: boolean
    deleted: boolean
    saved_for_later: boolean
    retake_count: number
    is_final_grade: boolean | null
  }>
  practice: Array<{
    id: number
    score_percentage: number | null
    total_questions: number
    correct_answers: number
    topics: string[]
    started_at: string | null
    completed_at: string | null
  }>
}

export async function fetchStudentPlatformRecord(
  studentDbId: number,
  courseId?: number | null,
): Promise<StudentPlatformRecord | null> {
  const studentRows = await sql`
    SELECT
      s.id,
      s.student_id,
      s.full_name,
      s.email,
      s.section,
      s.created_at,
      sess.code as session_code
    FROM students s
    LEFT JOIN sessions sess ON sess.id = s.session_id
    WHERE s.id = ${studentDbId}
    LIMIT 1
  `
  if (studentRows.length === 0) return null

  const student = studentRows[0] as {
    id: number
    student_id: string
    full_name: string
    email: string | null
    section: string
    created_at: string | null
    session_code: string | null
  }

  if (courseId != null) {
    const scopeCheck = await sql`
      SELECT 1
      FROM students s
      JOIN sessions sess ON sess.id = s.session_id
      WHERE s.id = ${studentDbId} AND sess.course_id = ${courseId}
      LIMIT 1
    `
    if (scopeCheck.length === 0) return null
  }

  const attemptRows = courseId
    ? await sql`
        SELECT
          qa.id,
          qa.quiz_id,
          q.title as quiz_title,
          COALESCE(q.assessment_type, 'quiz') as assessment_type,
          COALESCE(qa.attempt_number, 1) as attempt_number,
          qa.score,
          qa.completed_at,
          qa.started_at,
          qa.results_finalized_at,
          qa.deleted_at,
          qa.saved_for_later_at,
          COALESCE(qa.retake_count, 0) as retake_count,
          qa.is_final_grade
        FROM quiz_attempts qa
        JOIN quizzes q ON q.id = qa.quiz_id
        JOIN students s ON s.id = qa.student_id
        JOIN sessions sess ON sess.id = s.session_id
        WHERE qa.student_id = ${studentDbId}
          AND sess.course_id = ${courseId}
        ORDER BY qa.started_at DESC NULLS LAST, qa.id DESC
      `
    : await sql`
        SELECT
          qa.id,
          qa.quiz_id,
          q.title as quiz_title,
          COALESCE(q.assessment_type, 'quiz') as assessment_type,
          COALESCE(qa.attempt_number, 1) as attempt_number,
          qa.score,
          qa.completed_at,
          qa.started_at,
          qa.results_finalized_at,
          qa.deleted_at,
          qa.saved_for_later_at,
          COALESCE(qa.retake_count, 0) as retake_count,
          qa.is_final_grade
        FROM quiz_attempts qa
        JOIN quizzes q ON q.id = qa.quiz_id
        WHERE qa.student_id = ${studentDbId}
        ORDER BY qa.started_at DESC NULLS LAST, qa.id DESC
      `

  const attemptIds = (attemptRows as { id: number }[]).map((r) => Number(r.id))
  const displayGrades = await getAttemptDisplayGradesBatch(attemptIds)

  const attempts = (attemptRows as any[]).map((row) => {
    const id = Number(row.id)
    const grade = displayGrades.get(id)
    return {
      id,
      quiz_id: Number(row.quiz_id),
      quiz_title: String(row.quiz_title || "Untitled"),
      assessment_type: String(row.assessment_type || "quiz"),
      attempt_number: Number(row.attempt_number) || 1,
      score: row.score != null ? Number(row.score) : null,
      display_score: grade?.percentage ?? (row.score != null ? Number(row.score) : null),
      completed_at: row.completed_at ?? null,
      attempted_at: row.started_at ?? null,
      results_finalized: row.results_finalized_at != null,
      deleted: row.deleted_at != null,
      saved_for_later: row.saved_for_later_at != null && row.completed_at == null,
      retake_count: Number(row.retake_count) || 0,
      is_final_grade: row.is_final_grade === true,
    }
  })

  const practiceRows = courseId
    ? await sql`
        SELECT
          pa.id,
          pa.score_percentage,
          COALESCE(pa.total_questions, 0) as total_questions,
          COALESCE(pa.correct_answers, 0) as correct_answers,
          pa.topics,
          pa.started_at,
          pa.completed_at
        FROM practice_attempts pa
        JOIN students s ON s.id = pa.student_id
        JOIN sessions sess ON sess.id = s.session_id
        WHERE pa.student_id = ${studentDbId}
          AND sess.course_id = ${courseId}
        ORDER BY pa.started_at DESC NULLS LAST, pa.id DESC
        LIMIT 100
      `
    : await sql`
        SELECT
          pa.id,
          pa.score_percentage,
          COALESCE(pa.total_questions, 0) as total_questions,
          COALESCE(pa.correct_answers, 0) as correct_answers,
          pa.topics,
          pa.started_at,
          pa.completed_at
        FROM practice_attempts pa
        WHERE pa.student_id = ${studentDbId}
        ORDER BY pa.started_at DESC NULLS LAST, pa.id DESC
        LIMIT 100
      `

  const practice = (practiceRows as any[]).map((row) => ({
    id: Number(row.id),
    score_percentage: row.score_percentage != null ? Number(row.score_percentage) : null,
    total_questions: Number(row.total_questions) || 0,
    correct_answers: Number(row.correct_answers) || 0,
    topics: Array.isArray(row.topics) ? row.topics.filter(Boolean) : [],
    started_at: row.started_at ?? null,
    completed_at: row.completed_at ?? null,
  }))

  const activeAttempts = attempts.filter((a) => !a.deleted)
  const assessmentTypes = [...new Set(activeAttempts.map((a) => a.assessment_type))]

  return {
    student: {
      id: student.id,
      student_id: student.student_id,
      full_name: student.full_name,
      email: student.email,
      section: student.section,
      session_code: student.session_code,
      created_at: student.created_at,
    },
    summary: {
      total_attempts: attempts.length,
      completed_attempts: attempts.filter((a) => a.completed_at).length,
      finalized_attempts: attempts.filter((a) => a.results_finalized && !a.deleted).length,
      deleted_attempts: attempts.filter((a) => a.deleted).length,
      practice_attempts: practice.length,
      assessment_types: assessmentTypes,
    },
    attempts,
    practice,
  }
}
