import { sql } from "@/lib/db"
import type { InstitutionAdminRole } from "@/lib/institutions/auth"
import { getInstitutionDashboardMetrics } from "@/lib/institutions/metrics/dashboard"
import {
  countActiveStudentsInPeriod,
  getCourseHealthRows,
  getFeatureAdoption,
  getGradingAutomationMetrics,
  getWeeklyAcademicActivity,
  getWeeklyStudentEngagement,
  estimateHoursSaved,
} from "@/lib/institutions/metrics/queries"
import {
  getAiOutcomeLinkage,
  getAssessmentAnalyticsExtra,
  getConceptAnalytics,
  getCoraAssistanceAnalytics,
  getPracticeAnalytics,
} from "@/lib/institutions/metrics/phase2"
import {
  getAssistanceEscalation,
  getAiRelianceMetrics,
  getClassifiedAssistanceAnalytics,
  getFeedbackAnalytics,
  getTemporalAiPatterns,
} from "@/lib/institutions/metrics/phase4"
import {
  getBehavioralIndicators,
  getIndependentAnalytics,
  getInterventionAnalytics,
  getLearningTrajectories,
  getTransferAnalytics,
} from "@/lib/institutions/metrics/phase3"
import {
  getDelayedTransferWindows,
  getLearningPathways,
  getLongitudinalAnalytics,
  getPredictiveModelStatus,
} from "@/lib/institutions/metrics/phase5"
import { getEndGoalAnswers } from "@/lib/institutions/metrics/end-goal"
import { resolveInstitutionScope } from "@/lib/institutions/metrics/scope"
import { getInstitutionDataQuality } from "@/lib/institutions/metrics/data-quality"
import { canViewStudentLevelAnalytics } from "@/lib/institutions/metrics/scope"
import { MIN_CELL_SIZE } from "@/lib/institutions/research/capability-catalog"
import type {
  AnalyticsTab,
  InstitutionAnalyticsMetrics,
  InstitutionMetricFilters,
  MetricValue,
} from "@/lib/institutions/metrics/types"
import { getHybridOverviewCounts, getInterventionOverviewKpis } from "@/lib/institutions/metrics/event-kpis"
import { getPrePostGainAnalytics } from "@/lib/institutions/research/pre-post-gain"
import { getSurveyConstructAnalytics } from "@/lib/institutions/research/survey-constructs"
import { getEquitySubgroupAnalytics } from "@/lib/institutions/research/equity-subgroups"
import { getInstitutionInsights } from "@/lib/institutions/insights"

