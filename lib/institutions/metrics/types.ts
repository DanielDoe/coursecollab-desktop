import type { InstitutionAdminRole } from "@/lib/institutions/auth"
import type { InstitutionDatePreset } from "@/lib/institutions/metrics/constants"
import type { InstitutionNamedCount, InstitutionWeekPoint } from "@/lib/institutions/insights"

export type InstitutionMetricFilters = {
  institutionId: number
  licenseId: number | null
  from: string
  to: string
  preset: InstitutionDatePreset
  courseId?: number | null
  organizationUnitId?: number | null
  instructorId?: number | null
  programId?: number | null
  sectionId?: number | null
}

export type MetricComparison = {
  value: number | null
  previousValue: number | null
  changePercent: number | null
  changeLabel: "up" | "down" | "flat" | "new" | "unavailable"
}

export type MetricValue<T = number> = {
  value: T
  label: string
  comparison?: MetricComparison
  sampleSize?: number
  insufficientData?: boolean
  unavailableReason?: string
  estimated?: boolean
  definitionId?: keyof typeof import("@/lib/institutions/metrics/constants").METRIC_DEFINITIONS
}

export type InstitutionScope = {
  institutionId: number
  licenseId: number | null
  courseIds: number[]
  from: string
  to: string
  previousFrom: string
  previousTo: string
  preset: InstitutionDatePreset
}

export type LicenseUtilizationStatus = "normal" | "monitor" | "approaching" | "capacity_warning" | "unknown"

export type InstitutionAlert = {
  id: string
  severity: "info" | "warning" | "critical"
  title: string
  context: string
  action: string
  href: string
}

export type StudentAttentionRow = {
  studentId: number
  studentName: string
  courseId: number
  courseName: string
  reason: string
  recentEngagement: string
  recentPerformance: string | null
  lastActivity: string | null
  recommendedAction: string
}

export type CourseHealthRow = {
  courseId: number
  courseCode: string
  courseName: string
  activeStudents: number
  engagementLabel: string
  completionRate: number | null
  avgAssessmentScore: number | null
  coraAdoptionRate: number | null
  studentsNeedingAttention: number
  statusFactors: string[]
}

export type InstitutionDashboardMetrics = {
  generatedAt: string
  filters: InstitutionMetricFilters
  role: InstitutionAdminRole
  header: {
    institutionName: string
    planName: string | null
    licenseStatus: string | null
    contractPeriod: string | null
    activeLearnerCapacity: number | null
    activeLearners: number
    renewalEndDate: string | null
  }
  kpis: {
    activeStudents: MetricValue
    activeInstructors: MetricValue & { coraUsersHint?: string }
    courseActivity: MetricValue & { activeSections?: number }
    coraWorkflows: MetricValue & { successRate?: number | null }
    automatedSubmissions: MetricValue & { automationRate?: number | null }
    estimatedHoursSaved: MetricValue
  }
  licenseUtilization: {
    licensedCapacity: number | null
    currentActiveLearners: number
    remainingCapacity: number | null
    utilizationPercent: number | null
    coveredInstructors: number
    coveredCourses: number
    daysRemaining: number | null
    status: LicenseUtilizationStatus
    statusLabel: string
  }
  coraUsage: {
    workflowsThisPeriod: number
    uniqueUsers: number
    successRate: number | null
    creditsConsumed: number
    creditsRemaining: number
    allowanceUsedPercent: number | null
    weeklyTrend: InstitutionWeekPoint[]
  }
  studentEngagementTrend: {
    weeklyActiveStudents: InstitutionWeekPoint[]
    previousPeriod?: InstitutionWeekPoint[]
  }
  academicActivity: {
    weekly: Array<
      InstitutionWeekPoint & {
        assessments: number
        practice: number
        coding: number
        coraLearning: number
      }
    >
  }
  assessmentAutomation: {
    eligibleSubmissions: number
    autoGraded: number
    automationRate: number | null
    instructorReviewed: number
    overrideRate: number | null
    medianGradingLatencySec: number | null
  }
  instructorProductivity: {
    estimatedHoursSaved: number
    byCategory: InstitutionNamedCount[]
  }
  studentLearning: {
    avgPracticeAccuracy: MetricValue<number | null>
    studentsImproving: MetricValue<number | null>
    postInterventionChange: MetricValue<number | null>
  }
  studentsNeedingAttention: {
    available: boolean
    rows: StudentAttentionRow[]
    aggregateOnly?: { inactiveCount: number; decliningCount: number }
  }
  courseHealth: CourseHealthRow[]
  featureAdoption: {
    student: InstitutionNamedCount[]
    instructor: InstitutionNamedCount[]
  }
  alerts: InstitutionAlert[]
  recentActivity: Array<{
    id: number
    action: string
    entityType: string
    createdAt: string
    summary: string
  }>
}

