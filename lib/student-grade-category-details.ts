import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { getAttemptDisplayGradesBatch } from "@/lib/attempt-grade-display"
import { calculateEngagementCredits } from "@/lib/grades"
import { normalizeSessionForStorage } from "@/lib/session-catalog"
import { getStudentAttendanceSoFar } from "@/lib/attendance-percentage"
import { isStudentAssessmentGradeReleased } from "@/lib/student-grade-visibility"
import { studentAssessmentResultsHref } from "@/lib/student-assessment-hub"

export type GradeCategoryKey =
  | "quiz"
  | "homework"
  | "midterm"
  | "final"
  | "attendance"
  | "project"
  | "classroom"
  | "engagement"

export type GradeCategoryDetailItem = {
  id: string
  title: string
  subtitle?: string | null
  scoreLabel?: string | null
  status?: string | null
  date?: string | null
}

export type GradeCategoryDetailsPayload = {
  category: GradeCategoryKey
  categoryLabel: string
  summary?: string | null
  items: GradeCategoryDetailItem[]
}

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

const ASSESSMENT_TYPES: Partial<Record<GradeCategoryKey, string[]>> = {
  quiz: ["quiz"],
  homework: ["homework"],
  midterm: ["mid_semester", "midsem", "midterm"],
  final: ["final", "finals", "final_exam"],
}

function normType(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/-/g, "_")
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function matchesAssessmentCategory(assessmentType: string, category: GradeCategoryKey): boolean {
  const types = ASSESSMENT_TYPES[category]
  if (!types) return false
  const t = normType(assessmentType)
  return types.some((x) => normType(x) === t)
}

async function fetchAssessmentDetails(
  studentDbId: number,
  category: GradeCategoryKey,
): Promise<GradeCategoryDetailsPayload> {
  const rows = sqlRows<{
    quiz_id: number
    title: string | null
    assessment_type: string | null
    attempt_id: number
    completed_at: string | null
    results_finalized_at: string | null
    violation_log: unknown
  }>(
    await sql`
      SELECT
        q.id AS quiz_id,
        q.title,
        q.assessment_type,
        qa.id AS attempt_id,
        qa.completed_at,
        qa.results_finalized_at,
        qa.violation_log
      FROM quiz_attempts qa
      INNER JOIN quizzes q ON q.id = qa.quiz_id AND q.deleted_at IS NULL
      WHERE qa.student_id = ${studentDbId}
        AND qa.completed_at IS NOT NULL
        AND qa.deleted_at IS NULL
      ORDER BY qa.completed_at DESC
      LIMIT 200
    `,
  )

  const filtered = rows.filter((r) => matchesAssessmentCategory(String(r.assessment_type ?? ""), category))
  const attemptIds = filtered.map((r) => r.attempt_id)
  const grades = await getAttemptDisplayGradesBatch(attemptIds)

  const bestByQuiz = new Map<
    number,
    (typeof filtered)[number] & { percentage: number; scoreLabel: string; status: string; gradeReleased: boolean }
  >()
  for (const row of filtered) {
    const shouldShowPnd =
      Array.isArray(row.violation_log) &&
      row.violation_log.some(
        (e: { type?: string }) => e?.type === "score_pending" || e?.type === "evaluation_failed",
      )
    const gradeReleased = isStudentAssessmentGradeReleased({
      completed_at: row.completed_at,
      results_finalized_at: row.results_finalized_at,
      should_show_pnd: shouldShowPnd,
    })
    const grade = grades.get(row.attempt_id)
    const percentage = gradeReleased ? (grade?.percentage ?? 0) : 0
    const existing = bestByQuiz.get(row.quiz_id)
    if (!existing || (gradeReleased && percentage > existing.percentage)) {
      bestByQuiz.set(row.quiz_id, {
        ...row,
        percentage,
        gradeReleased,
        scoreLabel: gradeReleased && grade ? `${grade.percentage.toFixed(1)}%` : "Under review",
        status: gradeReleased ? "finalized" : "under_review",
      })
    } else if (!existing.gradeReleased && gradeReleased) {
      bestByQuiz.set(row.quiz_id, {
        ...row,
        percentage,
        gradeReleased,
        scoreLabel: grade ? `${grade.percentage.toFixed(1)}%` : "Under review",
        status: "finalized",
      })
    }
  }

  const items = [...bestByQuiz.values()]
    .sort((a, b) => {
      const ad = a.completed_at ? new Date(a.completed_at).getTime() : 0
      const bd = b.completed_at ? new Date(b.completed_at).getTime() : 0
      return bd - ad
    })
    .map((row) => ({
      id: String(row.quiz_id),
      title: row.title?.trim() || "Untitled assessment",
      subtitle: formatDate(row.completed_at),
      scoreLabel: row.scoreLabel,
      status: row.status,
      date: row.completed_at,
    }))

  const finalizedCount = items.filter((i) => i.status === "finalized").length
  const underReviewCount = items.filter((i) => i.status === "under_review").length

  return {
    category,
    categoryLabel: CATEGORY_LABELS[category],
    summary:
      items.length > 0
        ? underReviewCount > 0
          ? `${finalizedCount} finalized · ${underReviewCount} under review`
          : `${items.length} finalized assessment${items.length === 1 ? "" : "s"}`
        : "No completed assessments yet.",
    items,
  }
}

