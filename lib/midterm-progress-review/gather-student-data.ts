import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { getAttemptDisplayGrade } from "@/lib/attempt-grade-display"
import { normalizeSessionForStorage } from "@/lib/session-catalog"
import type {
  AssessmentAttemptSummary,
  AttendanceSummary,
  ClassroomPointSummary,
  LecturePracticeSummary,
  PracticeHubSummary,
  StudentProgressData,
} from "./types"
import {
  asOfDateEndIso,
  parseReviewPeriod,
  type ProgressReviewPeriod,
} from "./review-period"
import { buildProgressReviewGradebook } from "./adjust-gradebook-for-review"
import { getStudentAttendanceSoFar } from "@/lib/attendance-percentage"

export type GatherProgressOptions = {
  reviewPeriod?: ProgressReviewPeriod | string
  asOfDate?: string | null
}

function pct(n: number, d: number): number {
  if (!d || !Number.isFinite(n)) return 0
  return Math.round((n / d) * 1000) / 10
}

function truncFeedback(text: string | null | undefined, max = 200): string {
  const s = String(text ?? "").trim()
  if (!s) return ""
  return s.length <= max ? s : `${s.slice(0, max)}…`
}

function parseAiFeedback(raw: unknown): string {
  if (!raw) return ""
  if (typeof raw === "string") return truncFeedback(raw)
  if (typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>
    const parts = [o.feedback, o.gradeExplanation, o.detailedExplanation]
      .filter((x) => typeof x === "string" && String(x).trim())
      .map((x) => String(x).trim())
    return truncFeedback(parts.join(" "))
  }
  return ""
}