export async function getInstitutionAnalyticsMetrics(
  institutionId: number,
  role: InstitutionAdminRole,
  tab: AnalyticsTab,
  filters: Partial<InstitutionMetricFilters> = {},
): Promise<InstitutionAnalyticsMetrics | null> {
  const dashboard = await getInstitutionDashboardMetrics(institutionId, role, filters)
  if (!dashboard) return null

  const scope = await resolveInstitutionScope(institutionId, filters)
  if (!scope) return null

  const base: InstitutionAnalyticsMetrics = {
    generatedAt: dashboard.generatedAt,
    filters: dashboard.filters,
    role,
    tab,
  }

  if (tab === "overview") {
    const orgRows =
      scope.courseIds.length > 0 && scope.licenseId
        ? await sql`
            SELECT COALESCE(ou.name, 'Unassigned') AS name, COUNT(DISTINCT st.id)::int AS value
            FROM students st
            JOIN courses c ON c.id = st.course_id
            LEFT JOIN institution_license_scopes s ON s.course_id = c.id AND s.license_id = ${scope.licenseId}
            LEFT JOIN organization_units ou ON ou.id = s.organization_unit_id
            WHERE c.id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
              AND EXISTS (
                SELECT 1 FROM quiz_attempts qa WHERE qa.student_id = st.id AND qa.deleted_at IS NULL
                  AND COALESCE(qa.started_at, qa.completed_at)::date >= ${scope.from}::date
              )
            GROUP BY 1 ORDER BY 2 DESC LIMIT 10
          `
        : []

    const roster = dashboard.licenseUtilization.currentActiveLearners
    const funnel = [
      { key: "roster", name: "Covered roster", value: roster },
      { key: "activated", name: "Activated (activity)", value: dashboard.kpis.activeStudents.value as number },
      { key: "active_term", name: "Active this period", value: dashboard.kpis.activeStudents.value as number },
      { key: "repeat", name: "Repeat users", value: Math.min(roster, dashboard.kpis.activeStudents.value as number) },
    ]

    const hybrid = await getHybridOverviewCounts(scope)
    const interventionKpis = await getInterventionOverviewKpis(scope, institutionId)
    const prePost = await getPrePostGainAnalytics(scope, institutionId)

    const extraRows =
      scope.courseIds.length > 0
        ? await Promise.all([
            sql`SELECT COUNT(*)::int AS n FROM students st WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL`.catch(() => [{ n: 0 }]),
            sql`
              SELECT
                ROUND(AVG(qa.score::float)::numeric, 1) AS avg_score,
                ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY qa.score::float))::numeric, 1) AS median_score
              FROM quiz_attempts qa
              JOIN students st ON st.id = qa.student_id
              WHERE st.course_id = ANY(${scope.courseIds}) AND qa.deleted_at IS NULL AND qa.completed_at IS NOT NULL
                AND qa.completed_at::date >= ${scope.from}::date AND qa.completed_at::date <= ${scope.to}::date
            `.catch(() => [{ avg_score: null, median_score: null }]),
          ])
        : []
    const x = {
      covered: extraRows[0]?.[0]?.n,
      practice_attempts: hybrid.practiceAttempts,
      assessments: hybrid.assessmentsSubmitted,
      ai_students: hybrid.aiAssistedStudents,
      avg_score: extraRows[1]?.[0]?.avg_score,
      median_score: extraRows[1]?.[0]?.median_score,
      metric_source: hybrid.source,
    }
    const attentionN = dashboard.studentsNeedingAttention.available
      ? dashboard.studentsNeedingAttention.rows.length
      : dashboard.studentsNeedingAttention.aggregateOnly?.inactiveCount ?? 0

    const insufficient = (label: string, reason: string, definitionId?: MetricValue["definitionId"]): MetricValue => ({
      value: 0,
      label,
      insufficientData: true,
      unavailableReason: reason,
      definitionId,
    })

    base.overview = {
      kpis: {
        studentsCovered: { value: Number(x.covered ?? roster), label: "Students covered" },
        activeStudents: dashboard.kpis.activeStudents,
        activeCourses: { value: dashboard.kpis.courseActivity.value as number, label: "Courses covered" },
        aiAssistedStudents: { value: Number(x.ai_students ?? 0), label: "AI assisted students" },
        aiAssistedSessions: dashboard.kpis.coraWorkflows,
        practiceAttempts: { value: Number(x.practice_attempts ?? 0), label: "Practice attempts" },
        assessmentsSubmitted: { value: Number(x.assessments ?? 0), label: "Assessments submitted" },
        automatedFeedback: dashboard.kpis.automatedSubmissions,
        studentsNeedingAttention: { value: attentionN, label: "Students needing attention" },
        interventionsDelivered: {
          value: interventionKpis.delivered,
          label: "Interventions delivered",
          unavailableReason: interventionKpis.delivered === 0 ? "No delivered interventions in period." : undefined,
          insufficientData: interventionKpis.delivered === 0,
        },
        interventionResponse:
          interventionKpis.responseRate != null
            ? {
                value: interventionKpis.responseRate,
                label: "Intervention response rate (%)",
              }
            : insufficient(
                "Intervention response rate",
                "Requires delivered interventions with engagement in the selected period.",
              ),
        medianFeedbackLatency: {
          value: dashboard.assessmentAutomation.medianGradingLatencySec,
          label: "Median feedback latency (sec)",
          insufficientData: dashboard.assessmentAutomation.medianGradingLatencySec == null,
          unavailableReason:
            dashboard.assessmentAutomation.medianGradingLatencySec == null
              ? "Feedback timestamps are not complete enough to compute latency."
              : undefined,
        },
        independentAttempts: insufficient(
          "Independent assessment attempts",
          "To enable this metric, tag assessments as independent and collect at least two linked observations per learner.",
          "independentPerformance",
        ),
      },
      outcomeKpis: {
        avgAssessmentScore: {
          value: x.avg_score != null ? Number(x.avg_score) : null,
          label: "Average assessment score",
          insufficientData: x.avg_score == null,
          unavailableReason: x.avg_score == null ? "No graded quiz attempts in this period." : undefined,
        },
        medianAssessmentScore: {
          value: x.median_score != null ? Number(x.median_score) : null,
          label: "Median assessment score",
          insufficientData: x.median_score == null,
          unavailableReason: x.median_score == null ? "No graded quiz attempts in this period." : undefined,
        },
        practiceMastery: dashboard.studentLearning.avgPracticeAccuracy,
        independentPerformance: insufficient(
          "Independent performance",
          "To enable this metric, tag assessments as independent and collect at least two linked observations per learner.",
          "independentPerformance",
        ),
        aiAssistedPerformance: insufficient(
          "AI assisted performance",
          "Requires assessments or practice linked to a recorded Cora session.",
          "aiAssistedPerformance",
        ),
        transferScore: insufficient(
          "AI to independent transfer",
          "Requires a later independent assessment on the same concept after AI-assisted practice.",
          "transferScore",
        ),
        prePostGain: prePost.available
          ? {
              value: prePost.meanGain ?? 0,
              label: "Pre/post learning gain",
              sampleSize: prePost.pairedN,
            }
          : insufficient(
              "Pre/post learning gain",
              prePost.note,
            ),
        normalizedGain: prePost.available && prePost.normalizedGain != null
          ? { value: prePost.normalizedGain, label: "Normalized learning gain", sampleSize: prePost.pairedN }
          : insufficient(
              "Normalized learning gain",
              prePost.available ? "Could not compute normalized gain for this instrument pair." : prePost.note,
            ),
      },
      activeUsersOverTime: dashboard.studentEngagementTrend.weeklyActiveStudents,
      activityComposition: dashboard.academicActivity.weekly,
      usageByOrgUnit: orgRows.map((r) => ({ key: String(r.name), name: String(r.name), value: Number(r.value) })),
      adoptionFunnel: funnel,
      prePostGain: prePost,
      metricSource: hybrid.source,
    }
    return base
  }

  if (tab === "engagement") {
    const [dauRow, wauRow, mauRow, dowRows] = await Promise.all([
      scope.courseIds.length
        ? sql`
            SELECT COUNT(DISTINCT st.id)::int AS n FROM students st
            WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
              AND (
                EXISTS (
                  SELECT 1 FROM quiz_attempts qa
                  WHERE qa.student_id = st.id AND qa.deleted_at IS NULL
                    AND COALESCE(qa.started_at, qa.completed_at) >= NOW() - INTERVAL '1 day'
                )
                OR EXISTS (
                  SELECT 1 FROM practice_attempts pa
                  WHERE pa.student_id = st.id
                    AND COALESCE(pa.started_at, pa.completed_at) >= NOW() - INTERVAL '1 day'
                )
              )
          `
        : [{ n: 0 }],
      scope.courseIds.length
        ? sql`
            SELECT COUNT(DISTINCT st.id)::int AS n FROM students st
            WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
              AND (
                EXISTS (
                  SELECT 1 FROM quiz_attempts qa
                  WHERE qa.student_id = st.id AND qa.deleted_at IS NULL
                    AND COALESCE(qa.started_at, qa.completed_at) >= NOW() - INTERVAL '7 days'
                )
                OR EXISTS (
                  SELECT 1 FROM practice_attempts pa
                  WHERE pa.student_id = st.id
                    AND COALESCE(pa.started_at, pa.completed_at) >= NOW() - INTERVAL '7 days'
                )
              )
          `
        : [{ n: 0 }],
      scope.courseIds.length
        ? sql`
            SELECT COUNT(DISTINCT st.id)::int AS n FROM students st
            WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
              AND (
                EXISTS (
                  SELECT 1 FROM quiz_attempts qa
                  WHERE qa.student_id = st.id AND qa.deleted_at IS NULL
                    AND COALESCE(qa.started_at, qa.completed_at) >= NOW() - INTERVAL '30 days'
                )
                OR EXISTS (
                  SELECT 1 FROM practice_attempts pa
                  WHERE pa.student_id = st.id
                    AND COALESCE(pa.started_at, pa.completed_at) >= NOW() - INTERVAL '30 days'
                )
              )
          `
        : [{ n: 0 }],
      scope.courseIds.length
        ? sql`
            SELECT TRIM(TO_CHAR(d, 'Day')) AS name, COUNT(*)::int AS value
            FROM (
              SELECT COALESCE(qa.started_at, qa.completed_at)::date AS d
              FROM quiz_attempts qa
              JOIN students st ON st.id = qa.student_id
              WHERE st.course_id = ANY(${scope.courseIds}) AND qa.deleted_at IS NULL
                AND COALESCE(qa.started_at, qa.completed_at)::date >= ${scope.from}::date
                AND COALESCE(qa.started_at, qa.completed_at)::date <= ${scope.to}::date
            ) x
            GROUP BY 1, EXTRACT(DOW FROM d) ORDER BY EXTRACT(DOW FROM MIN(d))
          `
        : [],
    ])
    const wau = Number(wauRow[0]?.n ?? 0)
    const mau = Number(mauRow[0]?.n ?? 0)
    base.engagement = {
      dau: { value: Number(dauRow[0]?.n ?? 0), label: "DAU" },
      wau: { value: wau, label: "WAU" },
      mau: { value: mau, label: "MAU" },
      wauMauRatio: {
        value: mau > 0 ? Math.round((wau / mau) * 1000) / 10 : null,
        label: "WAU/MAU",
        insufficientData: mau === 0,
      },
      dailyTrend: await getWeeklyStudentEngagement(scope),
      engagementDistribution: [],
      byProgram: [],
      byDayOfWeek: dowRows.map((r) => ({ key: String(r.name).trim(), name: String(r.name).trim(), value: Number(r.value) })),
    }
    return base
  }

  if (tab === "retention") {
    base.retention = {
      available: false,
      unavailableReason: "Cohort retention requires activation cohort tracking — not yet recorded for this deployment",
      dayRetention: [],
      cohortMatrix: [],
    }
    return base
  }

  if (tab === "learning") {
    const [concepts, practice, trajectories, prePostGain] = await Promise.all([
      getConceptAnalytics(scope),
      getPracticeAnalytics(scope),
      getLearningTrajectories(scope),
      getPrePostGainAnalytics(scope, institutionId),
    ])
    base.learning = {
      ...dashboard.studentLearning,
      conceptPerformance: concepts.map((c) => ({ key: c.topic, name: c.topic, value: c.accuracy })),
      conceptImprovement: concepts
        .filter((c) => c.firstAttemptAccuracy != null && c.eventualAccuracy != null)
        .map((c) => ({
          key: c.topic,
          name: c.topic,
          value: Math.round(((c.eventualAccuracy ?? 0) - (c.firstAttemptAccuracy ?? 0)) * 10) / 10,
        })),
      practiceAccuracyTrend: dashboard.studentEngagementTrend.weeklyActiveStudents,
      concepts,
      practice,
      trajectories,
      prePostGain,
    }
    return base
  }

  if (tab === "assessments") {
    const [grading, volumeTrend, extra] = await Promise.all([
      getGradingAutomationMetrics(scope),
      getWeeklyAcademicActivity(scope),
      getAssessmentAnalyticsExtra(scope),
    ])
    base.assessments = {
      volumeTrend: volumeTrend.map((w) => ({ ...w, workflows: w.assessments, activeUsers: 0, credits: 0 })),
      submissionStatus: [
        { key: "completed", name: "Completed", value: extra.completed },
        { key: "started", name: "Started incomplete", value: Math.max(0, extra.started - extra.completed) },
      ],
      performanceDistribution: extra.distribution,
      autoGradingTrend: volumeTrend.map((w) => ({
        week: w.week,
        label: w.label,
        credits: 0,
        workflows: grading.eligible > 0 ? Math.round((grading.autoGraded / grading.eligible) * 100) : 0,
        activeUsers: 0,
      })),
      kpis: {
        submissions: { value: extra.completed, label: "Completed assessments" },
        started: { value: extra.started, label: "Started assessments" },
        completionRate: {
          value: extra.completionRate,
          label: "Completion rate",
          insufficientData: extra.completionRate == null,
        },
        avgScore: {
          value: extra.avgScore,
          label: "Average score",
          insufficientData: extra.avgScore == null,
        },
        autoGraded: { value: grading.autoGraded, label: "Auto-graded" },
        automationRate: {
          value: dashboard.assessmentAutomation.automationRate ?? 0,
          label: "Automation rate",
          definitionId: "automatedGrading",
        },
      },
      extra,
    }
    return base
  }

  if (tab === "cora") {
    const { backfillAiInteractionOutcomes } = await import("@/lib/institutions/ai-learning-interactions")
    await backfillAiInteractionOutcomes({
      institutionId,
      from: scope.from,
      to: scope.to,
    }).catch(() => undefined)
    const [insights, assistance, linkage, classified, temporal, escalation, reliance] = await Promise.all([
      getInstitutionInsights(institutionId),
      getCoraAssistanceAnalytics(scope, institutionId),
      getAiOutcomeLinkage(scope, institutionId),
      getClassifiedAssistanceAnalytics(scope, institutionId),
      getTemporalAiPatterns(scope, institutionId),
      getAssistanceEscalation(scope, institutionId),
      getAiRelianceMetrics(scope, institutionId),
    ])
    base.cora = {
      kpis: {
        workflows: dashboard.kpis.coraWorkflows,
        uniqueUsers: { value: assistance.studentUsers || dashboard.coraUsage.uniqueUsers, label: "Unique Cora students" },
        credits: { value: dashboard.coraUsage.creditsConsumed, label: "Credits consumed" },
        sessions: { value: assistance.sessions, label: "Cora sessions" },
        toolCallRate: {
          value: assistance.toolCallRate,
          label: "Tool-call rate",
          insufficientData: assistance.toolCallRate == null,
          unavailableReason: assistance.toolCallRate == null ? "cora_usage_events not populated for this institution." : undefined,
        },
      },
      usageOverTime: insights.weekly,
      workflowTypes: insights.workflows,
      workflowSuccessByType: insights.workflows.map((w) => ({ ...w, value: w.value > 0 ? 100 : 0 })),
      userComposition: insights.roles,
      valueByWorkflow: insights.workflows,
      repeatUsageTrend: insights.weekly,
      assistance,
      linkage,
      classified,
      temporal,
      escalation,
      reliance,
    }
    return base
  }

  if (tab === "feedback") {
    base.feedback = await getFeedbackAnalytics(scope)
    return base
  }

  if (tab === "faculty") {
    const instructorRows =
      scope.courseIds.length > 0
        ? await sql`
            SELECT i.name AS name, COUNT(u.id)::int AS value
            FROM instructors i
            JOIN institution_cora_usage u ON u.user_type = 'instructor' AND u.user_id = i.id
            WHERE u.institution_id = ${scope.institutionId}
              AND u.created_at::date >= ${scope.from}::date
            GROUP BY i.id, i.name ORDER BY 2 DESC LIMIT 12
          `
        : []
    const hours = await estimateHoursSaved(scope)
    base.faculty = {
      instructorComparison: instructorRows.map((r) => ({
        key: String(r.name),
        name: String(r.name),
        value: Number(r.value),
      })),
      hoursSavedByInstructor: [],
      coraAdoption: instructorRows.map((r) => ({
        key: String(r.name),
        name: String(r.name),
        value: Number(r.value),
      })),
      activityTrend: (await getInstitutionInsights(institutionId)).weekly,
      workflowMix: hours.byCategory,
      disclaimer:
        "Faculty activity metrics describe platform usage and are not faculty performance evaluations. CourseCollab does not rank faculty.",
    }
    return base
  }

  if (tab === "courses") {
    const rows = await getCourseHealthRows(scope)
    const healthRows = dashboard.courseHealth
    const avg = (values: number[]) =>
      values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null
    const completionValues = healthRows.map((r) => r.completionRate).filter((v): v is number => v != null)
    const scoreValues = healthRows.map((r) => r.avgAssessmentScore).filter((v): v is number => v != null)
    const coraValues = healthRows.map((r) => r.coraAdoptionRate).filter((v): v is number => v != null)
    const topEngagement = [...healthRows].sort((a, b) => b.activeStudents - a.activeStudents)[0]
    const lowestCompletion = [...healthRows]
      .filter((r) => r.completionRate != null)
      .sort((a, b) => (a.completionRate ?? 0) - (b.completionRate ?? 0))[0]
    base.courses = {
      rows: healthRows,
      engagementByCourse: rows.map((r) => ({
        key: String(r.courseId),
        name: r.courseCode || r.courseName,
        value: r.activeStudents,
      })),
      completionByCourse: rows.map((r) => ({
        key: String(r.courseId),
        name: r.courseCode || r.courseName,
        value: r.completionRate ?? 0,
      })),
      coraAdoptionByCourse: rows.map((r) => ({
        key: String(r.courseId),
        name: r.courseCode || r.courseName,
        value: r.coraAdoptionRate ?? 0,
      })),
      scoreByCourse: rows.map((r) => ({
        key: String(r.courseId),
        name: r.courseCode || r.courseName,
        value: r.avgScore ?? 0,
      })),
      summary: {
        totalActiveStudents: healthRows.reduce((s, r) => s + r.activeStudents, 0),
        avgCompletionRate: avg(completionValues),
        avgAssessmentScore: avg(scoreValues),
        avgCoraAdoption: avg(coraValues),
        studentsNeedingAttention: healthRows.reduce((s, r) => s + r.studentsNeedingAttention, 0),
        coursesWithAlerts: healthRows.filter((r) => r.statusFactors.some((f) => f !== "No alerts")).length,
        topEngagementCourse: topEngagement ? topEngagement.courseCode || topEngagement.courseName : null,
        lowestCompletionCourse: lowestCompletion
          ? lowestCompletion.courseCode || lowestCompletion.courseName
          : null,
      },
    }
    return base
  }

  if (tab === "adoption") {
    const adoption = await getFeatureAdoption(scope)
    base.adoption = {
      studentFeatures: adoption.student,
      instructorFeatures: adoption.instructor,
      firstVsRepeat: adoption.student.map((f) => ({
        key: f.key,
        name: f.name,
        value: f.value,
      })),
    }
    return base
  }

  if (tab === "license") {
    const insights = await getInstitutionInsights(institutionId)
    base.license = {
      seatUtilizationTrend: dashboard.studentEngagementTrend.weeklyActiveStudents,
      currentCapacity: dashboard.licenseUtilization,
      coraConsumptionTrend: insights.weekly.map((w) => ({ ...w, activeUsers: 0, workflows: w.credits })),
      byOrgUnit: [],
      projectedCapacityDate: null,
      projectedLabel: null,
    }
    return base
  }

  if (tab === "independent") {
    const [independent, transfer, delayed] = await Promise.all([
      getIndependentAnalytics(scope),
      getTransferAnalytics(scope, institutionId),
      getDelayedTransferWindows(scope, institutionId),
    ])
    base.independent = { ...independent, transfer, delayed }
    return base
  }

  if (tab === "cognitive") {
    const [behavioral, trajectories, surveys] = await Promise.all([
      getBehavioralIndicators(scope, institutionId),
      getLearningTrajectories(scope),
      getSurveyConstructAnalytics(scope, institutionId),
    ])
    base.cognitive = {
      behavioral,
      trajectories,
      surveys,
      surveyNote: surveys.note,
    }
    return base
  }

  if (tab === "interventions") {
    const { syncAttentionInterventions } = await import("@/lib/institutions/interventions")
    await syncAttentionInterventions(scope).catch(() => 0)
    base.interventions = await getInterventionAnalytics(scope, institutionId)
    return base
  }

  if (tab === "student_success") {
    const { syncAttentionInterventions } = await import("@/lib/institutions/interventions")
    await syncAttentionInterventions(scope).catch(() => 0)
    const attention = dashboard.studentsNeedingAttention
    base.student_success = {
      available: attention.available,
      flaggedCount: attention.available
        ? attention.rows.length
        : attention.aggregateOnly?.inactiveCount ?? 0,
      newlyFlagged: 0,
      resolvedFlags: 0,
      modelNote:
        "Flags are transparent heuristics (inactivity, missing submissions, declining scores). They are not a validated predictive model and are not presented as certainty.",
      rows: canViewStudentLevelAnalytics(role) && attention.available ? attention.rows : [],
      predictive: await getPredictiveModelStatus(institutionId),
    }
    return base
  }

  if (tab === "equity") {
    base.equity = await getEquitySubgroupAnalytics(scope, institutionId)
    return base
  }

  if (tab === "research") {
    const { getResearchWorkspace } = await import("@/lib/institutions/research/studies")
    base.research = await getResearchWorkspace(institutionId)
    return base
  }

  if (tab === "data_quality") {
    base.data_quality = await getInstitutionDataQuality(scope)
    return base
  }

  if (tab === "longitudinal") {
    const [panel, delayed, models] = await Promise.all([
      getLongitudinalAnalytics(scope),
      getDelayedTransferWindows(scope, institutionId),
      getPredictiveModelStatus(institutionId),
    ])
    base.longitudinal = { panel, delayed, models }
    return base
  }

  if (tab === "pathways") {
    base.pathways = await getLearningPathways(scope, institutionId)
    return base
  }

  if (tab === "questions") {
    base.questions = { answers: await getEndGoalAnswers(scope, institutionId) }
    return base
  }

  return base
}
