"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  Activity,
  AlertCircle,
  BarChart3,
  BookOpen,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileCode,
  Flame,
  GraduationCap,
  Library,
  LogIn,
  Server,
  Shield,
  Sparkles,
  Sun,
  Target,
  Trophy,
  UserCog,
  Users,
  UsersRound,
  Zap,
} from "lucide-react"
import { FACULTY_DASHBOARD_KPI_THUMBS, STUDENT_DASHBOARD_KPI_THUMBS } from "@/lib/student-color-hunt-theme"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { SubmissionsOverTimeChart } from "@/components/instructor/dashboard-v2/SubmissionsOverTimeChart"
import { AssessmentBreakdownChart } from "@/components/instructor/dashboard-v2/AssessmentBreakdownChart"
import { ScoreTrendChart } from "@/components/instructor/dashboard-v2/ScoreTrendChart"
import { EnrollmentTrendChart } from "@/components/instructor/dashboard-v2/EnrollmentTrendChart"
import { getDashboardBasePath } from "@/lib/dashboard-v2/portal-paths"
import { formatDashboardTimeAgo, facultyActivityHref } from "@/lib/dashboard-v2/activity-format"
import type { FacultyDashboardStats } from "@/lib/dashboard-v2/types"
import { campRoute } from "@/lib/summer-camp/camper-nav"
import { cn } from "@/lib/utils"
import {
  LazyEngagementStats,
  LazyGradeTrendChart,
  LazyPerformanceComparisonChart,
  LazyPerformanceInsightsCard,
  LazyStudentInterventionRecommendations,
  LazySemesterTimelinePanel,
  LazyUpcomingDeadlinesPanel,
} from "@/components/dashboard-v2/lazy-student-widgets"
import { useDashboardData } from "./DashboardDataContext"
import { DashboardKpiCard, DashboardPanel } from "./DashboardKpiCard"

function activityIcon(type: string, category?: string): { icon: LucideIcon; bg: string; color: string } {
  if (type === "account_request") {
    return {
      icon: Shield,
      bg: "bg-rose-500/10",
      color: "text-rose-600 dark:text-rose-400",
    }
  }
  if (type === "rbac_audit") {
    return {
      icon: FileCode,
      bg: "bg-violet-500/10",
      color: "text-violet-600 dark:text-violet-400",
    }
  }
  if (category === "auth" || type === "audit") {
    return {
      icon: LogIn,
      bg: "bg-indigo-500/10",
      color: "text-indigo-600 dark:text-indigo-400",
    }
  }
  return {
    icon: Activity,
    bg: "bg-emerald-500/10",
    color: "text-emerald-600 dark:text-emerald-400",
  }
}

function facultyKpiActivityScopeSub(stats: FacultyDashboardStats | null): string {
  if (!stats?.scopeTermLabel && !stats?.scopeSessionCode) return "Selected offering"
  if (stats.scopeSessionCode && stats.scopeTermLabel) {
    return `${stats.scopeTermLabel} · ${stats.scopeSessionCode}`
  }
  return stats.scopeTermLabel ?? stats.scopeSessionCode ?? "Selected offering"
}

function facultyKpiMaterialsSub(stats: FacultyDashboardStats | null): string {
  const total = stats?.totalQuizzes ?? 0
  return `${total} in course library (incl. exchange)`
}

