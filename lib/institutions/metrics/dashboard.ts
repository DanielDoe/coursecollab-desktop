import { sql } from "@/lib/db"
import { getInstitutionPlan } from "@/lib/institution-plans"
import { getActiveInstitutionLicense, countCoveredStudents } from "@/lib/institutions/licenses"
import { coraUsageAlerts } from "@/lib/institutions/cora-alerts"
import { getInstitutionInsights } from "@/lib/institutions/insights"
import type { InstitutionAdminRole } from "@/lib/institutions/auth"
import { MIN_STUDENTS_FOR_LEARNING_METRIC } from "@/lib/institutions/metrics/constants"
import {
  countActiveCourses,
  countActiveInstructorsInPeriod,
  countActiveSections,
  countActiveStudentsInPeriod,
  countCoveredInstructorsForLicense,
  countInstructorsUsingCora,
  estimateHoursSaved,
  getCoraPeriodMetrics,
  getCourseHealthRows,
  getFeatureAdoption,
  getGradingAutomationMetrics,
  getLearningSnapshot,
  getRecentAuditActivity,
  getStudentsNeedingAttention,
  getWeeklyAcademicActivity,
  getWeeklyStudentEngagement,
} from "@/lib/institutions/metrics/queries"
import {
  buildComparison,
  canViewStudentLevelAnalytics,
  daysUntil,
  licenseUtilizationStatus,
  resolveInstitutionScope,
} from "@/lib/institutions/metrics/scope"
import type { InstitutionAlert, InstitutionDashboardMetrics, InstitutionMetricFilters } from "@/lib/institutions/metrics/types"
import { INSTITUTION_DASHBOARD_BASE } from "@/lib/institution-portal-nav-config"

function formatContractPeriod(start?: string | null, end?: string | null): string | null {
  if (!start && !end) return null
  const fmt = (d: string) => {
    const dt = new Date(`${d.slice(0, 10)}T00:00:00Z`)
    return dt.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
  }
  if (start && end) return `${fmt(String(start))} – ${fmt(String(end))}`
  if (end) return `Until ${fmt(String(end))}`
  return `From ${fmt(String(start!))}`
}

