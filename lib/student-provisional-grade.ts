import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import type { StudentGrade } from "@/lib/grades"
import {
  buildProgressReviewGradebook,
  computeProvisionalGrade,
  type GradeCategoryKey,
  type GradeCategoryStatus,
  type ProgressReviewGradebook,
} from "@/lib/midterm-progress-review/adjust-gradebook-for-review"
import { getStudentAttendanceSoFar } from "@/lib/attendance-percentage"
import {
  calculateHomeworkAverage,
  calculateQuizAverage,
  getFinalScore,
  getGradeWeights,
  getMidtermScore,
  type GradeCalculationOptions,
} from "@/lib/grades"
import type {
  AssessmentAttemptSummary,
  AttendanceSummary,
  ClassroomPointSummary,
  PracticeHubSummary,
} from "@/lib/midterm-progress-review/types"

const RELEASED_ONLY: GradeCalculationOptions = { releasedAttemptsOnly: true }

type AssessmentReleaseCounts = {
  completed: number
  released: number
}

async function fetchAssessmentReleaseCounts(
  studentDbId: number,
): Promise<Record<GradeCategoryKey, AssessmentReleaseCounts>> {
  const rows = sqlRows<{ assessment_type: string | null; completed: number; released: number }>(
    await sql`
      SELECT
        q.assessment_type,
        COUNT(*) FILTER (
          WHERE qa.completed_at IS NOT NULL AND qa.deleted_at IS NULL
        )::int AS completed,
        COUNT(*) FILTER (
          WHERE qa.results_finalized_at IS NOT NULL
            AND qa.completed_at IS NOT NULL
            AND qa.deleted_at IS NULL
        )::int AS released
      FROM quiz_attempts qa
      INNER JOIN quizzes q ON q.id = qa.quiz_id AND q.deleted_at IS NULL
      WHERE qa.student_id = ${studentDbId}
        AND qa.deleted_at IS NULL
      GROUP BY q.assessment_type
    `,
  )

  const empty = (): AssessmentReleaseCounts => ({ completed: 0, released: 0 })
  const out: Record<GradeCategoryKey, AssessmentReleaseCounts> = {
    quiz: empty(),
    homework: empty(),
    midterm: empty(),
    final: empty(),
    attendance: empty(),
    project: empty(),
    classroom: empty(),
    engagement: empty(),
  }

  for (const row of rows) {
    const t = String(row.assessment_type ?? "")
      .trim()
      .toLowerCase()
      .replace(/-/g, "_")
    const counts = { completed: Number(row.completed) || 0, released: Number(row.released) || 0 }
    if (t === "quiz") out.quiz = addCounts(out.quiz, counts)
    else if (t === "homework") out.homework = addCounts(out.homework, counts)
    else if (t === "mid_semester" || t === "midsem" || t === "midterm")
      out.midterm = addCounts(out.midterm, counts)
    else if (t === "final" || t === "finals" || t === "final_exam")
      out.final = addCounts(out.final, counts)
  }

  return out
}

function addCounts(a: AssessmentReleaseCounts, b: AssessmentReleaseCounts): AssessmentReleaseCounts {
  return { completed: a.completed + b.completed, released: a.released + b.released }
}

function releasedAssessmentCategoryStatus(counts: AssessmentReleaseCounts): GradeCategoryStatus {
  return counts.released > 0 ? "scored" : "pending"
}

function rawFromStudentGrade(grade: StudentGrade) {
  return {
    quizScore: Number(grade.quiz_score) || 0,
    homeworkScore: Number(grade.homework_score) || 0,
    midtermScore: Number(grade.midterm_score) || 0,
    finalScore: Number(grade.final_score) || 0,
    attendanceScore: Number(grade.attendance_score) || 0,
    projectScore: Number(grade.project_score) || 0,
    classroomScore: Number(grade.classroom_score) || 0,
    engagementCredits: Number(grade.engagement_credits) || 0,
    totalScore: Number(grade.total_score) || 0,
    letterGrade: grade.letter_grade != null ? String(grade.letter_grade) : null,
  }
}