export function DashboardWidgetRenderer({ widgetId }: { widgetId: string }) {
  const { adminStats, facultyStats, studentStats, camperStats, camperHub, recentActivity, portal, loading } =
    useDashboardData()
  const studentKpiLoading = portal === "student" && loading && !studentStats
  const facultyKpiLoading = portal === "faculty" && loading && !facultyStats
  const instructorCtx = useInstructorDashboardV2()
  const basePath =
    portal === "faculty" || portal === "admin"
      ? instructorCtx.basePath
      : getDashboardBasePath(portal)

  switch (widgetId) {
    case "kpi-total-students":
      return (
        <DashboardKpiCard
          label="Total Students"
          value={adminStats?.totalStudents ?? 0}
          sub="Registered accounts"
          icon={UsersRound}
          accent="emerald"
        />
      )
    case "kpi-active-courses":
      return (
        <DashboardKpiCard
          label="Active Courses"
          value={adminStats?.activeCourses ?? 0}
          sub="Currently offered"
          icon={BookOpen}
          accent="blue"
        />
      )
    case "kpi-faculty-members":
      return (
        <DashboardKpiCard
          label="Faculty & Staff"
          value={adminStats?.totalFaculty ?? 0}
          sub={`${adminStats?.instructorCount ?? 0} instructors · ${adminStats?.taCount ?? 0} TAs`}
          icon={UserCog}
          accent="violet"
        />
      )
    case "kpi-active-users":
      return (
        <DashboardKpiCard
          label="Platform Events (24h)"
          value={adminStats?.activeUsers24h ?? 0}
          sub="Audit & activity log events"
          icon={Activity}
          accent="sky"
        />
      )
    case "kpi-pending-issues-admin":
      return (
        <DashboardKpiCard
          label="Open Issues"
          value={adminStats?.pendingIssues ?? 0}
          sub={(adminStats?.pendingIssues ?? 0) > 0 ? "Needs review" : "All clear"}
          icon={AlertCircle}
          accent={(adminStats?.pendingIssues ?? 0) > 0 ? "amber" : "slate"}
        />
      )
    case "kpi-system-health":
      return (
        <DashboardKpiCard
          label="System Health"
          value={`${adminStats?.systemHealth ?? 0}%`}
          sub="Database & platform status"
          icon={Server}
          accent="indigo"
        />
      )
    case "kpi-account-requests":
      return (
        <DashboardKpiCard
          label="Account Requests"
          value={adminStats?.pendingAccountRequests ?? 0}
          sub="Awaiting approval"
          icon={Shield}
          accent="rose"
        />
      )
    case "kpi-upcoming-assessments-admin":
      return (
        <DashboardKpiCard
          label="Upcoming Assessments"
          value={adminStats?.upcomingAssessments ?? 0}
          sub="Opening within 7 days"
          icon={ClipboardList}
          accent="orange"
        />
      )
    case "kpi-active-quizzes":
      return (
        <DashboardKpiCard
          label="Active Quizzes"
          value={facultyStats?.activeQuizzes ?? 0}
          sub={facultyKpiMaterialsSub(facultyStats)}
          icon={ClipboardList}
          solidThumb={FACULTY_DASHBOARD_KPI_THUMBS.activeQuizzes}
          isLoading={facultyKpiLoading}
        />
      )
    case "kpi-course-students":
      return (
        <DashboardKpiCard
          label="Students"
          value={facultyStats?.totalStudents ?? 0}
          sub={facultyKpiActivityScopeSub(facultyStats)}
          icon={UsersRound}
          solidThumb={FACULTY_DASHBOARD_KPI_THUMBS.students}
          isLoading={facultyKpiLoading}
        />
      )
    case "kpi-quiz-attempts":
      return (
        <DashboardKpiCard
          label="Quiz Attempts"
          value={facultyStats?.totalAttempts ?? 0}
          sub={facultyKpiActivityScopeSub(facultyStats)}
          icon={BarChart3}
          solidThumb={FACULTY_DASHBOARD_KPI_THUMBS.attempts}
          isLoading={facultyKpiLoading}
        />
      )
    case "kpi-recent-submissions":
      return (
        <DashboardKpiCard
          label="Submissions (24h)"
          value={facultyStats?.recentSubmissions24h ?? 0}
          sub={facultyKpiActivityScopeSub(facultyStats)}
          icon={Activity}
          solidThumb={FACULTY_DASHBOARD_KPI_THUMBS.submissions}
          isLoading={facultyKpiLoading}
        />
      )
    case "kpi-pending-issues-faculty": {
      const pending = (facultyStats?.pendingIssues ?? 0) > 0
      return (
        <DashboardKpiCard
          label="Pending Issues"
          value={facultyStats?.pendingIssues ?? 0}
          sub={
            (facultyStats?.pendingIssues ?? 0) > 0
              ? facultyKpiActivityScopeSub(facultyStats)
              : "All clear"
          }
          icon={AlertCircle}
          solidThumb={pending ? FACULTY_DASHBOARD_KPI_THUMBS.pendingIssues : FACULTY_DASHBOARD_KPI_THUMBS.pendingClear}
          isLoading={facultyKpiLoading}
        />
      )
    }
    case "kpi-upcoming-assessments":
      return (
        <DashboardKpiCard
          label="Upcoming"
          value={facultyStats?.upcomingAssessments ?? 0}
          sub={facultyKpiMaterialsSub(facultyStats)}
          icon={ClipboardList}
          solidThumb={FACULTY_DASHBOARD_KPI_THUMBS.upcoming}
          isLoading={facultyKpiLoading}
        />
      )
    case "kpi-faculty-class-average":
      return (
        <DashboardKpiCard
          label="Class Average"
          value={`${facultyStats?.classAverageScore ?? 0}%`}
          sub={facultyKpiActivityScopeSub(facultyStats)}
          icon={Target}
          solidThumb={FACULTY_DASHBOARD_KPI_THUMBS.classAverage}
          isLoading={facultyKpiLoading}
        />
      )
    case "kpi-faculty-total-assessments":
      return (
        <DashboardKpiCard
          label="Total Assessments"
          value={facultyStats?.totalQuizzes ?? 0}
          sub={facultyKpiMaterialsSub(facultyStats)}
          icon={Library}
          solidThumb={FACULTY_DASHBOARD_KPI_THUMBS.totalAssessments}
          isLoading={facultyKpiLoading}
        />
      )
    case "chart-submissions-over-time":
      return <SubmissionsOverTimeChart />
    case "chart-assessment-breakdown":
      return <AssessmentBreakdownChart />
    case "chart-score-trend":
      return <ScoreTrendChart />
    case "chart-enrollment-trend":
      return <EnrollmentTrendChart />
    case "list-recent-activity":
      return (
        <DashboardPanel
          title={portal === "admin" ? "Recent Audit & Activity" : "Recent Activity"}
          action={
            <Link
              href={
                portal === "admin"
                  ? "/admin/dashboard-v2/administration/audit-logs"
                  : `${basePath}/results`
              }
              className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              View all
            </Link>
          }
        >
          {recentActivity.length === 0 ? (
            <div className="py-8 text-center rounded-xl border border-dashed border-slate-300 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
              {portal === "admin" ? (
                <FileCode className="h-8 w-8 mx-auto text-slate-400 mb-2" />
              ) : (
                <GraduationCap className="h-8 w-8 mx-auto text-slate-400 mb-2" />
              )}
              <p className="text-sm text-slate-500 dark:text-slate-400">No recent activity yet</p>
              <p className="text-xs text-slate-400 mt-1">
                {portal === "admin"
                  ? "Platform audit logs will appear here as users interact with the system"
                  : "Submissions and course events will appear here"}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {recentActivity.slice(0, 10).map((item, index) => {
                const meta = activityIcon(item.type, item.category)
                const Icon = meta.icon
                const href =
                  portal === "faculty" || portal === "admin"
                    ? facultyActivityHref(basePath, item)
                    : null
                const rowClass =
                  "flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-100/80 dark:hover:bg-white/5 transition-colors"
                const content = (
                  <>
                    <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", meta.bg)}>
                      <Icon className={cn("h-4 w-4", meta.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-white line-clamp-2">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {item.message ?? item.description ?? item.actor_label ?? "—"}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 tabular-nums">
                      {formatDashboardTimeAgo(item.created_at ?? item.timestamp)}
                    </span>
                  </>
                )

                return href ? (
                  <Link
                    key={item.id ?? `activity-${index}`}
                    href={href}
                    className={cn(rowClass, "group")}
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={item.id ?? `activity-${index}`} className={rowClass}>
                    {content}
                  </div>
                )
              })}
            </div>
          )}
        </DashboardPanel>
      )
    case "list-admin-priorities":
      return (
        <DashboardPanel title="Administration Priorities">
          <ul className="space-y-3">
            {[
              {
                label: "Open quiz issues",
                value: adminStats?.pendingIssues ?? 0,
                tone: (adminStats?.pendingIssues ?? 0) > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300",
              },
              {
                label: "Pending account requests",
                value: adminStats?.pendingAccountRequests ?? 0,
                tone: (adminStats?.pendingAccountRequests ?? 0) > 0 ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300",
              },
              {
                label: "Active courses to monitor",
                value: adminStats?.activeCourses ?? 0,
                tone: "text-slate-700 dark:text-slate-300",
              },
              {
                label: "Platform events (24h)",
                value: adminStats?.activeUsers24h ?? 0,
                tone: "text-indigo-700 dark:text-indigo-300",
              },
            ].map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 dark:border-white/10 px-4 py-3 bg-slate-50/60 dark:bg-white/[0.03]"
              >
                <span className="text-sm text-slate-700 dark:text-slate-300">{row.label}</span>
                <span className={cn("text-sm font-semibold tabular-nums", row.tone)}>{row.value}</span>
              </li>
            ))}
          </ul>
        </DashboardPanel>
      )
    case "list-instructor-snapshot":
      return (
        <DashboardPanel title="Course Snapshot">
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-[var(--cc-text-secondary)]">
              Your course currently has{" "}
              <strong className="text-[var(--cc-text)]">{facultyStats?.totalStudents ?? 0}</strong> students
              with <strong className="text-[var(--cc-text)]">{facultyStats?.activeQuizzes ?? 0}</strong> active
              assessments and <strong className="text-[var(--cc-text)]">{facultyStats?.totalAttempts ?? 0}</strong>{" "}
              total submissions.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Pending issues", value: facultyStats?.pendingIssues ?? 0 },
                { label: "Upcoming opens", value: facultyStats?.upcomingAssessments ?? 0 },
                { label: "Submissions (24h)", value: facultyStats?.recentSubmissions24h ?? 0 },
                { label: "Total quizzes", value: facultyStats?.totalQuizzes ?? 0 },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/35 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--cc-text-muted)]">{item.label}</p>
                  <p className="text-lg font-semibold tabular-nums text-[var(--cc-text)]">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </DashboardPanel>
      )
    case "list-ta-daily-tasks":
      return (
        <DashboardPanel title="TA Daily Checklist">
          <ul className="space-y-2">
            {[
              { done: (facultyStats?.recentSubmissions24h ?? 0) === 0, text: "Review new quiz submissions" },
              { done: (facultyStats?.pendingIssues ?? 0) === 0, text: "Check reported quiz issues" },
              { done: true, text: "Confirm office hours / lab coverage" },
              { done: (facultyStats?.upcomingAssessments ?? 0) > 0, text: "Prepare for upcoming assessment opens" },
            ].map((task) => (
              <li
                key={task.text}
                className="flex items-start gap-3 rounded-xl border border-[var(--border)] px-4 py-3"
              >
                <CheckCircle2
                  className={cn(
                    "h-5 w-5 shrink-0 mt-0.5",
                    task.done ? "text-[var(--cc-success)]" : "text-[var(--cc-text-muted)]",
                  )}
                />
                <span className="text-sm text-[var(--cc-text)]">{task.text}</span>
              </li>
            ))}
          </ul>
        </DashboardPanel>
      )
    case "actions-admin-quick":
      return (
        <QuickActionsPanel
          actions={[
            { label: "Manage Users", href: "/admin/dashboard-v2/management/students", icon: UsersRound, color: "text-emerald-600" },
            { label: "Course Assignments", href: "/admin/dashboard-v2/courses/assignments", icon: UserCog, color: "text-violet-600" },
            { label: "Faculty Management", href: "/admin/dashboard-v2/management/faculty", icon: Users, color: "text-blue-600" },
            { label: "System Monitor", href: "/admin/dashboard-v2/administration/system-monitor", icon: Server, color: "text-indigo-600" },
          ]}
        />
      )
    case "actions-instructor-quick":
      return (
        <QuickActionsPanel
          actions={[
            { label: "Manage Quizzes", href: `${basePath}/assessments/quizzes`, icon: ClipboardList, color: "text-blue-600" },
            { label: "Results & Analytics", href: `${basePath}/results`, icon: BarChart3, color: "text-orange-600" },
            { label: "Question Bank", href: `${basePath}/assessments/quizzes/question-bank`, icon: Library, color: "text-purple-600" },
            { label: "Students", href: `${basePath}/management/students`, icon: UsersRound, color: "text-emerald-600" },
          ]}
        />
      )
    case "actions-ta-quick":
      return (
        <QuickActionsPanel
          actions={[
            { label: "View Results", href: `${basePath}/results`, icon: BarChart3, color: "text-orange-600" },
            { label: "Attendance", href: `${basePath}/assessments/attendance`, icon: ClipboardList, color: "text-blue-600" },
            { label: "Announcements", href: `${basePath}/communication/announcements`, icon: Library, color: "text-purple-600" },
            { label: "Students", href: `${basePath}/management/students`, icon: UsersRound, color: "text-emerald-600" },
          ]}
        />
      )
    case "kpi-student-overall-grade":
      return (
        <DashboardKpiCard
          label="Overall Grade"
          value={studentStats?.overallGrade ?? 0}
          valueKind="percent"
          sub={studentStats?.letterGrade ?? "—"}
          icon={GraduationCap}
          solidThumb={STUDENT_DASHBOARD_KPI_THUMBS.overallGrade}
          isLoading={studentKpiLoading}
        />
      )
    case "kpi-student-quiz-average":
      return (
        <DashboardKpiCard
          label="Quiz Average"
          value={studentStats?.quizAverage ?? 0}
          valueKind="percent"
          sub={`Class avg ${studentStats?.classQuizAverage ?? 0}%`}
          icon={ClipboardList}
          solidThumb={STUDENT_DASHBOARD_KPI_THUMBS.quizAverage}
          isLoading={studentKpiLoading}
        />
      )
    case "kpi-student-homework-average":
      return (
        <DashboardKpiCard
          label="Homework Average"
          value={studentStats?.homeworkAverage ?? 0}
          valueKind="percent"
          sub="Completed assignments"
          icon={BookOpen}
          solidThumb={STUDENT_DASHBOARD_KPI_THUMBS.homeworkAverage}
          isLoading={studentKpiLoading}
        />
      )
    case "kpi-student-attendance":
      return (
        <DashboardKpiCard
          label="Attendance"
          value={studentStats?.attendancePct ?? 0}
          valueKind="percent"
          sub={`${studentStats?.classesMissed ?? 0} classes missed`}
          icon={CalendarCheck}
          solidThumb={STUDENT_DASHBOARD_KPI_THUMBS.attendance}
          isLoading={studentKpiLoading}
        />
      )
    case "kpi-student-missing-work": {
      const missing = (studentStats?.missingAssignments ?? 0) > 0
      return (
        <DashboardKpiCard
          label="Missing Work"
          value={studentStats?.missingAssignments ?? 0}
          valueKind="count"
          sub={missing ? "Needs attention" : "All caught up"}
          icon={AlertCircle}
          solidThumb={missing ? STUDENT_DASHBOARD_KPI_THUMBS.missingWork : STUDENT_DASHBOARD_KPI_THUMBS.missingWorkClear}
          isLoading={studentKpiLoading}
        />
      )
    }
    case "kpi-student-streak":
      return (
        <DashboardKpiCard
          label="Attendance Streak"
          value={studentStats?.attendanceStreak ?? 0}
          valueKind="count"
          sub="Consecutive classes"
          icon={Flame}
          solidThumb={STUDENT_DASHBOARD_KPI_THUMBS.streak}
          isLoading={studentKpiLoading}
        />
      )
    case "kpi-student-classroom-points":
      return (
        <DashboardKpiCard
          label="Classroom Points"
          value={studentStats?.classroomPoints ?? 0}
          valueKind="decimal"
          sub={`${studentStats?.engagementCredits ?? 0}/10 engagement credits`}
          icon={Zap}
          solidThumb={STUDENT_DASHBOARD_KPI_THUMBS.classroomPoints}
          isLoading={studentKpiLoading}
        />
      )
    case "kpi-student-deadlines":
      return (
        <DashboardKpiCard
          label="Upcoming Deadlines"
          value={studentStats?.upcomingDeadlines ?? 0}
          valueKind="count"
          sub="Quizzes & homework due"
          icon={Calendar}
          solidThumb={STUDENT_DASHBOARD_KPI_THUMBS.upcoming}
          isLoading={studentKpiLoading}
        />
      )
    case "chart-student-grade-trend":
      return <LazyGradeTrendChart />
    case "chart-student-performance-comparison":
      return <LazyPerformanceComparisonChart />
    case "list-student-insights":
      return (
        <div className="space-y-4">
          <LazyStudentInterventionRecommendations />
          <LazyPerformanceInsightsCard />
        </div>
      )
    case "list-student-deadlines":
      return <LazyUpcomingDeadlinesPanel />
    case "list-student-semester-timeline":
      return <LazySemesterTimelinePanel />
    case "list-student-engagement":
      return <LazyEngagementStats />
    case "actions-student-quick":
      return (
        <QuickActionsPanel
          actions={[
            { label: "Cora", href: `${basePath}/ai-tutor`, icon: Sparkles, color: "text-[var(--cc-accent-dark)]" },
            { label: "Quizzes", href: `${basePath}/quizzes`, icon: ClipboardList, color: "text-[var(--cc-accent-dark)]" },
            { label: "Grades", href: `${basePath}/grades`, icon: BarChart3, color: "text-[var(--cc-accent-dark)]" },
            { label: "Practice Hub", href: `${basePath}/practice`, icon: Library, color: "text-[var(--cc-accent-dark)]" },
          ]}
        />
      )
    case "kpi-camper-progress":
      return (
        <DashboardKpiCard
          label="Camp Progress"
          value={`${camperStats?.overallPercent ?? 0}%`}
          sub={`${camperStats?.modulesCompleted ?? 0}/${camperStats?.totalModules ?? 0} modules`}
          icon={Sun}
          accent="violet"
        />
      )
    case "kpi-camper-xp":
      return (
        <DashboardKpiCard
          label="Camp XP"
          value={camperStats?.totalXp ?? 0}
          sub="Experience points"
          icon={Zap}
          accent="amber"
        />
      )
    case "kpi-camper-rank":
      return (
        <DashboardKpiCard
          label="Leaderboard Rank"
          value={
            camperStats?.leaderboardRank != null
              ? `#${camperStats.leaderboardRank}`
              : "—"
          }
          sub={
            camperStats?.leaderboardTotal != null
              ? `of ${camperStats.leaderboardTotal} campers`
              : "Join leaderboard"
          }
          icon={Trophy}
          accent="lime"
        />
      )
    case "kpi-camper-enrollments":
      return (
        <DashboardKpiCard
          label="Active Trainings"
          value={camperStats?.enrollmentCount ?? 0}
          sub="Enrolled tracks"
          icon={GraduationCap}
          accent="emerald"
        />
      )
    case "kpi-camper-checkpoints":
      return (
        <DashboardKpiCard
          label="Pending Checkpoints"
          value={camperStats?.pendingCheckpoints ?? 0}
          sub={(camperStats?.pendingCheckpoints ?? 0) > 0 ? "Awaiting submission" : "All caught up"}
          icon={Target}
          accent="orange"
        />
      )
    case "kpi-camper-modules":
      return (
        <DashboardKpiCard
          label="Modules Completed"
          value={camperStats?.modulesCompleted ?? 0}
          sub={`${camperStats?.totalModules ?? 0} total modules`}
          icon={BookOpen}
          accent="blue"
        />
      )
    case "kpi-camper-feedback":
      return (
        <DashboardKpiCard
          label="Recent Feedback"
          value={camperStats?.recentFeedbackCount ?? 0}
          sub="Reviewer notes"
          icon={Activity}
          accent="indigo"
        />
      )
    case "kpi-camper-events":
      return (
        <DashboardKpiCard
          label="Upcoming Events"
          value={camperStats?.upcomingEvents ?? 0}
          sub="On camp calendar"
          icon={Calendar}
          accent="sky"
        />
      )
    case "list-camper-trainings":
      return <CamperTrainingsPanel hub={camperHub} />
    case "list-camper-checkpoints":
      return <CamperCheckpointsPanel hub={camperHub} />
    case "list-camper-feedback":
      return <CamperFeedbackPanel hub={camperHub} />
    case "list-camper-events":
      return <CamperEventsPanel hub={camperHub} />
    case "list-camper-announcements":
      return <CamperAnnouncementsPanel hub={camperHub} />
    case "actions-camper-quick":
      return (
        <QuickActionsPanel
          actions={[
            { label: "My Trainings", href: campRoute("/my-trainings"), icon: GraduationCap, color: "text-violet-600" },
            { label: "Roadmap", href: campRoute("/roadmap"), icon: Target, color: "text-orange-600" },
            { label: "Leaderboard", href: campRoute("/leaderboard"), icon: Trophy, color: "text-amber-600" },
            { label: "Browse Trainings", href: campRoute("/browse"), icon: Sun, color: "text-emerald-600" },
          ]}
        />
      )
    default:
      return null
  }
}

