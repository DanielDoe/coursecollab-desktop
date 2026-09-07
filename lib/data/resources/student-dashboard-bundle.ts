import { sql } from "@/lib/db"
import { NOW_UTC } from "@/lib/central-time"
import { getStudentAttendanceSoFar } from "@/lib/attendance-percentage"
import { getAttemptDisplayGradesBatch } from "@/lib/attempt-grade-display"
import { isBetaUser } from "@/lib/membership"
import { getClassroomPoints, getGradeWeights, recalculateAndSaveGrade, type StudentGrade } from "@/lib/grades"
import { normalizeSessionForStorage } from "@/lib/session-catalog"
import { buildProvisionalGradeForStudent } from "@/lib/student-provisional-grade"
import {
  resolveStudentCourseContextByDbId,
  sqlQuizInStudentCourse,
} from "@/lib/student-course-scope"
import { rememberTtl } from "@/lib/perf/ttl-cache"

const CLASS_AVG_TTL_MS = 120_000
const WEIGHTS_TTL_MS = 15 * 60_000

export type DashboardUnavailable = Partial<
  Record<"grade" | "quizzes" | "homework" | "attendance" | "streaks" | "points" | "finals", true>
>

export type StudentDashboardBundle = {
  gradePayload: {
    grade: StudentGrade | Record<string, unknown>
    weights: unknown
    classAverages: Record<string, unknown>
    provisional: unknown
  } | null
  quizHistory: Array<{ attempts: Array<{ percentage: number; completed_at: string }> }>
  homeworkHistory: Array<{
    status: string
    available_until?: string
    attempts: Array<{ percentage: number; completed_at?: string }>
  }>
  homeworkStats: { overdue: number; pending: number } | null
  attendance: {
    attendance_percentage: number
    sessions_scored_so_far: number
    total_classes: number
    classes_attended: number
  } | null
  attendanceStreak: number | null
  upcomingQuizzes: Array<{ available_until?: string }>
  finalsTaken: boolean | null
  classroomPoints: number | null
  unavailable: DashboardUnavailable
}

async function fetchClassAverages(sessionForStorage: string) {
  return rememberTtl(`grades:class-avg:${sessionForStorage}`, CLASS_AVG_TTL_MS, async () => {
    const rows = await sql`
      SELECT
        AVG(quiz_score) as avg_quiz,
        AVG(homework_score) as avg_homework,
        AVG(midterm_score) as avg_midterm,
        AVG(final_score) as avg_final,
        AVG(attendance_score) as avg_attendance,
        AVG(project_score) as avg_project,
        AVG(classroom_score) as avg_classroom,
        AVG(engagement_credits) as avg_engagement,
        AVG(total_score) as avg_total
      FROM student_grades
      WHERE session = ${sessionForStorage}
    `
    return (rows[0] || {}) as Record<string, unknown>
  })
}

function cachedWeights(session: string) {
  return rememberTtl(`grades:weights:${session}`, WEIGHTS_TTL_MS, () => getGradeWeights(session))
}

async function loadGradePayload(studentDbId: number, sessionParam: string, sessionForStorage: string) {
  const gradeResult = await sql`
    SELECT * FROM student_grades
    WHERE student_id = ${studentDbId} AND session = ${sessionForStorage}
  `
  let grade = (gradeResult[0] as StudentGrade | undefined) ?? null
  if (!grade) {
    grade = await recalculateAndSaveGrade(studentDbId, sessionParam)
    if (!grade) return null
    const [provisional, weights, classAverages] = await Promise.all([
      buildProvisionalGradeForStudent(studentDbId, grade, sessionForStorage),
      cachedWeights(sessionParam),
      fetchClassAverages(sessionForStorage),
    ])
    return { grade, weights, classAverages, provisional }
  }

  const [weights, attendanceSoFar, classAverages] = await Promise.all([
    cachedWeights(sessionParam),
    getStudentAttendanceSoFar(studentDbId, sessionForStorage),
    fetchClassAverages(sessionForStorage),
  ])
  if (attendanceSoFar.sessionsScoredSoFar > 0) {
    grade.attendance_score = attendanceSoFar.percentage
  }
  const provisional = await buildProvisionalGradeForStudent(studentDbId, grade, sessionForStorage)
  return { grade, weights, classAverages, provisional }
}