function assessmentsFromTypes(types: string[]): AssessmentAttemptSummary[] {
  return types.map((assessmentType, i) => ({
    attemptId: i,
    title: assessmentType,
    assessmentType,
    completedAt: null,
    score: 0,
    totalPoints: 0,
    percentage: 0,
    feedbackHighlights: [],
    incorrectTopics: [],
  }))
}

export type StudentProvisionalGradePayload = {
  totalScore: number
  letterGrade: string | null
  gradeIsProvisional: boolean
  pendingCategories: string[]
  /** Assessment categories with submitted work awaiting instructor finalization. */
  categoriesUnderReview: string[]
  includedWeight: number
  contributions: {
    quiz: number
    homework: number
    midterm: number
    final: number
    attendance: number
    project: number
    classroom: number
    engagement: number
  }
  categoryStatus: ProgressReviewGradebook["categoryStatus"]
  scores: {
    quiz: number
    homework: number
    midterm: number
    final: number
    attendance: number
    project: number
    classroom: number
    engagement: number
  }
}

export function toStudentProvisionalGradePayload(
  gb: ProgressReviewGradebook & { categoriesUnderReview?: string[] },
): StudentProvisionalGradePayload {
  return {
    totalScore: gb.totalScore,
    letterGrade: gb.letterGrade,
    gradeIsProvisional: gb.gradeIsProvisional,
    pendingCategories: gb.pendingCategories,
    categoriesUnderReview: gb.categoriesUnderReview ?? [],
    includedWeight: gb.includedWeight,
    contributions: {
      quiz: gb.provisionalContributions.quiz ?? 0,
      homework: gb.provisionalContributions.homework ?? 0,
      midterm: gb.provisionalContributions.midterm ?? 0,
      final: gb.provisionalContributions.final ?? 0,
      attendance: gb.provisionalContributions.attendance ?? 0,
      project: gb.provisionalContributions.project ?? 0,
      classroom: gb.provisionalContributions.classroom ?? 0,
      engagement: gb.provisionalContributions.engagement ?? 0,
    },
    categoryStatus: gb.categoryStatus,
    scores: {
      quiz: gb.quizScore,
      homework: gb.homeworkScore,
      midterm: gb.midtermScore,
      final: gb.finalScore,
      attendance: gb.attendanceScore,
      project: gb.projectScore,
      classroom: gb.classroomScore,
      engagement: gb.engagementCredits,
    },
  }
}

