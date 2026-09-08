import { sql } from "@/lib/db"
import { SURVEY_OTHER_OPTION } from "@/lib/course-evaluation-survey"
import {
  COURSE_EVALUATION_SESSION_JOIN,
  courseEvaluationCourseAndClause,
} from "@/lib/course-evaluation-course-scope"

export type CourseEvaluationAnalytics = {
  totals: {
    all: number
    pending: number
    approved: number
    rejected: number
  }
  averages: {
    overallExperience: number | null
    platformHelpfulness: number | null
    instructorClarity: number | null
    nps: number | null
  }
  nps: {
    responses: number
    score: number | null
    promoters: number
    passives: number
    detractors: number
  }
  ratingDistribution: Record<string, number>
  platformDistribution: Record<string, number>
  favoriteFeatureCounts: Array<{ feature: string; count: number }>
  improveFeatureCounts: Array<{ feature: string; count: number }>
  workloadCounts: Array<{ label: string; count: number }>
  aiTutorUsageCounts: Array<{ label: string; count: number }>
  passGoalCounts: Array<{ grade: string; count: number }>
  passGoalMismatchCount: number
  approvalRate: number | null
}

type AnalyticsRow = {
  course_rating: number | null
  platform_helpfulness: number | null
  instructor_clarity: number | null
  nps_score: number | null
  status: string
  favorite_features: unknown
  feature_to_improve: string | null
  feature_to_improve_other: string | null
  workload: string | null
  ai_tutor_usage: string | null
  self_assessed_letter_grade: string | null
  actual_letter_grade: string | null
}

function parseFavoriteFeatures(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) return parsed.map(String)
    } catch {
      return []
    }
  }
  return []
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
}

function bump(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1
}

function topCounts(map: Record<string, number>, limit = 8) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([feature, count]) => ({ feature, count }))
}