async function loadQuizHistorySlim(studentDbId: number) {
  const courseCtx = await resolveStudentCourseContextByDbId(studentDbId)
  const courseFilter =
    courseCtx?.courseId != null ? sqlQuizInStudentCourse("q", courseCtx.courseId) : sql.unsafe("(TRUE)")

  const attempts = await sql`
    SELECT qa.id as attempt_id, qa.quiz_id, qa.completed_at, qa.score, qa.total_questions
    FROM quiz_attempts qa
    JOIN quizzes q ON qa.quiz_id = q.id
    WHERE qa.student_id = ${studentDbId}
      AND qa.deleted_at IS NULL
      AND ${courseFilter}
    ORDER BY qa.completed_at DESC NULLS LAST, qa.started_at DESC
  `
  const attemptIds = (attempts as { attempt_id: number }[]).map((a) => Number(a.attempt_id))
  const displayGrades = await getAttemptDisplayGradesBatch(attemptIds)
  const quizMap = new Map<number, { attempts: Array<{ percentage: number; completed_at: string }> }>()
  for (const row of attempts as Array<Record<string, unknown>>) {
    const quizId = Number(row.quiz_id)
    const attemptId = Number(row.attempt_id)
    const grade = displayGrades.get(attemptId)
    if (!quizMap.has(quizId)) quizMap.set(quizId, { attempts: [] })
    quizMap.get(quizId)!.attempts.push({
      percentage: grade?.percentage ?? 0,
      completed_at: String(row.completed_at ?? ""),
    })
  }
  return Array.from(quizMap.values())
}

async function loadHomeworkSlim(studentDbId: number) {
  const studentLookup = await sql`
    SELECT session_id FROM students WHERE id = ${studentDbId} LIMIT 1
  `
  const studentSessionId = studentLookup[0]?.session_id
  if (!studentSessionId) {
    return { homeworkHistory: [], homeworkStats: { overdue: 0, pending: 0 } }
  }
  const isBeta = await isBetaUser(studentDbId)
  const rows = await sql`
    SELECT
      q.id,
      q.available_until,
      qa.id as attempt_id,
      qa.completed_at,
      qa.score,
      qa.total_questions as attempt_questions,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM quiz_attempts qa2
          WHERE qa2.quiz_id = q.id AND qa2.student_id = ${studentDbId}
            AND qa2.completed_at IS NOT NULL AND qa2.deleted_at IS NULL
        ) THEN 'completed'
        WHEN ${isBeta} = false AND q.available_until IS NOT NULL AND q.available_until <= ${NOW_UTC()} THEN 'overdue'
        ELSE 'pending'
      END as status
    FROM quizzes q
    LEFT JOIN quiz_session_access qsa ON q.id = qsa.quiz_id AND qsa.session_id = ${studentSessionId} AND qsa.is_active = true
    LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.student_id = ${studentDbId} AND qa.deleted_at IS NULL
    WHERE q.assessment_type = 'homework'
      AND q.deleted_at IS NULL
      AND qsa.id IS NOT NULL
    ORDER BY q.available_until DESC, qa.started_at DESC
  `
  const attemptIds = (rows as { attempt_id: number | null }[])
    .map((row) => row.attempt_id)
    .filter((id): id is number => id != null)
  const displayGrades = await getAttemptDisplayGradesBatch(attemptIds)
  const grouped = new Map<
    number,
    {
      status: string
      available_until?: string
      attempts: Array<{ percentage: number; completed_at?: string }>
    }
  >()
  for (const row of rows as Array<Record<string, unknown>>) {
    const hwId = Number(row.id)
    if (!grouped.has(hwId)) {
      grouped.set(hwId, {
        status: String(row.status),
        available_until: row.available_until ? String(row.available_until) : undefined,
        attempts: [],
      })
    }
    if (row.attempt_id) {
      const grade = displayGrades.get(Number(row.attempt_id))
      grouped.get(hwId)!.attempts.push({
        percentage: grade?.percentage ?? 0,
        completed_at: row.completed_at ? String(row.completed_at) : undefined,
      })
    }
  }
  const homeworkHistory = Array.from(grouped.values())
  return {
    homeworkHistory,
    homeworkStats: {
      overdue: homeworkHistory.filter((h) => h.status === "overdue").length,
      pending: homeworkHistory.filter((h) => h.status === "pending").length,
    },
  }
}