export async function buildProvisionalGradeForStudent(
  studentDbId: number,
  grade: StudentGrade,
  sessionKey: string,
): Promise<StudentProvisionalGradePayload | null> {
  const sessionParam = sessionKey
  const [
    releaseCounts,
    releasedQuizScore,
    releasedHomeworkScore,
    releasedMidtermScore,
    releasedFinalScore,
    attemptTypeRows,
    classroomCountRows,
    attendanceSoFar,
  ] = await Promise.all([
    fetchAssessmentReleaseCounts(studentDbId),
    calculateQuizAverage(studentDbId, sessionParam, RELEASED_ONLY),
    calculateHomeworkAverage(studentDbId, sessionParam, RELEASED_ONLY),
    getMidtermScore(studentDbId, sessionParam, RELEASED_ONLY),
    getFinalScore(studentDbId, sessionParam, RELEASED_ONLY),
    sqlRows<{ assessment_type: string | null }>(
      await sql`
        SELECT DISTINCT q.assessment_type
        FROM quiz_attempts qa
        INNER JOIN quizzes q ON q.id = qa.quiz_id AND q.deleted_at IS NULL
        WHERE qa.student_id = ${studentDbId}
          AND qa.completed_at IS NOT NULL
          AND qa.deleted_at IS NULL
      `,
    ),
    sqlRows<{ cnt: number }>(
      await sql`
        SELECT COUNT(*)::int AS cnt
        FROM classroom_points cp
        WHERE cp.student_id = ${studentDbId}
      `,
    ),
    getStudentAttendanceSoFar(studentDbId, sessionKey),
  ])

  const raw = rawFromStudentGrade(grade)
  raw.quizScore = releasedQuizScore
  raw.homeworkScore = releasedHomeworkScore
  raw.midtermScore = releasedMidtermScore
  raw.finalScore = releasedFinalScore

  let practiceAttemptCount = 0
  try {
    const practiceCountRows = sqlRows<{ cnt: number }>(
      await sql`
        SELECT COUNT(*)::int AS cnt
        FROM practice_attempts pa
        WHERE pa.student_id = ${studentDbId}
          AND pa.completed_at IS NOT NULL
      `,
    )
    practiceAttemptCount = Number(practiceCountRows[0]?.cnt ?? 0)
  } catch {
    practiceAttemptCount = 0
  }

  if (attendanceSoFar.sessionsScoredSoFar > 0) {
    raw.attendanceScore = attendanceSoFar.percentage
  }

  const attemptTypes = attemptTypeRows
    .map((r) => String(r.assessment_type ?? "").trim())
    .filter(Boolean)

  const classroomPointCount = Number(classroomCountRows[0]?.cnt ?? 0)
  const assessments = assessmentsFromTypes(attemptTypes)

  const attendance: AttendanceSummary = {
    totalSessions: attendanceSoFar.sessionsScoredSoFar,
    scheduledSessionsTotal: attendanceSoFar.sessionsScheduledTotal,
    presentCount: attendanceSoFar.classesAttended,
    attendanceRate: attendanceSoFar.percentage,
    gradebookScore: attendanceSoFar.sessionsScoredSoFar > 0 ? attendanceSoFar.percentage : null,
    recentMissed: [],
  }
  const classroomPoints: ClassroomPointSummary[] = Array.from({ length: classroomPointCount }, () => ({
    points: 0,
    reason: null,
    category: null,
    awardedAt: null,
    status: "approved",
  }))
  const practiceHub: PracticeHubSummary = {
    totalAttempts: practiceAttemptCount,
    avgScore: 0,
    accuracy: 0,
    weakTopics: [],
    strongTopics: [],
    recentSessions: [],
  }

  const adjusted = await buildProgressReviewGradebook({
    raw,
    assessments,
    attendance,
    classroomPoints,
    practiceHub,
    sessionKey,
  })

  if (!adjusted) return null

  const categoryStatus: Record<GradeCategoryKey, GradeCategoryStatus> = {
    ...adjusted.categoryStatus,
    quiz: releasedAssessmentCategoryStatus(releaseCounts.quiz),
    homework: releasedAssessmentCategoryStatus(releaseCounts.homework),
    midterm: releasedAssessmentCategoryStatus(releaseCounts.midterm),
    final: releasedAssessmentCategoryStatus(releaseCounts.final),
  }

  const weights = await getGradeWeights(sessionParam)
  const provisional = computeProvisionalGrade(raw, categoryStatus, weights)

  const CATEGORY_LABELS: Record<GradeCategoryKey, string> = {
    quiz: "Quizzes",
    homework: "Homework",
    midterm: "Midterm",
    final: "Final",
    attendance: "Attendance",
    project: "Projects",
    classroom: "Classroom",
    engagement: "Engagement",
  }
  const categoriesUnderReview = (["quiz", "homework", "midterm", "final"] as GradeCategoryKey[])
    .filter((k) => releaseCounts[k].completed > 0 && releaseCounts[k].released === 0)
    .map((k) => CATEGORY_LABELS[k])

  return toStudentProvisionalGradePayload({
    ...adjusted,
    quizScore: raw.quizScore,
    homeworkScore: raw.homeworkScore,
    midtermScore: raw.midtermScore,
    finalScore: raw.finalScore,
    totalScore: provisional.totalScore,
    letterGrade: provisional.letterGrade,
    gradeIsProvisional: provisional.gradeIsProvisional,
    pendingCategories: provisional.pendingCategories,
    categoriesUnderReview,
    categoryStatus,
    provisionalContributions: {
      quiz: provisional.contributions.quiz,
      homework: provisional.contributions.homework,
      midterm: provisional.contributions.midterm,
      final: provisional.contributions.final,
      attendance: provisional.contributions.attendance,
      project: provisional.contributions.project,
      classroom: provisional.contributions.classroom,
      engagement: provisional.contributions.engagement,
    },
  })
}