export async function computeCourseEvaluationAnalytics(
  session?: string,
  opts?: { courseId?: number | null; courseCode?: string | null },
): Promise<CourseEvaluationAnalytics> {
  const sessionTrim = (session ?? "all").trim()
  const courseId = opts?.courseId != null && Number.isFinite(opts.courseId) ? opts.courseId : null
  const courseCode = String(opts?.courseCode ?? "").trim()
  const courseClause = courseEvaluationCourseAndClause(courseId, courseCode)

  let rows: AnalyticsRow[]
  if (!sessionTrim || sessionTrim === "all") {
    rows = (await sql`
      SELECT ce.course_rating, ce.platform_helpfulness, ce.instructor_clarity, ce.nps_score,
             ce.status, ce.favorite_features, ce.feature_to_improve, ce.feature_to_improve_other,
             ce.workload, ce.ai_tutor_usage, ce.self_assessed_letter_grade,
             sg.letter_grade AS actual_letter_grade
      FROM course_evaluations ce
      JOIN students s ON s.id = ce.student_id
      ${COURSE_EVALUATION_SESSION_JOIN}
      LEFT JOIN LATERAL (
        SELECT sg.letter_grade
        FROM student_grades sg
        WHERE sg.student_id = ce.student_id
        ORDER BY
          CASE WHEN sg.session = ce.session THEN 0 WHEN sg.session = s.section THEN 1 ELSE 2 END,
          sg.last_calculated_at DESC NULLS LAST
        LIMIT 1
      ) sg ON true
      WHERE TRUE
        ${courseClause}
    `) as AnalyticsRow[]
  } else {
    rows = (await sql`
      SELECT ce.course_rating, ce.platform_helpfulness, ce.instructor_clarity, ce.nps_score,
             ce.status, ce.favorite_features, ce.feature_to_improve, ce.feature_to_improve_other,
             ce.workload, ce.ai_tutor_usage, ce.self_assessed_letter_grade,
             sg.letter_grade AS actual_letter_grade
      FROM course_evaluations ce
      JOIN students s ON s.id = ce.student_id
      ${COURSE_EVALUATION_SESSION_JOIN}
      LEFT JOIN LATERAL (
        SELECT sg.letter_grade
        FROM student_grades sg
        WHERE sg.student_id = ce.student_id
        ORDER BY
          CASE WHEN sg.session = ce.session THEN 0 WHEN sg.session = s.section THEN 1 ELSE 2 END,
          sg.last_calculated_at DESC NULLS LAST
        LIMIT 1
      ) sg ON true
      WHERE (ce.session = ${sessionTrim} OR s.section = ${sessionTrim})
        ${courseClause}
    `) as AnalyticsRow[]
  }

  const totals = { all: rows.length, pending: 0, approved: 0, rejected: 0 }
  const overallScores: number[] = []
  const platformScores: number[] = []
  const clarityScores: number[] = []
  const npsScores: number[] = []
  const ratingDistribution: Record<string, number> = {}
  const platformDistribution: Record<string, number> = {}
  const favoriteMap: Record<string, number> = {}
  const improveMap: Record<string, number> = {}
  const workloadMap: Record<string, number> = {}
  const aiTutorMap: Record<string, number> = {}
  const passGoalMap: Record<string, number> = {}
  let passGoalMismatchCount = 0
  let promoters = 0
  let passives = 0
  let detractors = 0

  for (const row of rows) {
    if (row.status === "pending") totals.pending++
    else if (row.status === "approved") totals.approved++
    else if (row.status === "rejected") totals.rejected++

    if (row.course_rating != null) {
      overallScores.push(Number(row.course_rating))
      bump(ratingDistribution, String(row.course_rating))
    }
    if (row.platform_helpfulness != null) {
      platformScores.push(Number(row.platform_helpfulness))
      bump(platformDistribution, String(row.platform_helpfulness))
    }
    if (row.instructor_clarity != null) clarityScores.push(Number(row.instructor_clarity))

    if (row.nps_score != null) {
      const n = Number(row.nps_score)
      npsScores.push(n)
      if (n >= 9) promoters++
      else if (n >= 7) passives++
      else detractors++
    }

    for (const f of parseFavoriteFeatures(row.favorite_features)) {
      bump(favoriteMap, f)
    }

    if (row.feature_to_improve) {
      const label =
        row.feature_to_improve === SURVEY_OTHER_OPTION && row.feature_to_improve_other?.trim()
          ? `Other — ${row.feature_to_improve_other.trim()}`
          : row.feature_to_improve
      bump(improveMap, label)
    }

    if (row.workload) bump(workloadMap, row.workload)
    if (row.ai_tutor_usage) bump(aiTutorMap, row.ai_tutor_usage)

    if (row.self_assessed_letter_grade) {
      bump(passGoalMap, row.self_assessed_letter_grade)
      if (
        row.actual_letter_grade &&
        row.self_assessed_letter_grade.trim().toUpperCase() !== row.actual_letter_grade.trim().toUpperCase()
      ) {
        passGoalMismatchCount++
      }
    }
  }

  const reviewed = totals.approved + totals.rejected
  const npsResponses = npsScores.length
  const npsScore =
    npsResponses > 0
      ? Math.round(((promoters / npsResponses) - (detractors / npsResponses)) * 100)
      : null

  return {
    totals,
    averages: {
      overallExperience: avg(overallScores),
      platformHelpfulness: avg(platformScores),
      instructorClarity: avg(clarityScores),
      nps: avg(npsScores),
    },
    nps: { responses: npsResponses, score: npsScore, promoters, passives, detractors },
    ratingDistribution,
    platformDistribution,
    favoriteFeatureCounts: topCounts(favoriteMap),
    improveFeatureCounts: topCounts(improveMap),
    workloadCounts: topCounts(workloadMap, 10).map(({ feature, count }) => ({ label: feature, count })),
    aiTutorUsageCounts: topCounts(aiTutorMap, 10).map(({ feature, count }) => ({ label: feature, count })),
    passGoalCounts: topCounts(passGoalMap, 10).map(({ feature, count }) => ({ grade: feature, count })),
    passGoalMismatchCount,
    approvalRate: reviewed > 0 ? Math.round((totals.approved / reviewed) * 100) : null,
  }
}
