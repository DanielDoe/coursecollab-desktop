/**
 * Institution-facing AI usage report — shared by the platform-admin route and
 * the institution portal route. Grant/proposal-grade aggregates only: no
 * student identifiers, k-anonymity applied by the underlying metrics.
 */

import { sql } from "@/lib/db"
import { ensureCoraAiAccountingSchema } from "@/lib/cora/ai"
import {
  adoptionMetrics,
  costMetrics,
  engagementMetrics,
  featureMix,
  learningSupportMetrics,
  outcomesCorrelation,
} from "@/lib/cora/analytics/ai-usage-analytics"

export type InstitutionAiReportScope = {
  institutionId: number
  courseId?: number | null
  from?: string
  to?: string
}

type LowAdoptionCourse = {
  courseCode: string
  courseTitle: string
  adoptionRate: number
  activeStudents: number
}

function activeByRole(adoption: Awaited<ReturnType<typeof adoptionMetrics>>) {
  const student = adoption.byRole.find((row) => row.key === "student")?.activeUsers ?? 0
  const instructor = adoption.byRole.find((row) => row.key === "instructor")?.activeUsers ?? 0
  const admin = adoption.byRole.find((row) => row.key === "admin")?.activeUsers ?? 0
  const guest = adoption.byRole.find((row) => row.key === "guest")?.activeUsers ?? 0
  return { student, instructor, admin, guest }
}

function buildInstitutionRecommendations(input: {
  adoption: Awaited<ReturnType<typeof adoptionMetrics>>
  engagement: Awaited<ReturnType<typeof engagementMetrics>>
  featureMix: Awaited<ReturnType<typeof featureMix>>
  learningSupport: Awaited<ReturnType<typeof learningSupportMetrics>>
  outcomesCorrelation: Awaited<ReturnType<typeof outcomesCorrelation>>
  costMetrics: Awaited<ReturnType<typeof costMetrics>>
  lowAdoptionCourses: LowAdoptionCourse[]
}): string[] {
  const recommendations: string[] = []
  const byRole = activeByRole(input.adoption)
  const totalActiveUsers = Math.max(1, input.adoption.totalActiveUsers)
  const instructorShare = byRole.instructor / totalActiveUsers
  const studentShare = byRole.student / totalActiveUsers

  if (studentShare < 0.35) {
    recommendations.push(
      "Student adoption is still shallow relative to the covered population - launch a first-week activation campaign with practice, flashcards, and study-plan examples in the LMS.",
    )
  }

  if (instructorShare < 0.2 && byRole.instructor < 10) {
    recommendations.push(
      "Faculty adoption is thin - ask a few early adopters to model one Cora workflow in class and publish a short instructor playbook.",
    )
  }

  if (input.costMetrics.totals.cachedTokenSavingsRate < 15) {
    recommendations.push(
      "Cached-token savings are low - review prompt reuse, conversation persistence, and opportunities to route repeat lookups through cached paths.",
    )
  }

  const routingRows = input.costMetrics.byRoutingClass
  const advancedCost = routingRows
    .filter((row) => /advanced_reasoning|reasoning|agent/i.test(row.key))
    .reduce((sum, row) => sum + row.providerCostUsd, 0)
  if (advancedCost > 0 && advancedCost / Math.max(1, input.costMetrics.totals.providerCostUsd) >= 0.3) {
    recommendations.push(
      "Advanced reasoning is consuming a large share of spend - tighten routing thresholds for simpler student help requests and document when deep reasoning is actually needed.",
    )
  }

  if (input.learningSupport.studySupportShare < 45) {
    recommendations.push(
      "Only a minority of student AI usage is clearly study-supportive - nudge students toward practice, flashcards, notes, and study plans instead of generic chat.",
    )
  }

  const practiceRows = input.featureMix.byFeature.filter((row) => /practice|flashcard|study_plan|notetaker/i.test(row.key))
  if (practiceRows.reduce((sum, row) => sum + row.runs, 0) < input.learningSupport.studySupportRuns * 0.25) {
    recommendations.push(
      "Practice-oriented features are underused - surface them earlier in the course shell and link them from quiz and lecture pages.",
    )
  }

  const correlatedBuckets = input.outcomesCorrelation.buckets.filter(
    (bucket): bucket is Exclude<typeof bucket, { suppressed: true }> => !("suppressed" in bucket),
  )
  const heavy = correlatedBuckets.find((bucket) => bucket.key === "heavy")
  const light = correlatedBuckets.find((bucket) => bucket.key === "light")
  if (heavy && light && heavy.avgQuizPercent != null && light.avgQuizPercent != null && heavy.avgQuizPercent - light.avgQuizPercent >= 8) {
    recommendations.push(
      "Heavier AI users are outperforming light users in the same course window - expand the practice workflow and use that gain story in internal reporting.",
    )
  }

  for (const course of input.lowAdoptionCourses.slice(0, 3)) {
    recommendations.push(
      `${course.courseCode || course.courseTitle} has low AI adoption (${course.adoptionRate.toFixed(1)}% of students active) - target it with a faculty-facing demo and a student kickoff message.`,
    )
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Adoption, reliability, and costs are all within healthy ranges - keep monitoring the dashboard and use the next term to test a small activation campaign.",
    )
  }

  return recommendations
}

