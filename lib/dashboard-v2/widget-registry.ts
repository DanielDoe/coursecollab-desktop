import type {
  DashboardLayoutState,
  DashboardPortal,
  DashboardRoleKey,
  DashboardTemplate,
  DashboardWidgetDef,
} from "./types"

export const DASHBOARD_WIDGETS: DashboardWidgetDef[] = [
  {
    id: "kpi-total-students",
    title: "Total Students",
    description: "All registered student accounts",
    kind: "kpi",
    size: "sm",
    roles: ["platform_admin", "department_admin"],
    portals: ["admin"],
  },
  {
    id: "kpi-active-courses",
    title: "Active Courses",
    description: "Courses currently marked active",
    kind: "kpi",
    size: "sm",
    roles: ["platform_admin", "department_admin"],
    portals: ["admin"],
  },
  {
    id: "kpi-faculty-members",
    title: "Faculty & Staff",
    description: "Instructors, TAs, and department admins",
    kind: "kpi",
    size: "sm",
    roles: ["platform_admin", "department_admin"],
    portals: ["admin"],
  },
  {
    id: "kpi-active-users",
    title: "Platform Events (24h)",
    description: "Audit and activity log events in the last 24 hours",
    kind: "kpi",
    size: "sm",
    roles: ["platform_admin", "department_admin"],
    portals: ["admin"],
  },
  {
    id: "kpi-pending-issues-admin",
    title: "Open Issues",
    description: "Quiz issues awaiting resolution",
    kind: "kpi",
    size: "sm",
    roles: ["platform_admin", "department_admin"],
    portals: ["admin"],
  },
  {
    id: "kpi-system-health",
    title: "System Health",
    description: "Database connectivity and platform status",
    kind: "kpi",
    size: "sm",
    roles: ["platform_admin"],
    portals: ["admin"],
  },
  {
    id: "kpi-account-requests",
    title: "Account Requests",
    description: "Pending guest or account approval requests",
    kind: "kpi",
    size: "sm",
    roles: ["platform_admin", "department_admin"],
    portals: ["admin"],
  },
  {
    id: "kpi-upcoming-assessments-admin",
    title: "Upcoming Assessments",
    description: "Assessments scheduled to open within 7 days",
    kind: "kpi",
    size: "sm",
    roles: ["platform_admin", "department_admin"],
    portals: ["admin"],
  },
  {
    id: "kpi-active-quizzes",
    title: "Active Quizzes",
    description: "Assessments currently available to students",
    kind: "kpi",
    size: "sm",
    roles: ["instructor", "ta", "observer"],
    portals: ["faculty"],
  },
  {
    id: "kpi-course-students",
    title: "Students",
    description: "Students enrolled in the selected course",
    kind: "kpi",
    size: "sm",
    roles: ["instructor", "ta", "observer"],
    portals: ["faculty"],
  },
  {
    id: "kpi-quiz-attempts",
    title: "Quiz Attempts",
    description: "Total submissions in this course",
    kind: "kpi",
    size: "sm",
    roles: ["instructor", "ta"],
    portals: ["faculty"],
  },
  {
    id: "kpi-recent-submissions",
    title: "Submissions (24h)",
    description: "New quiz attempts in the last day",
    kind: "kpi",
    size: "sm",
    roles: ["instructor", "ta"],
    portals: ["faculty"],
  },
  {
    id: "kpi-pending-issues-faculty",
    title: "Pending Issues",
    description: "Student-reported quiz issues needing review",
    kind: "kpi",
    size: "sm",
    roles: ["instructor", "ta"],
    portals: ["faculty"],
  },
  {
    id: "kpi-upcoming-assessments",
    title: "Upcoming",
    description: "Assessments scheduled to open soon",
    kind: "kpi",
    size: "sm",
    roles: ["instructor", "ta", "observer"],
    portals: ["faculty"],
  },
  {
    id: "kpi-faculty-class-average",
    title: "Class Average",
    description: "Average score on completed attempts in this course",
    kind: "kpi",
    size: "sm",
    roles: ["instructor", "ta", "observer"],
    portals: ["faculty"],
  },
  {
    id: "kpi-faculty-total-assessments",
    title: "Total Assessments",
    description: "All assessments in the selected course",
    kind: "kpi",
    size: "sm",
    roles: ["instructor", "ta", "observer"],
    portals: ["faculty"],
  },
  {
    id: "chart-submissions-over-time",
    title: "Submissions over time",
    description: "Quiz submission volume across the course",
    kind: "chart",
    size: "md",
    roles: ["instructor", "ta", "observer"],
    portals: ["faculty"],
  },
  {
    id: "chart-assessment-breakdown",
    title: "Assessment Breakdown",
    description: "Attempts by assessment type",
    kind: "chart",
    size: "md",
    roles: ["instructor", "ta"],
    portals: ["faculty"],
  },
  {
    id: "chart-score-trend",
    title: "Average Score Trend",
    description: "Weekly average scores over six weeks",
    kind: "chart",
    size: "full",
    roles: ["instructor", "ta", "observer"],
    portals: ["faculty"],
  },
  {
    id: "chart-enrollment-trend",
    title: "Platform Events (7 Days)",
    description: "Audit log and platform activity volume by day",
    kind: "chart",
    size: "md",
    roles: ["platform_admin", "department_admin"],
    portals: ["admin"],
  },
  {
    id: "list-recent-activity",
    title: "Recent Audit & Activity",
    description: "Latest platform audit logs, RBAC events, and pending requests",
    kind: "list",
    size: "md",
    roles: ["platform_admin", "department_admin", "instructor", "ta", "observer"],
    portals: ["admin", "faculty"],
  },
  {
    id: "list-admin-priorities",
    title: "Administration Priorities",
    description: "Key items requiring institutional attention",
    kind: "text",
    size: "md",
    roles: ["platform_admin", "department_admin"],
    portals: ["admin"],
  },
  {
    id: "list-ta-daily-tasks",
    title: "TA Daily Checklist",
    description: "Suggested tasks for teaching assistants",
    kind: "text",
    size: "md",
    roles: ["ta"],
    portals: ["faculty"],
  },
  {
    id: "list-instructor-snapshot",
    title: "Course Snapshot",
    description: "At-a-glance teaching summary for your course",
    kind: "text",
    size: "md",
    roles: ["instructor"],
    portals: ["faculty"],
  },
  {
    id: "actions-admin-quick",
    title: "Quick Actions",
    description: "Jump to common admin modules",
    kind: "actions",
    size: "md",
    roles: ["platform_admin", "department_admin"],
    portals: ["admin"],
  },
  {
    id: "actions-instructor-quick",
    title: "Quick Actions",
    description: "Jump to teaching workflows",
    kind: "actions",
    size: "md",
    roles: ["instructor"],
    portals: ["faculty"],
  },
  {
    id: "actions-ta-quick",
    title: "Quick Actions",
    description: "Jump to TA-supported modules",
    kind: "actions",
    size: "md",
    roles: ["ta"],
    portals: ["faculty"],
  },
  {
    id: "kpi-student-overall-grade",
    title: "Overall Grade",
    description: "Weighted course grade",
    kind: "kpi",
    size: "sm",
    roles: ["student"],
    portals: ["student"],
  },
  {
    id: "kpi-student-quiz-average",
    title: "Quiz Average",
    description: "Your best quiz scores averaged",
    kind: "kpi",
    size: "sm",
    roles: ["student"],
    portals: ["student"],
  },
  {
    id: "kpi-student-homework-average",
    title: "Homework Average",
    description: "Completed homework scores",
    kind: "kpi",
    size: "sm",
    roles: ["student"],
    portals: ["student"],
  },
  {
    id: "kpi-student-attendance",
    title: "Attendance",
    description: "Class attendance percentage",
    kind: "kpi",
    size: "sm",
    roles: ["student"],
    portals: ["student"],
  },
  {
    id: "kpi-student-missing-work",
    title: "Missing Work",
    description: "Overdue or pending assignments",
    kind: "kpi",
    size: "sm",
    roles: ["student"],
    portals: ["student"],
  },
  {
    id: "kpi-student-streak",
    title: "Attendance Streak",
    description: "Consecutive classes attended",
    kind: "kpi",
    size: "sm",
    roles: ["student"],
    portals: ["student"],
  },
  {
    id: "kpi-student-classroom-points",
    title: "Classroom Points",
    description: "Participation points earned",
    kind: "kpi",
    size: "sm",
    roles: ["student"],
    portals: ["student"],
  },
  {
    id: "kpi-student-deadlines",
    title: "Upcoming Deadlines",
    description: "Open quizzes and homework due soon",
    kind: "kpi",
    size: "sm",
    roles: ["student"],
    portals: ["student"],
  },
  {
    id: "chart-student-grade-trend",
    title: "Grade Trend",
    description: "Your performance over time",
    kind: "chart",
    size: "md",
    roles: ["student"],
    portals: ["student"],
  },
  {
    id: "chart-student-performance-comparison",
    title: "Class Comparison",
    description: "Your scores vs class averages",
    kind: "chart",
    size: "md",
    roles: ["student"],
    portals: ["student"],
  },
  {
    id: "list-student-insights",
    title: "Performance Insights",
    description: "Personalized academic guidance",
    kind: "list",
    size: "md",
    roles: ["student"],
    portals: ["student"],
  },
  {
    id: "list-student-deadlines",
    title: "Upcoming Deadlines",
    description: "Quizzes, homework, and exams due soon",
    kind: "list",
    size: "md",
    roles: ["student"],
    portals: ["student"],
  },
  {
    id: "list-student-semester-timeline",
    title: "Semester Timeline",
    description: "Full course schedule including upcoming releases",
    kind: "list",
    size: "full",
    roles: ["student"],
    portals: ["student"],
  },
  {
    id: "list-student-engagement",
    title: "Engagement",
    description: "Streak, classroom points, and credits",
    kind: "text",
    size: "md",
    roles: ["student"],
    portals: ["student"],
  },
  {
    id: "actions-student-quick",
    title: "Quick Actions",
    description: "Jump to common student workflows",
    kind: "actions",
    size: "md",
    roles: ["student"],
    portals: ["student"],
  },
  {
    id: "kpi-camper-progress",
    title: "Camp Progress",
    description: "Overall training completion",
    kind: "kpi",
    size: "sm",
    roles: ["summer_camper", "summer_student"],
    portals: ["camper"],
  },
  {
    id: "kpi-camper-xp",
    title: "Camp XP",
    description: "Experience points earned",
    kind: "kpi",
    size: "sm",
    roles: ["summer_camper", "summer_student"],
    portals: ["camper"],
  },
  {
    id: "kpi-camper-rank",
    title: "Leaderboard Rank",
    description: "Your position among campers",
    kind: "kpi",
    size: "sm",
    roles: ["summer_camper", "summer_student"],
    portals: ["camper"],
  },
  {
    id: "kpi-camper-enrollments",
    title: "Active Trainings",
    description: "Enrolled camp tracks",
    kind: "kpi",
    size: "sm",
    roles: ["summer_camper", "summer_student"],
    portals: ["camper"],
  },
  {
    id: "kpi-camper-checkpoints",
    title: "Pending Checkpoints",
    description: "Checkpoints awaiting submission",
    kind: "kpi",
    size: "sm",
    roles: ["summer_camper", "summer_student"],
    portals: ["camper"],
  },
  {
    id: "kpi-camper-modules",
    title: "Modules Completed",
    description: "Published modules finished",
    kind: "kpi",
    size: "sm",
    roles: ["summer_camper", "summer_student"],
    portals: ["camper"],
  },
  {
    id: "kpi-camper-feedback",
    title: "Recent Feedback",
    description: "Instructor feedback received",
    kind: "kpi",
    size: "sm",
    roles: ["summer_camper", "summer_student"],
    portals: ["camper"],
  },
  {
    id: "kpi-camper-events",
    title: "Upcoming Events",
    description: "Camp calendar events",
    kind: "kpi",
    size: "sm",
    roles: ["summer_camper", "summer_student"],
    portals: ["camper"],
  },
  {
    id: "list-camper-trainings",
    title: "Active Trainings",
    description: "Your enrolled tracks with progress",
    kind: "list",
    size: "md",
    roles: ["summer_camper", "summer_student"],
    portals: ["camper"],
  },
  {
    id: "list-camper-checkpoints",
    title: "Pending Checkpoints",
    description: "Next checkpoints to complete",
    kind: "list",
    size: "md",
    roles: ["summer_camper", "summer_student"],
    portals: ["camper"],
  },
  {
    id: "list-camper-feedback",
    title: "Recent Feedback",
    description: "Latest reviewer notes",
    kind: "list",
    size: "md",
    roles: ["summer_camper", "summer_student"],
    portals: ["camper"],
  },
  {
    id: "list-camper-events",
    title: "Upcoming Events",
    description: "Camp calendar highlights",
    kind: "list",
    size: "md",
    roles: ["summer_camper", "summer_student"],
    portals: ["camper"],
  },
  {
    id: "list-camper-announcements",
    title: "Announcements",
    description: "Latest camp announcements",
    kind: "list",
    size: "md",
    roles: ["summer_camper", "summer_student"],
    portals: ["camper"],
  },
  {
    id: "actions-camper-quick",
    title: "Quick Actions",
    description: "Jump to camp modules",
    kind: "actions",
    size: "md",
    roles: ["summer_camper", "summer_student"],
    portals: ["camper"],
  },
]

