/**
 * Centralized student assessment paths — always Dashboard V2.
 */

export const DASHBOARD_V2_BASE = "/student/dashboard-v2"

export function setDashboardV2Preference(_use: boolean) {
  /* Classic dashboard retired; no-op for backwards compatibility. */
}

export function useDashboardV2(): boolean {
  return true
}

export function getQuizzesPath(): string {
  return `${DASHBOARD_V2_BASE}/quizzes`
}

export function getHomeworkPath(): string {
  return `${DASHBOARD_V2_BASE}/homework`
}

export function getMidSemesterExamsPath(): string {
  return `${DASHBOARD_V2_BASE}/mid-semester-exams`
}

export function getFinalExamsPath(): string {
  return `${DASHBOARD_V2_BASE}/final-exams`
}

export function getDashboardPath(): string {
  return DASHBOARD_V2_BASE
}

export function getQuizHistoryPath(): string {
  return `${DASHBOARD_V2_BASE}/quiz-history`
}

export function getPracticePath(): string {
  return `${DASHBOARD_V2_BASE}/practice`
}

export function getBackPathForAssessmentV2(assessmentType: string): string {
  switch (assessmentType) {
    case "homework":
      return `${DASHBOARD_V2_BASE}/homework`
    case "mid_semester":
      return `${DASHBOARD_V2_BASE}/mid-semester-exams`
    case "final":
      return `${DASHBOARD_V2_BASE}/final-exams`
    case "practice":
      return `${DASHBOARD_V2_BASE}/practice`
    case "quiz":
    default:
      return `${DASHBOARD_V2_BASE}/quizzes`
  }
}

export function getBackPathForAssessment(assessmentType: string, _referrer: string = ""): string {
  return getBackPathForAssessmentV2(assessmentType)
}