export type AnalyticsTab =
  | "overview"
  | "engagement"
  | "retention"
  | "learning"
  | "assessments"
  | "cora"
  | "faculty"
  | "courses"
  | "adoption"
  | "license"
  | "independent"
  | "cognitive"
  | "interventions"
  | "student_success"
  | "equity"
  | "research"
  | "data_quality"
  | "longitudinal"
  | "pathways"
  | "questions"
  | "feedback"

export type InstitutionAnalyticsMetrics = {
  generatedAt: string
  filters: InstitutionMetricFilters
  role: InstitutionAdminRole
  tab: AnalyticsTab
  overview?: {
    kpis: Record<string, MetricValue>
    outcomeKpis: Record<string, MetricValue>
    activeUsersOverTime: InstitutionWeekPoint[]
    activityComposition: InstitutionDashboardMetrics["academicActivity"]["weekly"]
    usageByOrgUnit: InstitutionNamedCount[]
    adoptionFunnel: InstitutionNamedCount[]
    prePostGain?: import("@/lib/institutions/research/pre-post-gain").PrePostGainAnalytics
    metricSource?: "analytics_events" | "legacy"
  }
  engagement?: {
    dau: MetricValue
    wau: MetricValue
    mau: MetricValue
    wauMauRatio: MetricValue<number | null>
    dailyTrend: InstitutionWeekPoint[]
    engagementDistribution: InstitutionNamedCount[]
    byProgram: InstitutionNamedCount[]
    byDayOfWeek: InstitutionNamedCount[]
  }
  retention?: {
    available: boolean
    unavailableReason?: string
    dayRetention: InstitutionNamedCount[]
    cohortMatrix: Array<{ cohort: string; weeks: Array<{ week: number; rate: number | null }> }>
  }
  learning?: InstitutionDashboardMetrics["studentLearning"] & {
    conceptPerformance: InstitutionNamedCount[]
    conceptImprovement: InstitutionNamedCount[]
    practiceAccuracyTrend: InstitutionWeekPoint[]
    concepts: import("@/lib/institutions/metrics/phase2").ConceptAnalyticsRow[]
    practice: import("@/lib/institutions/metrics/phase2").PracticeAnalytics
    trajectories: import("@/lib/institutions/metrics/phase3").TrajectoryWeek[]
    prePostGain?: import("@/lib/institutions/research/pre-post-gain").PrePostGainAnalytics
  }
  assessments?: {
    volumeTrend: InstitutionWeekPoint[]
    submissionStatus: InstitutionNamedCount[]
    performanceDistribution: InstitutionNamedCount[]
    autoGradingTrend: InstitutionWeekPoint[]
    kpis: Record<string, MetricValue>
    extra: import("@/lib/institutions/metrics/phase2").AssessmentAnalyticsExtra
  }
  cora?: {
    kpis: Record<string, MetricValue>
    usageOverTime: InstitutionWeekPoint[]
    workflowTypes: InstitutionNamedCount[]
    workflowSuccessByType: InstitutionNamedCount[]
    userComposition: InstitutionNamedCount[]
    valueByWorkflow: InstitutionNamedCount[]
    repeatUsageTrend: InstitutionWeekPoint[]
    assistance: import("@/lib/institutions/metrics/phase2").CoraAssistanceAnalytics
    linkage: import("@/lib/institutions/metrics/phase2").AiOutcomeLinkage
    classified: import("@/lib/institutions/metrics/phase4").ClassifiedAssistanceAnalytics
    temporal: import("@/lib/institutions/metrics/phase4").TemporalAiPatterns
    escalation: import("@/lib/institutions/metrics/phase4").AssistanceEscalation
    reliance: import("@/lib/institutions/metrics/phase4").AiRelianceMetrics
  }
  feedback?: import("@/lib/institutions/metrics/phase4").FeedbackAnalytics
  faculty?: {
    instructorComparison: InstitutionNamedCount[]
    hoursSavedByInstructor: InstitutionNamedCount[]
    coraAdoption: InstitutionNamedCount[]
    activityTrend: InstitutionWeekPoint[]
    workflowMix: InstitutionNamedCount[]
    disclaimer: string
  }
  courses?: {
    rows: CourseHealthRow[]
    engagementByCourse: InstitutionNamedCount[]
    completionByCourse: InstitutionNamedCount[]
    scoreByCourse: InstitutionNamedCount[]
    coraAdoptionByCourse: InstitutionNamedCount[]
    summary: {
      totalActiveStudents: number
      avgCompletionRate: number | null
      avgAssessmentScore: number | null
      avgCoraAdoption: number | null
      studentsNeedingAttention: number
      coursesWithAlerts: number
      topEngagementCourse: string | null
      lowestCompletionCourse: string | null
    }
  }
  adoption?: {
    studentFeatures: InstitutionNamedCount[]
    instructorFeatures: InstitutionNamedCount[]
    firstVsRepeat: InstitutionNamedCount[]
  }
  license?: {
    seatUtilizationTrend: InstitutionWeekPoint[]
    currentCapacity: InstitutionDashboardMetrics["licenseUtilization"]
    coraConsumptionTrend: InstitutionWeekPoint[]
    byOrgUnit: InstitutionNamedCount[]
    projectedCapacityDate: string | null
    projectedLabel: string | null
  }
  independent?: import("@/lib/institutions/metrics/phase3").IndependentAnalytics & {
    transfer: import("@/lib/institutions/metrics/phase3").TransferAnalytics
    delayed: import("@/lib/institutions/metrics/phase5").DelayedTransferAnalytics
  }
  longitudinal?: {
    panel: import("@/lib/institutions/metrics/phase5").LongitudinalAnalytics
    delayed: import("@/lib/institutions/metrics/phase5").DelayedTransferAnalytics
    models: import("@/lib/institutions/metrics/phase5").PredictiveModelStatus
  }
  pathways?: import("@/lib/institutions/metrics/phase5").PathwayAnalytics
  questions?: { answers: import("@/lib/institutions/metrics/end-goal").EndGoalAnswer[] }
  cognitive?: {
    behavioral: import("@/lib/institutions/metrics/phase3").BehavioralIndicators
    trajectories: import("@/lib/institutions/metrics/phase3").TrajectoryWeek[]
    surveys: import("@/lib/institutions/research/survey-constructs").SurveyConstructAnalytics
    surveyNote: string
  }
  interventions?: import("@/lib/institutions/metrics/phase3").InterventionAnalytics
  student_success?: {
    flaggedCount: number
    newlyFlagged: number
    resolvedFlags: number
    modelNote: string
    rows: StudentAttentionRow[]
    available: boolean
    predictive: import("@/lib/institutions/metrics/phase5").PredictiveModelStatus
  }
  equity?: import("@/lib/institutions/research/equity-subgroups").EquitySubgroupAnalytics
  research?: Awaited<ReturnType<typeof import("@/lib/institutions/research/studies").getResearchWorkspace>>
  data_quality?: import("@/lib/institutions/metrics/data-quality").InstitutionDataQuality
}