export const DASHBOARD_TEMPLATES: Record<DashboardRoleKey, DashboardTemplate[]> = {
  platform_admin: [
    {
      id: "overview",
      name: "Platform Overview",
      description: "Institution KPIs, enrollment activity, priorities, and admin shortcuts",
      widgetIds: [
        "kpi-total-students",
        "kpi-active-courses",
        "kpi-faculty-members",
        "kpi-account-requests",
        "kpi-active-users",
        "kpi-pending-issues-admin",
        "kpi-system-health",
        "kpi-upcoming-assessments-admin",
        "chart-enrollment-trend",
        "list-admin-priorities",
        "list-recent-activity",
        "actions-admin-quick",
      ],
    },
    {
      id: "operations",
      name: "Operations Focus",
      description: "Priorities, account requests, and system health",
      widgetIds: [
        "kpi-account-requests",
        "kpi-pending-issues-admin",
        "kpi-system-health",
        "kpi-active-users",
        "kpi-total-students",
        "kpi-active-courses",
        "kpi-upcoming-assessments-admin",
        "list-admin-priorities",
        "list-recent-activity",
        "actions-admin-quick",
      ],
    },
    {
      id: "analytics",
      name: "Enrollment & Activity",
      description: "Student activity trends and institution headcount",
      widgetIds: [
        "kpi-total-students",
        "kpi-active-courses",
        "kpi-faculty-members",
        "kpi-active-users",
        "kpi-upcoming-assessments-admin",
        "chart-enrollment-trend",
        "list-recent-activity",
      ],
    },
  ],
  department_admin: [
    {
      id: "overview",
      name: "Department Overview",
      description: "Enrollment, faculty, and departmental priorities",
      widgetIds: [
        "kpi-total-students",
        "kpi-active-courses",
        "kpi-faculty-members",
        "kpi-account-requests",
        "kpi-pending-issues-admin",
        "kpi-upcoming-assessments-admin",
        "kpi-active-users",
        "chart-enrollment-trend",
        "list-admin-priorities",
        "list-recent-activity",
        "actions-admin-quick",
      ],
    },
    {
      id: "faculty-focus",
      name: "Faculty & Courses",
      description: "Course and staff metrics with activity feed",
      widgetIds: [
        "kpi-active-courses",
        "kpi-faculty-members",
        "kpi-total-students",
        "kpi-account-requests",
        "kpi-upcoming-assessments-admin",
        "kpi-active-users",
        "list-admin-priorities",
        "list-recent-activity",
        "actions-admin-quick",
      ],
    },
  ],
  instructor: [
    {
      id: "teaching",
      name: "Teaching Dashboard",
      description: "Course KPIs, charts, snapshot, and teaching shortcuts",
      widgetIds: [
        "kpi-active-quizzes",
        "kpi-course-students",
        "kpi-quiz-attempts",
        "kpi-pending-issues-faculty",
        "kpi-upcoming-assessments",
        "kpi-recent-submissions",
        "kpi-faculty-class-average",
        "kpi-faculty-total-assessments",
        "chart-submissions-over-time",
        "chart-assessment-breakdown",
        "chart-score-trend",
        "list-instructor-snapshot",
        "actions-instructor-quick",
        "list-recent-activity",
      ],
    },
    {
      id: "grading",
      name: "Grading Focus",
      description: "Submissions, issues, and score trends",
      widgetIds: [
        "kpi-recent-submissions",
        "kpi-pending-issues-faculty",
        "kpi-quiz-attempts",
        "chart-submissions-over-time",
        "chart-score-trend",
        "list-recent-activity",
        "actions-instructor-quick",
      ],
    },
    {
      id: "minimal",
      name: "Minimal",
      description: "Essential KPIs and quick actions only",
      widgetIds: [
        "kpi-active-quizzes",
        "kpi-course-students",
        "kpi-upcoming-assessments",
        "actions-instructor-quick",
      ],
    },
  ],
  ta: [
    {
      id: "ta-daily",
      name: "TA Daily View",
      description: "Checklist, submissions, and supported teaching tasks",
      widgetIds: [
        "kpi-recent-submissions",
        "kpi-course-students",
        "kpi-active-quizzes",
        "kpi-pending-issues-faculty",
        "kpi-upcoming-assessments",
        "kpi-faculty-class-average",
        "kpi-faculty-total-assessments",
        "list-ta-daily-tasks",
        "chart-submissions-over-time",
        "list-recent-activity",
        "actions-ta-quick",
      ],
    },
    {
      id: "support",
      name: "Student Support",
      description: "Issues, activity, and grading queue indicators",
      widgetIds: [
        "kpi-pending-issues-faculty",
        "kpi-recent-submissions",
        "kpi-course-students",
        "list-ta-daily-tasks",
        "list-recent-activity",
        "actions-ta-quick",
      ],
    },
  ],
  observer: [
    {
      id: "readonly",
      name: "Observer View",
      description: "Read-only course analytics",
      widgetIds: [
        "kpi-course-students",
        "kpi-active-quizzes",
        "kpi-upcoming-assessments",
        "chart-submissions-over-time",
        "chart-score-trend",
        "list-recent-activity",
      ],
    },
  ],
  student: [
    {
      id: "academic",
      name: "Academic Overview",
      description: "Grades, attendance, deadlines, and performance charts",
      widgetIds: [
        "kpi-student-overall-grade",
        "kpi-student-quiz-average",
        "kpi-student-homework-average",
        "kpi-student-attendance",
        "kpi-student-missing-work",
        "kpi-student-streak",
        "kpi-student-classroom-points",
        "kpi-student-deadlines",
        "chart-student-grade-trend",
        "chart-student-performance-comparison",
        "list-student-insights",
        "list-student-deadlines",
        "list-student-semester-timeline",
        "list-student-engagement",
        "actions-student-quick",
      ],
    },
    {
      id: "grades-focus",
      name: "Grades Focus",
      description: "Grade KPIs, trends, and insights",
      widgetIds: [
        "kpi-student-overall-grade",
        "kpi-student-quiz-average",
        "kpi-student-homework-average",
        "kpi-student-missing-work",
        "chart-student-grade-trend",
        "chart-student-performance-comparison",
        "list-student-insights",
        "actions-student-quick",
      ],
    },
    {
      id: "minimal",
      name: "Essentials",
      description: "Core KPIs and quick actions only",
      widgetIds: [
        "kpi-student-overall-grade",
        "kpi-student-attendance",
        "kpi-student-deadlines",
        "kpi-student-missing-work",
        "actions-student-quick",
      ],
    },
  ],
  summer_camper: [
    {
      id: "mission-control",
      name: "Mission Control",
      description: "Progress, XP, checkpoints, and camp activity",
      widgetIds: [
        "kpi-camper-progress",
        "kpi-camper-xp",
        "kpi-camper-rank",
        "kpi-camper-enrollments",
        "kpi-camper-checkpoints",
        "kpi-camper-modules",
        "kpi-camper-feedback",
        "kpi-camper-events",
        "list-camper-trainings",
        "list-camper-checkpoints",
        "list-camper-feedback",
        "list-camper-events",
        "list-camper-announcements",
        "actions-camper-quick",
      ],
    },
    {
      id: "progress",
      name: "Progress Focus",
      description: "Training progress and checkpoints",
      widgetIds: [
        "kpi-camper-progress",
        "kpi-camper-modules",
        "kpi-camper-checkpoints",
        "kpi-camper-enrollments",
        "list-camper-trainings",
        "list-camper-checkpoints",
        "actions-camper-quick",
      ],
    },
  ],
  summer_student: [
    {
      id: "mission-control",
      name: "Summer Student Hub",
      description: "Trainings, progress, and camp calendar",
      widgetIds: [
        "kpi-camper-progress",
        "kpi-camper-xp",
        "kpi-camper-rank",
        "kpi-camper-enrollments",
        "kpi-camper-checkpoints",
        "kpi-camper-modules",
        "kpi-camper-feedback",
        "kpi-camper-events",
        "list-camper-trainings",
        "list-camper-checkpoints",
        "list-camper-feedback",
        "list-camper-events",
        "list-camper-announcements",
        "actions-camper-quick",
      ],
    },
  ],
}

