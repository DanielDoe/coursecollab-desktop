export type ClassAnalyticsSort =
  | "engagement"
  | "assessments"
  | "practice"
  | "points"
  | "attendance"
  | "lectures"
  | "flashcards"
  | "playground"
  | "name"

export type ClassAnalyticsModuleFlashcardRow = {
  studentDbId: number
  decksStudied: number
  studyEvents: number
  pointsAwarded: number
}

export type ClassAnalyticsModuleLectureRow = {
  studentDbId: number
  lecturesOpened: number
  lecturesCompleted: number
}

export type ClassAnalyticsPlaygroundRow = {
  studentDbId?: number
  studentId: string
  sessionsPlayed: number
  totalScore: number
  accuracy: number | null
}

export type ClassAnalyticsInstructorStudent = {
  id: number
  student_id: string
  full_name: string
  email?: string | null
  section?: string | null
  session_code?: string | null
  quiz_attempts?: number
}

export type ClassAnalyticsPracticeRow = {
  student_id: number
  student_name?: string
  full_name?: string
  student_number?: string
  student_section?: string | null
  session?: string | null
  total_attempts?: number
  avg_score?: number
  accuracy?: number
  topics_practiced?: string[]
  last_practiced?: string | null
}

export type ClassAnalyticsAttendanceSummary = {
  id?: number
  student_id?: string
  full_name?: string
  attendance_percentage?: number | null
}

export type ClassAnalyticsPointsRow = {
  student_id: number
  student_number?: string
  full_name?: string
  total_points?: number | string
  award_count?: number | string
}

export type ClassAnalyticsAssessmentResult = {
  student_id?: number
  percentage?: number | null
  score?: number | null
  is_in_progress?: boolean
}

export type ClassAnalyticsStudentRow = {
  student: ClassAnalyticsInstructorStudent
  practiceScore: number | null
  practiceAttempts: number
  topicsPracticed: number
  assessmentAvg: number | null
  assessmentCount: number
  attendanceRate: number | null
  classroomPoints: number
  classroomAwards: number
  flashcardsDecksStudied: number
  flashcardsStudyEvents: number
  flashcardsPoints: number
  lecturesOpened: number
  lecturesCompleted: number
  playgroundSessionsPlayed: number
  playgroundTotalScore: number
  playgroundAccuracy: number | null
  engagementScore: number
  lastActiveLabel: string | null
  signals: string[]
}

export type ClassAnalyticsEngagementBand = {
  label: string
  count: number
}

export type ClassAnalyticsOverviewStats = {
  activePracticers: number
  avgAssessment: number | null
  avgAttendance: number | null
  totalClassPoints: number
  submissionCount: number
  activeFlashcardStudiers: number
  activeLectureViewers: number
  activePlaygroundPlayers: number
}

export type ClassAnalyticsAttendanceTrendPoint = {
  week: string
  attendance_rate: number
  check_ins?: number
}