async function loadUpcomingQuizDates(studentDbId: number) {
  const studentLookup = await sql`
    SELECT session_id FROM students WHERE id = ${studentDbId} LIMIT 1
  `
  const studentSessionId = studentLookup[0]?.session_id
  if (!studentSessionId) return []
  const rows = await sql`
    SELECT q.available_until
    FROM quizzes q
    INNER JOIN quiz_session_access qsa
      ON q.id = qsa.quiz_id AND qsa.session_id = ${studentSessionId} AND qsa.is_active = true
    WHERE q.assessment_type = 'quiz'
      AND q.deleted_at IS NULL
      AND q.available_until IS NOT NULL
      AND q.available_until > ${NOW_UTC()}
  `
  return (rows as { available_until?: string }[]).map((row) => ({
    available_until: row.available_until ? String(row.available_until) : undefined,
  }))
}

async function loadFinalsTaken(studentDbId: number) {
  const rows = await sql`
    SELECT 1
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa.quiz_id
    WHERE qa.student_id = ${studentDbId}
      AND qa.deleted_at IS NULL
      AND qa.completed_at IS NOT NULL
      AND q.deleted_at IS NULL
      AND q.assessment_type IN ('final', 'finals', 'final_exam')
    LIMIT 1
  `
  return rows.length > 0
}

export async function loadStudentDashboardBundle(args: {
  studentDbId: number
  sessionParam: string
}): Promise<StudentDashboardBundle> {
  const sessionForStorage = await normalizeSessionForStorage(args.sessionParam)
  const unavailable: DashboardUnavailable = {}

  const results = await Promise.allSettled([
    loadGradePayload(args.studentDbId, args.sessionParam, sessionForStorage),
    loadQuizHistorySlim(args.studentDbId),
    loadHomeworkSlim(args.studentDbId),
    getStudentAttendanceSoFar(args.studentDbId, sessionForStorage),
    sql`SELECT current_streak FROM attendance_streaks WHERE student_id = ${args.studentDbId} LIMIT 1`,
    loadUpcomingQuizDates(args.studentDbId),
    loadFinalsTaken(args.studentDbId),
    getClassroomPoints(
      args.studentDbId,
      args.sessionParam && args.sessionParam !== "ALL" ? args.sessionParam : undefined,
    ),
  ])

  const [
    gradeResult,
    quizResult,
    homeworkResult,
    attendanceResult,
    streakResult,
    quizzesResult,
    finalsResult,
    pointsResult,
  ] = results

  if (gradeResult.status === "rejected") unavailable.grade = true
  if (quizResult.status === "rejected") unavailable.quizzes = true
  if (homeworkResult.status === "rejected") unavailable.homework = true
  if (attendanceResult.status === "rejected") unavailable.attendance = true
  if (streakResult.status === "rejected") unavailable.streaks = true
  if (finalsResult.status === "rejected") unavailable.finals = true
  if (pointsResult.status === "rejected") unavailable.points = true

  const attendance =
    attendanceResult.status === "fulfilled"
      ? {
          attendance_percentage: attendanceResult.value.percentage,
          sessions_scored_so_far: attendanceResult.value.sessionsScoredSoFar,
          total_classes: attendanceResult.value.sessionsScheduledTotal,
          classes_attended: attendanceResult.value.classesAttended,
        }
      : null

  const streakRows = streakResult.status === "fulfilled" ? streakResult.value : null

  return {
    gradePayload: gradeResult.status === "fulfilled" ? gradeResult.value : null,
    quizHistory: quizResult.status === "fulfilled" ? quizResult.value : [],
    homeworkHistory: homeworkResult.status === "fulfilled" ? homeworkResult.value.homeworkHistory : [],
    homeworkStats: homeworkResult.status === "fulfilled" ? homeworkResult.value.homeworkStats : null,
    attendance,
    attendanceStreak:
      streakRows && streakRows[0]
        ? Number((streakRows[0] as { current_streak?: number }).current_streak ?? 0)
        : streakResult.status === "fulfilled"
          ? 0
          : null,
    upcomingQuizzes: quizzesResult.status === "fulfilled" ? quizzesResult.value : [],
    finalsTaken: finalsResult.status === "fulfilled" ? finalsResult.value : null,
    classroomPoints: pointsResult.status === "fulfilled" ? pointsResult.value : null,
    unavailable,
  }
}