export async function gatherStudentProgressData(
  studentDbId: number,
  courseId?: number | null,
  options?: GatherProgressOptions,
): Promise<StudentProgressData | null> {
  const reviewPeriod = parseReviewPeriod(options?.reviewPeriod)
  const asOfDate =
    reviewPeriod === "custom" && options?.asOfDate?.trim()
      ? options.asOfDate.trim()
      : null
  const asOfEnd = asOfDate ? asOfDateEndIso(asOfDate) : null
  const studentRows = sqlRows<{
    id: number
    full_name: string | null
    email: string | null
    student_id: unknown
    section: string | null
    course_id: number | null
    session_code: string | null
    course_code: string | null
    instructor_name: string | null
  }>(
    await sql`
    SELECT
      s.id,
      s.full_name,
      s.email,
      s.student_id,
      s.section,
      s.course_id,
      sess.code AS session_code,
      c.course_code,
      i.name AS instructor_name
    FROM students s
    LEFT JOIN sessions sess ON sess.id = s.session_id
    LEFT JOIN courses c ON c.id = COALESCE(s.course_id, sess.course_id)
    LEFT JOIN instructors i ON i.id = c.instructor_id
    WHERE s.id = ${studentDbId}
      AND (s.deleted_at IS NULL)
    LIMIT 1
  `,
  )

  const row = studentRows[0]

  if (!row) return null

  const section = row.section?.trim() || row.session_code?.trim() || ""
  let sessionKey = section
  if (section) {
    try {
      sessionKey = await normalizeSessionForStorage(section)
    } catch {
      sessionKey = section
    }
  }

  const attemptRows = asOfEnd
    ? await sql`
        SELECT
          qa.id AS attempt_id,
          qa.quiz_id,
          q.title AS quiz_title,
          q.assessment_type,
          qa.completed_at
        FROM quiz_attempts qa
        INNER JOIN quizzes q ON q.id = qa.quiz_id AND q.deleted_at IS NULL
        WHERE qa.student_id = ${studentDbId}
          AND qa.completed_at IS NOT NULL
          AND qa.completed_at <= ${asOfEnd}
          AND qa.deleted_at IS NULL
        ORDER BY qa.completed_at DESC
        LIMIT 100
      `
    : await sql`
        SELECT
          qa.id AS attempt_id,
          qa.quiz_id,
          q.title AS quiz_title,
          q.assessment_type,
          qa.completed_at
        FROM quiz_attempts qa
        INNER JOIN quizzes q ON q.id = qa.quiz_id AND q.deleted_at IS NULL
        WHERE qa.student_id = ${studentDbId}
          AND qa.completed_at IS NOT NULL
          AND qa.deleted_at IS NULL
        ORDER BY qa.completed_at DESC
        LIMIT 100
      `

  const attemptList = attemptRows as Array<{
    attempt_id: number
    quiz_title: string | null
    assessment_type: string | null
    completed_at: string | null
  }>

  const grades = await Promise.all(
    attemptList.map((a) => getAttemptDisplayGrade(String(a.attempt_id))),
  )

  const assessments: AssessmentAttemptSummary[] = []
  for (let i = 0; i < attemptList.length; i++) {
    const a = attemptList[i]
    const g = grades[i]
    if (!g) continue

    const answerRows = await sql`
      SELECT
        qa.feedback,
        qa.ai_feedback,
        qa.is_correct,
        qa.override_comment,
        qq.topic,
        qq.question_type
      FROM quiz_answers qa
      JOIN quiz_questions qq ON qq.id = qa.question_id
      WHERE qa.attempt_id = ${a.attempt_id}
      ORDER BY qa.id ASC
      LIMIT 50
    `

    const feedbackHighlights: string[] = []
    const incorrectTopics = new Set<string>()

    for (const ans of answerRows as Array<Record<string, unknown>>) {
      const fb =
        truncFeedback(String(ans.override_comment ?? "")) ||
        truncFeedback(String(ans.feedback ?? "")) ||
        parseAiFeedback(ans.ai_feedback)
      if (fb && !ans.is_correct) {
        feedbackHighlights.push(fb)
      }
      if (!ans.is_correct && ans.topic) {
        incorrectTopics.add(String(ans.topic))
      }
    }

    assessments.push({
      attemptId: Number(a.attempt_id),
      title: a.quiz_title || "(Untitled)",
      assessmentType: a.assessment_type || "quiz",
      completedAt: a.completed_at,
      score: g.score,
      totalPoints: g.totalPoints,
      percentage: g.percentage,
      feedbackHighlights: feedbackHighlights.slice(0, 5),
      incorrectTopics: [...incorrectTopics].slice(0, 8),
    })
  }

  let classroomPoints: ClassroomPointSummary[] = []
  try {
    const cpRows = asOfEnd
      ? await sql`
          SELECT cp.points, cp.reason, cp.category, cp.status,
                 COALESCE(cp.awarded_at, cp.created_at) AS awarded_at
          FROM classroom_points cp
          WHERE cp.student_id = ${studentDbId}
            AND COALESCE(cp.awarded_at, cp.created_at) <= ${asOfEnd}
          ORDER BY COALESCE(cp.awarded_at, cp.created_at) DESC NULLS LAST
          LIMIT 50
        `
      : await sql`
          SELECT cp.points, cp.reason, cp.category, cp.status,
                 COALESCE(cp.awarded_at, cp.created_at) AS awarded_at
          FROM classroom_points cp
          WHERE cp.student_id = ${studentDbId}
          ORDER BY COALESCE(cp.awarded_at, cp.created_at) DESC NULLS LAST
          LIMIT 50
        `
    classroomPoints = (cpRows as Array<Record<string, unknown>>).map((r) => ({
      points: Number(r.points) || 0,
      reason: r.reason != null ? String(r.reason) : null,
      category: r.category != null ? String(r.category) : null,
      awardedAt: r.awarded_at != null ? String(r.awarded_at) : null,
      status: r.status != null ? String(r.status) : null,
    }))
  } catch {
    classroomPoints = []
  }

  let practiceAttempts: Array<Record<string, unknown>> = []
  try {
    practiceAttempts = (asOfEnd
      ? await sql`
          SELECT id, topics, score_percentage, completed_at, total_questions, correct_answers
          FROM practice_attempts
          WHERE student_id = ${studentDbId}
            AND completed_at IS NOT NULL
            AND completed_at <= ${asOfEnd}
          ORDER BY completed_at DESC
          LIMIT 30
        `
      : await sql`
          SELECT id, topics, score_percentage, completed_at, total_questions, correct_answers
          FROM practice_attempts
          WHERE student_id = ${studentDbId}
            AND completed_at IS NOT NULL
          ORDER BY completed_at DESC
          LIMIT 30
        `) as Array<Record<string, unknown>>
  } catch {
    practiceAttempts = []
  }

  let topicPerformance: Array<{ topic: string; accuracy: number; total: number }> = []
  try {
    const tp = await sql`
      SELECT
        qb.topic,
        COUNT(pa.id)::int AS total_questions,
        ROUND(AVG(CASE WHEN pa.is_correct THEN 100 ELSE 0 END), 1) AS accuracy
      FROM practice_answers pa
      JOIN question_bank qb ON qb.id = pa.bank_question_id
      WHERE pa.attempt_id IN (
        SELECT id FROM practice_attempts WHERE student_id = ${studentDbId}
      )
      GROUP BY qb.topic
      HAVING COUNT(pa.id) >= 2
      ORDER BY total_questions DESC
    `
    topicPerformance = (tp as Array<Record<string, unknown>>).map((r) => ({
      topic: String(r.topic || "General"),
      accuracy: Number(r.accuracy) || 0,
      total: Number(r.total_questions) || 0,
    }))
  } catch {
    try {
      const tp = await sql`
        SELECT
          qb.topic,
          COUNT(pa.id)::int AS total_questions,
          ROUND(AVG(CASE WHEN pa.is_correct THEN 100 ELSE 0 END), 1) AS accuracy
        FROM practice_answers pa
        JOIN question_bank qb ON qb.id = pa.question_id
        WHERE pa.attempt_id IN (
          SELECT id FROM practice_attempts WHERE student_id = ${studentDbId}
        )
        GROUP BY qb.topic
        HAVING COUNT(pa.id) >= 2
        ORDER BY total_questions DESC
      `
      topicPerformance = (tp as Array<Record<string, unknown>>).map((r) => ({
        topic: String(r.topic || "General"),
        accuracy: Number(r.accuracy) || 0,
        total: Number(r.total_questions) || 0,
      }))
    } catch {
      topicPerformance = []
    }
  }

  const totalPracticeQ = practiceAttempts.reduce(
    (s, a) => s + (Number(a.total_questions) || 0),
    0,
  )
  const totalPracticeCorrect = practiceAttempts.reduce(
    (s, a) => s + (Number(a.correct_answers) || 0),
    0,
  )
  const avgPracticeScore =
    practiceAttempts.length > 0
      ? practiceAttempts.reduce((s, a) => s + (Number(a.score_percentage) || 0), 0) /
        practiceAttempts.length
      : 0

  const weakTopics = topicPerformance
    .filter((t) => t.accuracy < 70)
    .sort((a, b) => a.accuracy - b.accuracy)
    .map((t) => t.topic)
    .slice(0, 6)

  const strongTopics = topicPerformance
    .filter((t) => t.accuracy >= 80)
    .sort((a, b) => b.accuracy - a.accuracy)
    .map((t) => t.topic)
    .slice(0, 6)

  const practiceHub: PracticeHubSummary = {
    totalAttempts: practiceAttempts.length,
    avgScore: Math.round(avgPracticeScore * 10) / 10,
    accuracy: pct(totalPracticeCorrect, totalPracticeQ),
    weakTopics,
    strongTopics,
    recentSessions: practiceAttempts.slice(0, 5).map((a) => ({
      topics: Array.isArray(a.topics) ? (a.topics as string[]) : null,
      scorePercentage: Number(a.score_percentage) || 0,
      completedAt: a.completed_at != null ? String(a.completed_at) : null,
    })),
  }

  let lecturePracticeRows: Array<Record<string, unknown>> = []
  try {
    lecturePracticeRows = (asOfEnd
      ? await sql`
          SELECT lspa.is_correct, lspa.completed_at, l.title AS lecture_title
          FROM lecture_sample_practice_attempts lspa
          JOIN lectures l ON l.id = lspa.lecture_id
          WHERE lspa.student_id = ${studentDbId}
            AND lspa.completed_at IS NOT NULL
            AND lspa.completed_at <= ${asOfEnd}
          ORDER BY lspa.completed_at DESC NULLS LAST
          LIMIT 50
        `
      : await sql`
          SELECT lspa.is_correct, lspa.completed_at, l.title AS lecture_title
          FROM lecture_sample_practice_attempts lspa
          JOIN lectures l ON l.id = lspa.lecture_id
          WHERE lspa.student_id = ${studentDbId}
          ORDER BY lspa.completed_at DESC NULLS LAST
          LIMIT 50
        `) as Array<Record<string, unknown>>
  } catch {
    lecturePracticeRows = []
  }

  const lectureCorrect = lecturePracticeRows.filter((r) => r.is_correct === true).length
  const lecturePractice: LecturePracticeSummary = {
    totalAttempts: lecturePracticeRows.length,
    correctCount: lectureCorrect,
    accuracy: pct(lectureCorrect, lecturePracticeRows.length),
    recentLectures: lecturePracticeRows.slice(0, 8).map((r) => ({
      lectureTitle: String(r.lecture_title || "Lecture"),
      isCorrect: r.is_correct === true,
      completedAt: r.completed_at != null ? String(r.completed_at) : null,
    })),
  }

  let attendanceRecords: Array<Record<string, unknown>> = []
  try {
    attendanceRecords = (asOfEnd
      ? await sql`
          SELECT ar.status, ar.timestamp, asess.class_title
          FROM attendance_records ar
          LEFT JOIN attendance_sessions asess ON asess.id = ar.session_id
          WHERE ar.student_id = ${studentDbId}
            AND ar.deleted_at IS NULL
            AND ar.timestamp <= ${asOfEnd}
          ORDER BY ar.timestamp DESC
          LIMIT 60
        `
      : await sql`
          SELECT ar.status, ar.timestamp, asess.class_title
          FROM attendance_records ar
          LEFT JOIN attendance_sessions asess ON asess.id = ar.session_id
          WHERE ar.student_id = ${studentDbId}
            AND ar.deleted_at IS NULL
          ORDER BY ar.timestamp DESC
          LIMIT 60
        `) as Array<Record<string, unknown>>
  } catch {
    attendanceRecords = []
  }

  const presentCount = attendanceRecords.filter(
    (r) => String(r.status ?? "").toLowerCase() === "present",
  ).length
  const recentMissed = attendanceRecords
    .filter((r) => String(r.status ?? "").toLowerCase() !== "present")
    .slice(0, 5)
    .map((r) => String(r.class_title || "Class session"))

  let gradebookRow: Record<string, unknown> | null = null
  if (sessionKey) {
    const gr = await sql`
      SELECT
        quiz_score, homework_score, midterm_score, final_score,
        attendance_score, project_score, classroom_score,
        engagement_credits, total_score, letter_grade
      FROM student_grades
      WHERE student_id = ${studentDbId}
        AND session = ${sessionKey}
      LIMIT 1
    `
    gradebookRow = sqlRows<Record<string, unknown>>(gr)[0] ?? null
  }
  if (!gradebookRow) {
    const gr = await sql`
      SELECT
        quiz_score, homework_score, midterm_score, final_score,
        attendance_score, project_score, classroom_score,
        engagement_credits, total_score, letter_grade
      FROM student_grades
      WHERE student_id = ${studentDbId}
      ORDER BY last_calculated_at DESC NULLS LAST
      LIMIT 1
    `
    gradebookRow = sqlRows<Record<string, unknown>>(gr)[0] ?? null
  }

  const rawGradebook = gradebookRow
    ? {
        quizScore: Number(gradebookRow.quiz_score) || 0,
        homeworkScore: Number(gradebookRow.homework_score) || 0,
        midtermScore: Number(gradebookRow.midterm_score) || 0,
        finalScore: Number(gradebookRow.final_score) || 0,
        attendanceScore: Number(gradebookRow.attendance_score) || 0,
        projectScore: Number(gradebookRow.project_score) || 0,
        classroomScore: Number(gradebookRow.classroom_score) || 0,
        engagementCredits: Number(gradebookRow.engagement_credits) || 0,
        totalScore: Number(gradebookRow.total_score) || 0,
        letterGrade: gradebookRow.letter_grade != null ? String(gradebookRow.letter_grade) : null,
      }
    : null

  const attendanceSoFar = await getStudentAttendanceSoFar(
    studentDbId,
    sessionKey || undefined,
  )
  if (rawGradebook && attendanceSoFar.sessionsScoredSoFar > 0) {
    rawGradebook.attendanceScore = attendanceSoFar.percentage
  }

  const attendance: AttendanceSummary = {
    totalSessions: attendanceSoFar.sessionsScoredSoFar,
    scheduledSessionsTotal: attendanceSoFar.sessionsScheduledTotal,
    presentCount: attendanceSoFar.classesAttended,
    attendanceRate: attendanceSoFar.percentage,
    gradebookScore: attendanceSoFar.sessionsScoredSoFar > 0 ? attendanceSoFar.percentage : null,
    recentMissed,
  }

  const gradebook = await buildProgressReviewGradebook({
    raw: rawGradebook,
    assessments,
    attendance,
    classroomPoints,
    practiceHub,
    sessionKey,
  })

  return {
    student: {
      id: row.id,
      fullName: row.full_name || "Student",
      email: row.email,
      studentNumber: row.student_id != null ? String(row.student_id) : null,
      section: row.section,
    },
    courseCode: row.course_code,
    instructorName: row.instructor_name,
    reviewPeriod,
    asOfDate,
    gradebook,
    assessments,
    classroomPoints,
    practiceHub,
    lecturePractice,
    attendance,
    gatheredAt: asOfEnd ?? new Date().toISOString(),
  }
}

export async function listCourseStudentIds(
  courseId: number,
  scope?: { sessionId?: number | null; academicTermId?: number | null },
): Promise<number[]> {
  const { studentInInstructorSessionScopeSql } = await import("@/lib/instructor-session-scope")
  const pred = studentInInstructorSessionScopeSql({
    courseId,
    sessionId: scope?.sessionId,
    academicTermId: scope?.academicTermId,
  })
  const rows = await sql`
    SELECT DISTINCT s.id
    FROM students s
    WHERE (s.deleted_at IS NULL)
      AND ${sql.unsafe(pred)}
    ORDER BY s.id ASC
  `
  return (rows as Array<{ id: number }>).map((r) => Number(r.id))
}