function CamperTrainingsPanel({ hub }: { hub: Record<string, unknown> | null }) {
  const enrollments = (hub?.enrollments as Array<{ enrollment_id: number; training_id: number; training_title: string; camp_title: string }>) ?? []
  const progress = (hub?.progress as Array<{ training_id: number; percent: number; completed_modules: number; total_modules: number }>) ?? []

  return (
    <DashboardPanel
      title="Active Trainings"
      action={
        <Link href={campRoute("/my-trainings")} className="text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline">
          View all
        </Link>
      }
    >
      {enrollments.length === 0 ? (
        <p className="text-sm text-slate-500">Browse trainings to enroll in your first track.</p>
      ) : (
        <div className="space-y-2">
          {enrollments.slice(0, 4).map((en) => {
            const prog = progress.find((p) => p.training_id === en.training_id)
            return (
              <Link
                key={en.enrollment_id}
                href={campRoute(`/training/${en.training_id}`)}
                className="block rounded-xl border border-slate-200/70 dark:border-white/10 px-4 py-3 hover:border-violet-500/40"
              >
                <p className="font-medium text-slate-900 dark:text-white">{en.training_title}</p>
                <p className="text-xs text-slate-500">{en.camp_title}</p>
                {prog ? (
                  <p className="text-xs text-violet-600 mt-1">{prog.percent}% · {prog.completed_modules}/{prog.total_modules} modules</p>
                ) : null}
              </Link>
            )
          })}
        </div>
      )}
    </DashboardPanel>
  )
}

