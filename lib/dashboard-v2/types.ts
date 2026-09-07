export type DashboardPortal = "admin" | "faculty" | "student" | "camper"

/** Resolved dashboard persona — drives default templates and widget eligibility */
export type DashboardRoleKey =
  | "platform_admin"
  | "department_admin"
  | "instructor"
  | "ta"
  | "observer"
  | "student"
  | "summer_camper"
  | "summer_student"

export type DashboardWidgetSize = "sm" | "md" | "lg" | "full"

export type DashboardWidgetKind = "kpi" | "chart" | "list" | "actions" | "text"

export type DashboardWidgetDef = {
  id: string
  title: string
  description: string
  kind: DashboardWidgetKind
  size: DashboardWidgetSize
  /** Empty = all roles in portal */
  roles: DashboardRoleKey[]
  portals: DashboardPortal[]
}

export type DashboardTemplate = {
  id: string
  name: string
  description: string
  widgetIds: string[]
}

export type DashboardLayoutState = {
  templateId: string
  visibleWidgetIds: string[]
}

export type AdminDashboardStats = {
  totalStudents: number
  activeCourses: number
  totalFaculty: number
  instructorCount: number
  taCount: number
  totalQuizzes: number
  activeQuizzes: number
  totalAttempts: number
  pendingIssues: number
  upcomingAssessments: number
  activeUsers24h: number
  systemHealth: number
  pendingAccountRequests: number
  platformEventsToday?: number
}

export type FacultyDashboardStats = {
  totalQuizzes: number
  activeQuizzes: number
  totalStudents: number
  totalAttempts: number
  pendingIssues: number
  upcomingAssessments: number
  recentSubmissions24h: number
  classAverageScore: number
  /** e.g. "Fall 2026" — KPI activity is scoped to this academic term row, not all Fall semesters. */
  scopeTermLabel?: string | null
  scopeSessionCode?: string | null
}

export type StudentDashboardStats = {
  overallGrade: number
  letterGrade: string
  quizAverage: number
  classQuizAverage: number
  homeworkAverage: number
  missingAssignments: number
  attendancePct: number
  classesMissed: number
  attendanceStreak: number
  classroomPoints: number
  engagementCredits: number
  upcomingDeadlines: number
  riskLevel: "low" | "moderate" | "high"
  riskReason: string
}

export type CamperDashboardStats = {
  overallPercent: number
  totalXp: number
  leaderboardRank: number | null
  leaderboardTotal: number | null
  enrollmentCount: number
  pendingCheckpoints: number
  modulesCompleted: number
  totalModules: number
  recentFeedbackCount: number
  openDiscussions: number
  upcomingEvents: number
}

export type DashboardActivityItem = {
  id: string
  type: string
  title: string
  message?: string
  description?: string
  created_at?: string
  timestamp?: string
  student_name?: string
  score?: number
  percentage?: number
  status?: string
  assessment_type?: string
  attempt_id?: number | string
  portal?: string
  category?: string
  action?: string
  actor_label?: string
}