export function getWidgetDef(id: string): DashboardWidgetDef | undefined {
  return DASHBOARD_WIDGETS.find((w) => w.id === id)
}

export function getEligibleWidgets(
  portal: DashboardPortal,
  role: DashboardRoleKey,
): DashboardWidgetDef[] {
  return DASHBOARD_WIDGETS.filter(
    (w) => w.portals.includes(portal) && w.roles.includes(role),
  )
}

export function getDefaultLayout(role: DashboardRoleKey): DashboardLayoutState {
  const template = DASHBOARD_TEMPLATES[role][0]
  return {
    templateId: template.id,
    visibleWidgetIds: template.widgetIds,
  }
}

export function getTemplatesForRole(role: DashboardRoleKey): DashboardTemplate[] {
  return DASHBOARD_TEMPLATES[role] ?? []
}

export function layoutStorageKey(portal: DashboardPortal, role: DashboardRoleKey): string {
  return `dashboard-v2-layout-v7-${portal}-${role}`
}

export function getRoleDashboardTitle(role: DashboardRoleKey, portal: DashboardPortal): string {
  if (portal === "student") return "Command Center"
  if (portal === "camper") {
    return role === "summer_student" ? "Summer Student Hub" : "Mission Control"
  }
  if (portal === "admin") {
    return role === "department_admin" ? "Department Admin Dashboard" : "Admin Dashboard"
  }
  switch (role) {
    case "ta":
      return "TA Dashboard"
    case "observer":
      return "Observer Dashboard"
    case "department_admin":
      return "Department Dashboard"
    default:
      return "Instructor Dashboard"
  }
}

export function getRoleDashboardSubtitle(role: DashboardRoleKey, portal: DashboardPortal): string {
  if (portal === "student") {
    return "Grades, deadlines, and Cora — one surface"
  }
  if (portal === "camper") {
    return role === "summer_student"
      ? "Summer program progress, trainings, and camp activity"
      : "Your summer camp command center — progress, checkpoints, and what's next"
  }
  if (portal === "admin") {
    return role === "department_admin"
      ? "Department enrollment, faculty, and operational priorities"
      : "Institution-wide overview — users, courses, and system health"
  }
  switch (role) {
    case "ta":
      return "Daily support tasks, submissions, and course activity for your assigned course"
    case "observer":
      return "Read-only view of course performance and student activity"
    case "department_admin":
      return "Department-level course and faculty oversight"
    default:
      return "Teaching overview for your selected course — assessments, students, and results"
  }
}

export function widgetGridClass(size: DashboardWidgetDef["size"]): string {
  switch (size) {
    case "sm":
      return "col-span-1"
    case "md":
      return "col-span-1 lg:col-span-2"
    case "lg":
      return "col-span-1 lg:col-span-3"
    case "full":
      return "col-span-full"
    default:
      return "col-span-1"
  }
}