function CamperCheckpointsPanel({ hub }: { hub: Record<string, unknown> | null }) {
  const checkpoints = (hub?.upcoming_checkpoints as Array<{ block_id: number; module_id: number; module_title: string; training_title: string; content?: { title?: string } }>) ?? []
  return (
    <DashboardPanel
      title="Pending Checkpoints"
      action={
        <Link href={campRoute("/checkpoints")} className="text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline">
          View all
        </Link>
      }
    >
      {checkpoints.length === 0 ? (
        <p className="text-sm text-slate-500">All caught up!</p>
      ) : (
        <ul className="space-y-2">
          {checkpoints.slice(0, 5).map((cp) => (
            <li key={cp.block_id}>
              <Link href={campRoute(`/module/${cp.module_id}`)} className="text-sm hover:text-violet-600">
                <span className="font-medium">{cp.content?.title ?? "Checkpoint"}</span>
                <span className="text-slate-500 block text-xs">{cp.training_title} · {cp.module_title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  )
}

function CamperFeedbackPanel({ hub }: { hub: Record<string, unknown> | null }) {
  const feedback = (hub?.recent_feedback as Array<{ module_id: number; module_title: string; feedback: string; status: string }>) ?? []
  return (
    <DashboardPanel title="Recent Feedback">
      {feedback.length === 0 ? (
        <p className="text-sm text-slate-500">No feedback yet.</p>
      ) : (
        <ul className="space-y-2">
          {feedback.slice(0, 4).map((fb, i) => (
            <li key={i} className="text-sm">
              <Link href={campRoute(`/module/${fb.module_id}`)} className="font-medium hover:underline">
                {fb.module_title}
              </Link>
              <p className="text-slate-500 mt-0.5 line-clamp-2">{fb.feedback}</p>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  )
}

function CamperEventsPanel({ hub }: { hub: Record<string, unknown> | null }) {
  const events = (hub?.upcoming_events as Array<{ id: number; title: string; date: string | null }>) ?? []
  return (
    <DashboardPanel
      title="Upcoming Events"
      action={
        <Link href={campRoute("/calendar")} className="text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline">
          Calendar
        </Link>
      }
    >
      {events.length === 0 ? (
        <p className="text-sm text-slate-500">No upcoming events.</p>
      ) : (
        <ul className="space-y-2">
          {events.slice(0, 5).map((ev) => (
            <li key={ev.id} className="flex justify-between gap-2 text-sm">
              <span className="font-medium">{ev.title}</span>
              <span className="text-slate-500 text-xs shrink-0">{ev.date ?? "TBD"}</span>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  )
}

function CamperAnnouncementsPanel({ hub }: { hub: Record<string, unknown> | null }) {
  const announcements = (hub?.announcements as Array<{ id: number; title: string; body: string }>) ?? []
  return (
    <DashboardPanel
      title="Announcements"
      action={
        <Link href={campRoute("/announcements")} className="text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline">
          View all
        </Link>
      }
    >
      {announcements.length === 0 ? (
        <p className="text-sm text-slate-500">No announcements yet.</p>
      ) : (
        announcements.slice(0, 3).map((a) => (
          <div key={a.id} className="text-sm mb-3 last:mb-0">
            <p className="font-medium">{a.title}</p>
            <p className="text-slate-500 line-clamp-2 mt-0.5">{a.body}</p>
          </div>
        ))
      )}
    </DashboardPanel>
  )
}

function QuickActionsPanel({
  actions,
}: {
  actions: { label: string; href: string; icon: LucideIcon; color: string }[]
}) {
  return (
    <DashboardPanel title="Quick Actions">
      <div className="grid flex-1 grid-cols-2 gap-2">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <Link
              key={action.href}
              href={action.href}
              className="group/link flex min-h-0 items-center gap-3 rounded-2xl bg-[var(--muted)]/35 px-3.5 py-3 transition-colors hover:bg-[var(--cc-accent-soft)] [.cc-desktop-native-content_&]:rounded-[6px] [.cc-desktop-native-content_&]:px-2.5 [.cc-desktop-native-content_&]:py-2"
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--card)] [.cc-desktop-native-content_&]:size-7 [.cc-desktop-native-content_&]:rounded-[6px]">
                <Icon className={cn("h-4 w-4", action.color)} />
              </div>
              <span className="flex-1 text-sm font-medium text-[var(--cc-text)]">{action.label}</span>
              <ChevronRight className="h-4 w-4 text-[var(--cc-text-muted)] transition-transform group-hover/link:translate-x-0.5" />
            </Link>
          )
        })}
      </div>
    </DashboardPanel>
  )
}
