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
  gradebook: {
    letter_grade: string | null
    total_score: number | null
    quiz_score: number | null
    homework_score: number | null
    midterm_score: number | null
    final_score: number | null
    attendance_score: number | null
    classroom_score: number | null
    project_score: number | null
    engagement_credits: number | null
  } | null
  classroomPoints: Array<{
    points: number
    reason: string | null
    category: string | null
    awarded_at: string | null
    status: string | null
  }>
  lectures: Array<{
    title: string
    status: string | null
    week: number | null
    last_accessed: string | null
  }>
  lecturePractice: Array<{
    lecture_title: string
    is_correct: boolean
    completed_at: string | null
  }>
  flashcards: Array<{
    title: string
    card_count: number
    updated_at: string | null
  }>
  notes: Array<{
    title: string
    updated_at: string | null
  }>
  attendance: {
    present: number
    recorded: number
    rate: number | null
    recent_missed: string[]
  }
  activity: Array<{
    at: string | null
    kind: string
    label: string
  }>
}

async function loadRecordModules(studentDbId: number): Promise<{
  gradebook: StudentPlatformRecord["gradebook"]
  classroomPoints: StudentPlatformRecord["classroomPoints"]
  lectures: StudentPlatformRecord["lectures"]
  lecturePractice: StudentPlatformRecord["lecturePractice"]
  flashcards: StudentPlatformRecord["flashcards"]
  notes: StudentPlatformRecord["notes"]
  attendance: StudentPlatformRecord["attendance"]
  coraActivity: StudentPlatformRecord["activity"]
  codebenchActivity: StudentPlatformRecord["activity"]
}> {
  const emptyAttendance = { present: 0, recorded: 0, rate: null as number | null, recent_missed: [] as string[] }
  const [
    gradeRows,
    pointRows,
    lectureRows,
    lecturePracticeRows,
    deckRows,
    noteRows,
    attendanceRows,
    coraRows,
    codebenchRows,
  ] = await Promise.all([
    sql`
      SELECT letter_grade, total_score, quiz_score, homework_score, midterm_score,
             final_score, attendance_score, classroom_score, project_score, engagement_credits
      FROM student_grades
      WHERE student_id = ${studentDbId}
      ORDER BY COALESCE(last_calculated_at, updated_at) DESC NULLS LAST
      LIMIT 1
    `.catch(() => []),
    sql`
      SELECT points, reason, category, status, COALESCE(awarded_at, created_at) AS awarded_at
      FROM classroom_points
      WHERE student_id = ${studentDbId}
      ORDER BY COALESCE(awarded_at, created_at) DESC NULLS LAST
      LIMIT 40
    `.catch(() => []),
    sql`
      SELECT l.title, lsp.status, l.week, lsp.last_accessed
      FROM lecture_student_progress lsp
      JOIN lectures l ON l.id = lsp.lecture_id
      WHERE lsp.student_id = ${studentDbId}
      ORDER BY lsp.last_accessed DESC NULLS LAST
      LIMIT 40
    `.catch(() => []),
    sql`
      SELECT l.title AS lecture_title, lspa.is_correct, lspa.completed_at
      FROM lecture_sample_practice_attempts lspa
      JOIN lectures l ON l.id = lspa.lecture_id
      WHERE lspa.student_id = ${studentDbId}
      ORDER BY lspa.completed_at DESC NULLS LAST
      LIMIT 30
    `.catch(() => []),
    sql`
      SELECT d.title, COUNT(c.id)::int AS card_count, MAX(d.updated_at) AS updated_at
      FROM flashcard_decks d
      LEFT JOIN flashcard_cards c ON c.deck_id = d.id AND c.deleted_at IS NULL
      WHERE d.student_id = ${studentDbId} AND d.deleted_at IS NULL
      GROUP BY d.id, d.title
      ORDER BY MAX(d.updated_at) DESC NULLS LAST
      LIMIT 30
    `.catch(() => []),
    sql`
      SELECT title, updated_at
      FROM student_digital_notes
      WHERE student_id = ${studentDbId}
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 30
    `.catch(() => []),
    sql`
      SELECT ar.status, asess.class_title
      FROM attendance_records ar
      LEFT JOIN attendance_sessions asess ON asess.id = ar.session_id
      WHERE ar.student_id = ${studentDbId} AND ar.deleted_at IS NULL
      ORDER BY ar.timestamp DESC
      LIMIT 60
    `.catch(() => []),
    sql`
      SELECT created_at, feature, module
      FROM cora_usage_events
      WHERE user_id = ${studentDbId} AND user_role = 'student'
      ORDER BY created_at DESC
      LIMIT 20
    `.catch(() => []),
    sql`
      SELECT submitted_at, assignment_id, status
      FROM codebench_submissions
      WHERE student_id = ${studentDbId}
      ORDER BY submitted_at DESC
      LIMIT 15
    `.catch(() => []),
  ])

  const g = (gradeRows as any[])[0]
  const attendance = (attendanceRows as any[]).map((r) => ({
    status: String(r.status ?? "").toLowerCase(),
    title: String(r.class_title || "Class session"),
  }))
  const present = attendance.filter((r) => r.status === "present").length

  return {
    gradebook: g
      ? {
          letter_grade: g.letter_grade != null ? String(g.letter_grade) : null,
          total_score: g.total_score != null ? Number(g.total_score) : null,
          quiz_score: g.quiz_score != null ? Number(g.quiz_score) : null,
          homework_score: g.homework_score != null ? Number(g.homework_score) : null,
          midterm_score: g.midterm_score != null ? Number(g.midterm_score) : null,
          final_score: g.final_score != null ? Number(g.final_score) : null,
          attendance_score: g.attendance_score != null ? Number(g.attendance_score) : null,
          classroom_score: g.classroom_score != null ? Number(g.classroom_score) : null,
          project_score: g.project_score != null ? Number(g.project_score) : null,
          engagement_credits: g.engagement_credits != null ? Number(g.engagement_credits) : null,
        }
      : null,
    classroomPoints: (pointRows as any[]).map((r) => ({
      points: Number(r.points) || 0,
      reason: r.reason != null ? String(r.reason) : null,
      category: r.category != null ? String(r.category) : null,
      awarded_at: r.awarded_at != null ? String(r.awarded_at) : null,
      status: r.status != null ? String(r.status) : null,
    })),
    lectures: (lectureRows as any[]).map((r) => ({
      title: String(r.title || "Lecture"),
      status: r.status != null ? String(r.status) : null,
      week: r.week != null ? Number(r.week) : null,
      last_accessed: r.last_accessed != null ? String(r.last_accessed) : null,
    })),
    lecturePractice: (lecturePracticeRows as any[]).map((r) => ({
      lecture_title: String(r.lecture_title || "Lecture"),
      is_correct: r.is_correct === true,
      completed_at: r.completed_at != null ? String(r.completed_at) : null,
    })),
    flashcards: (deckRows as any[]).map((r) => ({
      title: String(r.title || "Deck"),
      card_count: Number(r.card_count) || 0,
      updated_at: r.updated_at != null ? String(r.updated_at) : null,
    })),
    notes: (noteRows as any[]).map((r) => ({
      title: String(r.title || "Note"),
      updated_at: r.updated_at != null ? String(r.updated_at) : null,
    })),
    attendance: attendance.length
      ? {
          present,
          recorded: attendance.length,
          rate: Math.round((present / attendance.length) * 1000) / 10,
          recent_missed: attendance.filter((r) => r.status !== "present").slice(0, 6).map((r) => r.title),
        }
      : emptyAttendance,
    coraActivity: (coraRows as any[]).map((r) => ({
      at: r.created_at != null ? String(r.created_at) : null,
      kind: "cora",
      label: String(r.module || r.feature || "Cora"),
    })),
    codebenchActivity: (codebenchRows as any[]).map((r) => ({
      at: r.submitted_at != null ? String(r.submitted_at) : null,
      kind: "codebench",
      label: `CodeBench ${r.status ? String(r.status) : "submission"}`,
    })),
  }
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
          GREATEST(COALESCE(qa.attempt_number, 1) - 1, 0) as retake_count,
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
          GREATEST(COALESCE(qa.attempt_number, 1) - 1, 0) as retake_count,
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
  const modules = await loadRecordModules(studentDbId)

  const activity = [
    ...attempts.slice(0, 12).map((a) => ({
      at: a.attempted_at || a.completed_at,
      kind: "assessment",
      label: a.quiz_title,
    })),
    ...practice.slice(0, 8).map((p) => ({
      at: p.completed_at || p.started_at,
      kind: "practice",
      label: p.topics.length ? `Practice · ${p.topics.slice(0, 2).join(", ")}` : "Practice",
    })),
    ...modules.lectures.slice(0, 8).map((l) => ({
      at: l.last_accessed,
      kind: "lecture",
      label: l.title,
    })),
    ...modules.classroomPoints.slice(0, 8).map((p) => ({
      at: p.awarded_at,
      kind: "points",
      label: p.reason || p.category || `${p.points} pts`,
    })),
    ...modules.coraActivity,
    ...modules.codebenchActivity,
  ]
    .filter((row) => row.at)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, 40)

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
    gradebook: modules.gradebook,
    classroomPoints: modules.classroomPoints,
    lectures: modules.lectures,
    lecturePractice: modules.lecturePractice,
    flashcards: modules.flashcards,
    notes: modules.notes,
    attendance: modules.attendance,
    activity,
  }
}
