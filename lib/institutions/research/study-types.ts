export const STUDY_DESIGNS = ["observational", "comparison", "pre_post", "authorized_experiment"] as const
export const STUDY_STATUSES = ["draft", "configured", "authorized"] as const
export const OUTCOME_METRICS = ["assessment_score", "practice_accuracy", "cora_sessions"] as const
export const COHORT_DEFINITIONS = ["roster", "cora", "no_cora", "practice", "assessment", "independent"] as const
export const COHORT_ROLES = ["group", "group_a", "group_b", "treatment", "control", "pre", "post"] as const

export type StudyDesign = (typeof STUDY_DESIGNS)[number]
export type StudyStatus = (typeof STUDY_STATUSES)[number]
export type OutcomeMetric = (typeof OUTCOME_METRICS)[number]
export type CohortDefinition = (typeof COHORT_DEFINITIONS)[number]
export type CohortRole = (typeof COHORT_ROLES)[number]

export type ResearchStudy = {
  id: number
  name: string
  description: string | null
  design: StudyDesign
  status: StudyStatus
  outcomeMetric: OutcomeMetric
  fromDate: string | null
  toDate: string | null
  authorizationNote: string | null
  assignmentChangesExperience: boolean
  createdAt: string
  updatedAt: string
  cohorts: ResearchCohort[]
}

export type ResearchCohort = {
  id: number
  studyId: number
  name: string
  roleInStudy: CohortRole
  definitionType: CohortDefinition
  notes: string | null
}

export type ResearchExportLog = {
  id: number
  dataset: string
  studyId: string | null
  rowCount: number | null
  createdAt: string
}