async function fetchAttendanceDetails(
  studentDbId: number,
  sessionKey: string,
): Promise<GradeCategoryDetailsPayload> {
  const stats = await getStudentAttendanceSoFar(studentDbId, sessionKey)

  const rows = sqlRows<{
    id: number
    status: string | null
    points_earned: number | null
    class_title: string | null
    start_time: string | null
  }>(
    await sql`
      SELECT
        ar.id,
        ar.status,
        ar.points_earned,
        asess.class_title,
        asess.start_time
      FROM attendance_records ar
      INNER JOIN attendance_sessions asess ON ar.session_id = asess.id
      WHERE ar.student_id = ${studentDbId}
        AND asess.start_time <= NOW()
        AND ar.deleted_at IS NULL
      ORDER BY asess.start_time DESC
      LIMIT 100
    `,
  )

  const items = rows.map((r) => ({
    id: String(r.id),
    title: r.class_title?.trim() || "Class session",
    subtitle: formatDate(r.start_time),
    scoreLabel:
      r.points_earned != null
        ? `${Number(r.points_earned).toFixed(1)} pts`
        : r.status === "present"
          ? "Present"
          : r.status === "late"
            ? "Late"
            : r.status === "excused"
              ? "Excused"
              : "Absent",
    status: r.status,
    date: r.start_time,
  }))

  return {
    category: "attendance",
    categoryLabel: CATEGORY_LABELS.attendance,
    summary: `${stats.classesAttended} of ${stats.sessionsScoredSoFar} marked sessions (${stats.percentage.toFixed(1)}%)`,
    items,
  }
}

async function fetchProjectDetails(
  studentDbId: number,
  sessionKey: string,
): Promise<GradeCategoryDetailsPayload> {
  const rows = sqlRows<{
    project_id: number
    title: string | null
    group_name: string | null
    score_0_50: number | null
  }>(
    await sql`
      SELECT
        p.id AS project_id,
        p.title,
        g.name AS group_name,
        COALESCE(pmo.score_0_50, ps.total_score)::float AS score_0_50
      FROM projects p
      INNER JOIN project_scores ps ON p.id = ps.project_id
      INNER JOIN groups g ON p.group_id = g.id
      INNER JOIN group_members gm ON g.id = gm.group_id
      LEFT JOIN project_member_score_overrides pmo
        ON pmo.project_id = p.id AND pmo.student_id = gm.student_id
      WHERE gm.student_id = ${studentDbId}
        AND g.session = ${sessionKey}
      ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC
      LIMIT 50
    `,
  )

  const items = rows.map((r) => {
    const score = Number(r.score_0_50) || 0
    const pct = Math.min((score / 50) * 100, 100)
    return {
      id: String(r.project_id),
      title: r.title?.trim() || "Project",
      subtitle: r.group_name ? `Group: ${r.group_name}` : null,
      scoreLabel: `${pct.toFixed(1)}% (${score.toFixed(1)}/50)`,
      status: "scored",
      date: null,
    }
  })

  return {
    category: "project",
    categoryLabel: CATEGORY_LABELS.project,
    summary: items.length > 0 ? `${items.length} scored project${items.length === 1 ? "" : "s"}` : "No project scores yet.",
    items,
  }
}

async function fetchClassroomDetails(studentDbId: number): Promise<GradeCategoryDetailsPayload> {
  const rows = sqlRows<{
    id: number
    points: number | null
    reason: string | null
    category: string | null
    status: string | null
    awarded_at: string | null
  }>(
    await sql`
      SELECT
        cp.id,
        cp.points,
        cp.reason,
        cp.category,
        cp.status,
        COALESCE(cp.awarded_at, cp.created_at) AS awarded_at
      FROM classroom_points cp
      WHERE cp.student_id = ${studentDbId}
      ORDER BY COALESCE(cp.awarded_at, cp.created_at) DESC NULLS LAST
      LIMIT 50
    `,
  )

  const items = rows.map((r) => ({
    id: String(r.id),
    title: r.reason?.trim() || r.category?.trim() || "Classroom points",
    subtitle: r.category?.trim() || null,
    scoreLabel: r.points != null ? `${Number(r.points).toFixed(1)} pts` : null,
    status: r.status,
    date: r.awarded_at,
  }))

  const approvedTotal = rows
    .filter((r) => !r.status || r.status === "approved")
    .reduce((sum, r) => sum + (Number(r.points) || 0), 0)

  return {
    category: "classroom",
    categoryLabel: CATEGORY_LABELS.classroom,
    summary: `${items.length} entries · ${approvedTotal.toFixed(1)} approved points`,
    items,
  }
}