export async function buildInstitutionAiAnalyticsReport(scope: InstitutionAiReportScope) {
  await ensureCoraAiAccountingSchema()

  const analyticsScope = {
    institutionId: scope.institutionId,
    courseId: scope.courseId ?? null,
    from: scope.from,
    to: scope.to,
  }

  const [adoption, engagement, featureMixMetrics, learningSupport, outcomesCorrelationMetrics, costMetricsResult] =
    await Promise.all([
      adoptionMetrics(analyticsScope),
      engagementMetrics(analyticsScope),
      featureMix(analyticsScope),
      learningSupportMetrics(analyticsScope),
      outcomesCorrelation(analyticsScope),
      costMetrics(analyticsScope),
    ])

  const lowAdoptionRows = scope.courseId
    ? []
    : ((await sql`
        SELECT
          c.course_code AS course_code,
          c.course_title AS course_title,
          COUNT(DISTINCT st.id)::int AS active_students,
          COUNT(DISTINCT u.user_id)::int AS active_ai_students,
          CASE
            WHEN COUNT(DISTINCT st.id) = 0 THEN 0
            ELSE ROUND(COUNT(DISTINCT u.user_id)::numeric / COUNT(DISTINCT st.id) * 100, 1)
          END AS adoption_rate
        FROM courses c
        JOIN students st ON st.course_id = c.id AND st.deleted_at IS NULL
        LEFT JOIN cora_usage_events u
          ON u.user_role = 'student'
         AND u.course_id = c.id
         AND u.created_at >= ${adoption.range.from}::date
         AND u.created_at < (${adoption.range.to}::date + INTERVAL '1 day')
        WHERE c.university_id = ${scope.institutionId}
        GROUP BY c.id, c.course_code, c.course_title
        HAVING COUNT(DISTINCT st.id) >= 5
        ORDER BY adoption_rate ASC, active_students DESC
        LIMIT 5
      `) as Array<Record<string, unknown>>)

  const lowAdoptionCourses: LowAdoptionCourse[] = lowAdoptionRows.map((row) => ({
    courseCode: String(row.course_code ?? ""),
    courseTitle: String(row.course_title ?? ""),
    activeStudents: Number(row.active_students ?? 0),
    adoptionRate: Number(row.adoption_rate ?? 0),
  }))

  const roleCounts = activeByRole(adoption)
  const totalActiveUsers = Math.max(1, adoption.totalActiveUsers)
  const activeStudentUsers = roleCounts.student
  const activeInstructorUsers = roleCounts.instructor

  const recommendations = buildInstitutionRecommendations({
    adoption,
    engagement,
    featureMix: featureMixMetrics,
    learningSupport,
    outcomesCorrelation: outcomesCorrelationMetrics,
    costMetrics: costMetricsResult,
    lowAdoptionCourses,
  })

  const studentCostPerStudentServed =
    activeStudentUsers > 0 ? costMetricsResult.totals.providerCostUsd / activeStudentUsers : 0

  return {
    generatedAt: new Date().toISOString(),
    scope: {
      institutionId: scope.institutionId,
      courseId: scope.courseId ?? null,
    },
    adoption,
    engagement,
    featureMix: featureMixMetrics,
    learningSupport,
    outcomesCorrelation: outcomesCorrelationMetrics,
    costMetrics: costMetricsResult,
    facultyAdoption: {
      activeInstructors: activeInstructorUsers,
      instructorShareOfActiveUsers: Math.round((activeInstructorUsers / totalActiveUsers) * 1000) / 10,
      roleBreakdown: adoption.byRole,
    },
    roi: {
      estimatedTutoringHoursReplaced: Math.round(learningSupport.studySupportRuns * 0.15 * 10) / 10,
      tutoringHoursAssumption:
        "Each study-support AI run is treated as 0.15 tutoring-equivalent hours for grant-facing ROI estimates.",
      costPerStudentServed: Math.round(studentCostPerStudentServed * 100) / 100,
    },
    platformReliability: {
      successRate: engagement.successRate,
      p95LatencyMs: engagement.latencyP95Ms,
      p50LatencyMs: engagement.latencyP50Ms,
    },
    recommendations,
  }
}

/** True when the course belongs to the institution (cross-tenant guard for course filters). */
export async function courseBelongsToInstitution(
  courseId: number,
  institutionId: number,
): Promise<boolean> {
  const rows = (await sql`
    SELECT 1 AS ok FROM courses
    WHERE id = ${courseId} AND university_id = ${institutionId}
    LIMIT 1
  `) as Array<{ ok: number }>
  return rows.length > 0
}
