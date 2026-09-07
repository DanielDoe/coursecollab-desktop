import type { ProgressReviewPeriod } from "./review-period"
import type { ProgressReviewGradebook } from "./adjust-gradebook-for-review"

export type AssessmentAttemptSummary = {
  attemptId: number
  title: string
  assessmentType: string
  completedAt: string | null
  score: number
  totalPoints: number
  percentage: number
  feedbackHighlights: string[]
  incorrectTopics: string[]
}

export type ClassroomPointSummary = {
  points: number
  reason: string | null
  category: string | null
  awardedAt: string | null
  status: string | null
}

export type PracticeHubSummary = {
  totalAttempts: number
  avgScore: number
  accuracy: number
  weakTopics: string[]
  strongTopics: string[]
  recentSessions: Array<{
    topics: string[] | null
    scorePercentage: number
    completedAt: string | null
  }>
}

export type LecturePracticeSummary = {
  totalAttempts: number
  correctCount: number
  accuracy: number
  recentLectures: Array<{
    lectureTitle: string
    isCorrect: boolean
    completedAt: string | null
  }>
}

export type AttendanceSummary = {
  totalSessions: number
  /** All scheduled sessions for the term (including not yet scored). */
  scheduledSessionsTotal: number
  presentCount: number
  attendanceRate: number
  gradebookScore: number | null
  recentMissed: string[]
}

export type StudentProgressData = {
  student: {
    id: number
    fullName: string
    email: string | null
    studentNumber: string | null
    section: string | null
  }
  courseCode: string | null
  instructorName: string | null
  reviewPeriod: ProgressReviewPeriod
  asOfDate: string | null
  gradebook: ProgressReviewGradebook | null
  assessments: AssessmentAttemptSummary[]
  classroomPoints: ClassroomPointSummary[]
  practiceHub: PracticeHubSummary
  lecturePractice: LecturePracticeSummary
  attendance: AttendanceSummary
  gatheredAt: string
}

export type ProgressReviewSections = {
  overallSummary: string
  strengths: string[]
  areasToImprove: string[]
  assessmentFeedback: string
  practiceFeedback: string
  attendanceFeedback: string
  classroomFeedback: string
  actionPlan: string[]
  encouragement: string
}

export type GeneratedProgressReview = {
  sections: ProgressReviewSections
  modelUsed: string
  generatedAt: string
}

export type DispatchResult = {
  studentId: number
  reviewId: number | null
  emailSent: boolean
  emailSkipReason?: string
  notificationCreated: boolean
  announcementCreated: boolean
  error?: string
}

export type BatchRunResult = {
  total: number
  generated: number
  dispatched: number
  emailsSent: number
  skipped: number
  errors: Array<{ studentId: number; error: string }>
  dryRun: boolean
  /** True when only delivery ran against existing saved reviews (no AI regenerate). */
  deliverSaved?: boolean
}