function buildAlerts(input: {
  seatUtilization: number | null
  seatLimit: number | null
  activeStudents: number
  coraIncluded: number
  coraUsed: number
  licenseEnd: string | null
  inactiveStudents: number
}): InstitutionAlert[] {
  const alerts: InstitutionAlert[] = []
  if (input.seatUtilization != null && input.seatUtilization >= 85) {
    alerts.push({
      id: "license-capacity",
      severity: input.seatUtilization >= 95 ? "critical" : "warning",
      title: "License learner capacity elevated",
      context: `${input.activeStudents.toLocaleString()} of ${input.seatLimit?.toLocaleString() ?? "—"} active learners (${input.seatUtilization}% utilized)`,
      action: "Review license capacity and renewal options",
      href: `${INSTITUTION_DASHBOARD_BASE}/license`,
    })
  }
  const coraPct = input.coraIncluded > 0 ? Math.round((input.coraUsed / input.coraIncluded) * 100) : null
  if (coraPct != null && coraPct >= 85) {
    alerts.push({
      id: "cora-allowance",
      severity: coraPct >= 95 ? "critical" : "warning",
      title: "Cora allowance consumption high",
      context: `${input.coraUsed.toLocaleString()} of ${input.coraIncluded.toLocaleString()} credits used (${coraPct}%)`,
      action: "Review Cora usage or request a top-up",
      href: `${INSTITUTION_DASHBOARD_BASE}/cora`,
    })
  }
  const daysLeft = daysUntil(input.licenseEnd)
  if (daysLeft != null && daysLeft <= 45 && daysLeft >= 0) {
    alerts.push({
      id: "license-expiry",
      severity: daysLeft <= 14 ? "critical" : "warning",
      title: "Institutional license renewal approaching",
      context: `Contract ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
      action: "Confirm renewal timeline with Course Collab",
      href: `${INSTITUTION_DASHBOARD_BASE}/license`,
    })
  }
  if (input.inactiveStudents >= 5) {
    alerts.push({
      id: "inactive-students",
      severity: "info",
      title: "Students inactive for 14+ days",
      context: `${input.inactiveStudents} covered students with no recent login`,
      action: "Review students needing attention",
      href: `${INSTITUTION_DASHBOARD_BASE}/students`,
    })
  }
  return alerts
}

export async function getInstitutionDashboardMetrics(
  institutionId: number,
  role: InstitutionAdminRole,
  filters: Partial<InstitutionMetricFilters> = {},
): Promise<InstitutionDashboardMetrics | null> {
  const scope = await resolveInstitutionScope(institutionId, filters)
  if (!scope) return null

  const instRows = await sql`
    SELECT id, name, status FROM universities WHERE id = ${institutionId} LIMIT 1
  `
  if (instRows.length === 0) return null

  const license = await getActiveInstitutionLicense(institutionId)
  const licenseId = license ? Number(license.id) : null
  const plan = license ? getInstitutionPlan(String(license.plan_id)) : null
  const seatLimit = Number(license?.seat_limit_students ?? plan?.studentCap ?? 0) || null

  const previousScope = { ...scope, from: scope.previousFrom, to: scope.previousTo }

  const [
    activeStudents,
    prevActiveStudents,
    activeInstructors,
    prevActiveInstructors,
    coraInstructors,
    activeCourses,
    activeSections,
    coraMetrics,
    prevCoraMetrics,
    grading,
    hoursSaved,
    prevHoursSaved,
    weeklyEngagement,
    academicWeekly,
    learning,
    studentsAttention,
    courseHealthRaw,
    featureAdoption,
    coraAllowance,
    insights,
    recentActivity,
    contractActiveStudents,
    coveredInstructors,
  ] = await Promise.all([
    countActiveStudentsInPeriod(scope),
    countActiveStudentsInPeriod(previousScope),
    countActiveInstructorsInPeriod(scope),
    countActiveInstructorsInPeriod(previousScope),
    countInstructorsUsingCora(scope),
    countActiveCourses(scope),
    countActiveSections(scope),
    getCoraPeriodMetrics(scope),
    getCoraPeriodMetrics(previousScope),
    getGradingAutomationMetrics(scope),
    estimateHoursSaved(scope),
    estimateHoursSaved(previousScope),
    getWeeklyStudentEngagement(scope),
    getWeeklyAcademicActivity(scope),
    getLearningSnapshot(scope),
    canViewStudentLevelAnalytics(role) ? getStudentsNeedingAttention(scope) : Promise.resolve([]),
    getCourseHealthRows(scope),
    getFeatureAdoption(scope),
    licenseId
      ? sql`SELECT included_credits, used_credits FROM institution_cora_allowances WHERE license_id = ${licenseId} LIMIT 1`
      : Promise.resolve([]),
    getInstitutionInsights(institutionId),
    getRecentAuditActivity(institutionId),
    licenseId ? countCoveredStudents(institutionId, licenseId) : Promise.resolve(0),
    licenseId ? countCoveredInstructorsForLicense(licenseId) : Promise.resolve(0),
  ])

  const included = Number(coraAllowance[0]?.included_credits ?? license?.included_cora_credits ?? 0)
  const usedAllowance = Number(coraAllowance[0]?.used_credits ?? coraMetrics.credits)
  const remaining = Math.max(0, included - usedAllowance)
  const allowancePct = included > 0 ? Math.round((usedAllowance / included) * 1000) / 10 : null
  const seatUtil = seatLimit && seatLimit > 0 ? Math.min(100, Math.round((contractActiveStudents / seatLimit) * 1000) / 10) : null
  const utilStatus = licenseUtilizationStatus(seatUtil)
  const automationRate =
    grading.eligible > 0 ? Math.round((grading.autoGraded / grading.eligible) * 1000) / 10 : null
  const overrideRate =
    grading.autoGraded > 0 ? Math.round((grading.overrides / grading.autoGraded) * 1000) / 10 : null
  const reviewRate =
    grading.autoGraded > 0 ? Math.round((grading.instructorReviewed / grading.autoGraded) * 1000) / 10 : null

  const inactiveCount = courseHealthRaw.reduce((s, c) => s + c.attentionCount, 0)

  const metricFilters: InstitutionMetricFilters = {
    institutionId,
    licenseId,
    from: scope.from,
    to: scope.to,
    preset: scope.preset,
    courseId: filters.courseId ?? null,
    organizationUnitId: filters.organizationUnitId ?? null,
    instructorId: filters.instructorId ?? null,
  }

  return {
    generatedAt: new Date().toISOString(),
    filters: metricFilters,
    role,
    header: {
      institutionName: String(instRows[0].name),
      planName: plan?.displayName ?? (license ? String(license.plan_id) : null),
      licenseStatus: license ? `${String(license.contract_status ?? license.status)}` : null,
      contractPeriod: formatContractPeriod(license?.start_date ? String(license.start_date) : null, license?.end_date ? String(license.end_date) : null),
      activeLearnerCapacity: seatLimit,
      activeLearners: contractActiveStudents,
      renewalEndDate: license?.end_date ? String(license.end_date).slice(0, 10) : null,
    },
    kpis: {
      activeStudents: {
        value: activeStudents,
        label: "Active students",
        comparison: buildComparison(activeStudents, prevActiveStudents),
        definitionId: "activeStudent",
      },
      activeInstructors: {
        value: activeInstructors,
        label: "Active instructors",
        comparison: buildComparison(activeInstructors, prevActiveInstructors),
        coraUsersHint:
          activeInstructors > 0
            ? `${coraInstructors} of ${activeInstructors} used Cora this period`
            : "No instructor activity this period",
        definitionId: "activeInstructor",
      },
      courseActivity: {
        value: activeCourses,
        label: "Active courses",
        activeSections,
      },
      coraWorkflows: {
        value: coraMetrics.workflows,
        label: "Cora workflows completed",
        comparison: buildComparison(coraMetrics.workflows, prevCoraMetrics.workflows),
        successRate: coraMetrics.successRate,
        definitionId: "coraWorkflowSuccess",
      },
      automatedSubmissions: {
        value: grading.autoGraded,
        label: "Automated submissions graded",
        automationRate,
        definitionId: "automatedGrading",
      },
      estimatedHoursSaved: {
        value: hoursSaved.totalHours,
        label: "Estimated instructor hours saved",
        comparison: buildComparison(hoursSaved.totalHours, prevHoursSaved.totalHours),
        estimated: true,
        definitionId: "estimatedHoursSaved",
      },
    },
    licenseUtilization: {
      licensedCapacity: seatLimit,
      currentActiveLearners: contractActiveStudents,
      remainingCapacity: seatLimit != null ? Math.max(0, seatLimit - contractActiveStudents) : null,
      utilizationPercent: seatUtil,
      coveredInstructors,
      coveredCourses: scope.courseIds.length,
      daysRemaining: daysUntil(license?.end_date ? String(license.end_date) : null),
      status: utilStatus.status,
      statusLabel: utilStatus.label,
    },
    coraUsage: {
      workflowsThisPeriod: coraMetrics.workflows,
      uniqueUsers: coraMetrics.uniqueUsers,
      successRate: coraMetrics.successRate,
      creditsConsumed: usedAllowance,
      creditsRemaining: remaining,
      allowanceUsedPercent: allowancePct,
      weeklyTrend: insights.weekly,
    },
    studentEngagementTrend: { weeklyActiveStudents: weeklyEngagement },
    academicActivity: { weekly: academicWeekly },
    assessmentAutomation: {
      eligibleSubmissions: grading.eligible,
      autoGraded: grading.autoGraded,
      automationRate,
      instructorReviewed: grading.instructorReviewed,
      overrideRate,
      medianGradingLatencySec: grading.medianLatencySec,
    },
    instructorProductivity: {
      estimatedHoursSaved: hoursSaved.totalHours,
      byCategory: hoursSaved.byCategory,
    },
    studentLearning: {
      avgPracticeAccuracy: {
        value: learning.practiceAccuracy,
        label: "Average practice accuracy",
        sampleSize: learning.sampleSize,
        insufficientData: learning.sampleSize < MIN_STUDENTS_FOR_LEARNING_METRIC,
        definitionId: "practiceAccuracy",
      },
      studentsImproving: {
        value: learning.improvingRate,
        label: "Students improving (practice)",
        sampleSize: learning.sampleSize,
        insufficientData: learning.sampleSize < MIN_STUDENTS_FOR_LEARNING_METRIC,
        unavailableReason:
          learning.sampleSize < MIN_STUDENTS_FOR_LEARNING_METRIC ? "Insufficient practice data" : undefined,
      },
      postInterventionChange: {
        value: null,
        label: "Post-intervention performance change",
        insufficientData: true,
        unavailableReason: "Intervention tracking not yet available",
      },
    },
    studentsNeedingAttention: canViewStudentLevelAnalytics(role)
      ? { available: true, rows: studentsAttention }
      : {
          available: false,
          rows: [],
          aggregateOnly: { inactiveCount, decliningCount: 0 },
        },
    courseHealth: courseHealthRaw.map((row) => {
      const factors: string[] = []
      if (row.attentionCount > 0) factors.push(`${row.attentionCount} inactive`)
      if (row.completionRate != null && row.completionRate < 60) factors.push("Low completion")
      if (row.avgScore != null && row.avgScore < 60) factors.push("Below-target scores")
      return {
        courseId: row.courseId,
        courseCode: row.courseCode,
        courseName: row.courseName,
        activeStudents: row.activeStudents,
        engagementLabel: row.activeStudents > 0 ? "Active" : "Quiet",
        completionRate: row.completionRate,
        avgAssessmentScore: row.avgScore,
        coraAdoptionRate: row.coraAdoptionRate,
        studentsNeedingAttention: row.attentionCount,
        statusFactors: factors.length ? factors : ["No alerts"],
      }
    }),
    featureAdoption: {
      student: featureAdoption.student,
      instructor: featureAdoption.instructor,
    },
    alerts: buildAlerts({
      seatUtilization: seatUtil,
      seatLimit,
      activeStudents: contractActiveStudents,
      coraIncluded: included,
      coraUsed: usedAllowance,
      licenseEnd: license?.end_date ? String(license.end_date) : null,
      inactiveStudents: inactiveCount,
    }),
    recentActivity,
  }
}

export { coraUsageAlerts }