async function fetchEngagementDetails(
  studentDbId: number,
  session: string,
): Promise<GradeCategoryDetailsPayload> {
  const credits = await calculateEngagementCredits(studentDbId, session)
  const items: GradeCategoryDetailItem[] = [
    {
      id: "practice_hub",
      title: "Practice Hub",
      scoreLabel: `${Number(credits.practice_hub_credits ?? 0).toFixed(1)} cr`,
    },
    {
      id: "playground",
      title: "Playground",
      scoreLabel: `${Number(credits.playground_credits ?? 0).toFixed(1)} cr`,
    },
    {
      id: "lecture_reading",
      title: "Lecture reading",
      scoreLabel: `${Number(credits.lecture_reading_credits ?? 0).toFixed(1)} cr`,
    },
    {
      id: "syllabus",
      title: "Syllabus review",
      scoreLabel: `${Number(credits.syllabus_credits ?? 0).toFixed(1)} cr`,
    },
  ].filter((item) => {
    const n = parseFloat(String(item.scoreLabel))
    return Number.isFinite(n) && n > 0
  })

  return {
    category: "engagement",
    categoryLabel: CATEGORY_LABELS.engagement,
    summary: `${Number(credits.total_credits ?? 0).toFixed(1)} total credits (max 100)`,
    items,
  }
}

export async function fetchStudentGradeCategoryDetails(input: {
  studentDbId: number
  session: string
  category: GradeCategoryKey
}): Promise<GradeCategoryDetailsPayload> {
  const sessionKey = await normalizeSessionForStorage(input.session)

  if (ASSESSMENT_TYPES[input.category]) {
    return fetchAssessmentDetails(input.studentDbId, input.category)
  }

  switch (input.category) {
    case "attendance":
      return fetchAttendanceDetails(input.studentDbId, sessionKey)
    case "project":
      return fetchProjectDetails(input.studentDbId, sessionKey)
    case "classroom":
      return fetchClassroomDetails(input.studentDbId)
    case "engagement":
      return fetchEngagementDetails(input.studentDbId, input.session)
    default:
      return {
        category: input.category,
        categoryLabel: CATEGORY_LABELS[input.category] ?? input.category,
        summary: null,
        items: [],
      }
  }
}

export function parseGradeCategoryKey(value: string | null): GradeCategoryKey | null {
  const key = String(value ?? "")
    .trim()
    .toLowerCase() as GradeCategoryKey
  if (key in CATEGORY_LABELS) return key
  return null
}

export type AwaitingReviewAssessment = {
  quizId: number
  attemptId: number
  title: string
  assessmentType: string
  completedAt: string | null
  resultsHref: string
}

/** Submitted assessments whose scores are not yet released to students. */
export async function fetchAwaitingReviewAssessments(
  studentDbId: number,
): Promise<AwaitingReviewAssessment[]> {
  const rows = sqlRows<{
    quiz_id: number
    attempt_id: number
    title: string | null
    assessment_type: string | null
    completed_at: string | null
    results_finalized_at: string | null
    violation_log: unknown
  }>(
    await sql`
      SELECT
        q.id AS quiz_id,
        qa.id AS attempt_id,
        q.title,
        q.assessment_type,
        qa.completed_at,
        qa.results_finalized_at,
        qa.violation_log
      FROM quiz_attempts qa
      INNER JOIN quizzes q ON q.id = qa.quiz_id AND q.deleted_at IS NULL
      WHERE qa.student_id = ${studentDbId}
        AND qa.completed_at IS NOT NULL
        AND qa.deleted_at IS NULL
      ORDER BY qa.completed_at DESC
      LIMIT 100
    `,
  )

  const out: AwaitingReviewAssessment[] = []
  const seenQuiz = new Set<number>()

  for (const row of rows) {
    if (seenQuiz.has(row.quiz_id)) continue
    const shouldShowPnd =
      Array.isArray(row.violation_log) &&
      row.violation_log.some(
        (e: { type?: string }) => e?.type === "score_pending" || e?.type === "evaluation_failed",
      )
    const gradeReleased = isStudentAssessmentGradeReleased({
      completed_at: row.completed_at,
      results_finalized_at: row.results_finalized_at,
      should_show_pnd: shouldShowPnd,
    })
    if (gradeReleased) {
      seenQuiz.add(row.quiz_id)
      continue
    }
    seenQuiz.add(row.quiz_id)
    const t = normType(String(row.assessment_type ?? "quiz"))
    const resultsHref = studentAssessmentResultsHref(row.attempt_id, t)

    out.push({
      quizId: row.quiz_id,
      attemptId: row.attempt_id,
      title: row.title?.trim() || "Assessment",
      assessmentType: t,
      completedAt: row.completed_at,
      resultsHref,
    })
  }

  return out
}
