"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import { formatCentralDate } from "@/lib/timezone"
import {
  hasEngagementDistributionData,
  type ClassAnalyticsSort,
  type ClassAnalyticsStudentRow,
} from "@/lib/class-analytics-utils"
import type {
  ClassAnalyticsAttendanceTrendPoint,
  ClassAnalyticsEngagementBand,
  ClassAnalyticsOverviewStats,
} from "@/lib/class-analytics-types"
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Dumbbell,
  GraduationCap,
  LineChart,
  Star,
  Users,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

const ENGAGEMENT_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#94a3b8"]
const SORT_OPTIONS: Array<{ id: ClassAnalyticsSort; label: string }> = [
  { id: "engagement", label: "Engagement" },
  { id: "assessments", label: "Assessments" },
  { id: "practice", label: "Practice" },
  { id: "attendance", label: "Attendance" },
  { id: "points", label: "Points" },
  { id: "lectures", label: "Lectures" },
  { id: "flashcards", label: "Flashcards" },
  { id: "playground", label: "Playground" },
]

function scoreTone(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 60) return "text-amber-600 dark:text-amber-400"
  return "text-rose-600 dark:text-rose-400"
}

type PanelChrome = {
  cardBase: string
  cardHeaderBase: string
  cardIconBase: string
  cardIcon: string
}

export function ClassAnalyticsOverviewPanels({
  overview,
  engagementDistribution,
  weeklyTrend,
  rosterCount,
  chrome,
}: {
  overview: ClassAnalyticsOverviewStats
  engagementDistribution: ClassAnalyticsEngagementBand[]
  weeklyTrend: ClassAnalyticsAttendanceTrendPoint[]
  rosterCount: number
  chrome: PanelChrome
}) {
  const trendData = useMemo(
    () =>
      weeklyTrend.map((point) => ({
        week: point.week ? formatCentralDate(point.week, "MMM d") : "—",
        rate: Number(point.attendance_rate) || 0,
      })),
    [weeklyTrend],
  )

  const hasTrend = trendData.some((point) => point.rate > 0)

  return (
    <div className="space-y-6">
      <Card className={chrome.cardBase}>
        <CardHeader className="pb-4">
          <CardTitle className={chrome.cardHeaderBase}>
            <div className={chrome.cardIconBase}>
              <BarChart3 className={chrome.cardIcon} />
            </div>
            Class signals
          </CardTitle>
          <CardDescription className="text-slate-600 dark:text-slate-400">
            Cross-module engagement across assessments, practice, attendance, and classroom points
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SignalTile
              icon={GraduationCap}
              label="Avg assessment"
              value={overview.avgAssessment != null ? `${overview.avgAssessment}%` : "—"}
              detail={overview.submissionCount > 0 ? `${overview.submissionCount} submissions` : undefined}
            />
            <SignalTile
              icon={Dumbbell}
              label="Active in practice"
              value={String(overview.activePracticers)}
              detail={rosterCount > 0 ? `of ${rosterCount} roster` : undefined}
            />
            <SignalTile
              icon={CheckCircle2}
              label="Avg attendance"
              value={overview.avgAttendance != null ? `${overview.avgAttendance}%` : "—"}
            />
            <SignalTile
              icon={Star}
              label="Classroom points"
              value={String(Math.round(overview.totalClassPoints))}
            />
            <SignalTile
              icon={GraduationCap}
              label="Lecture viewers"
              value={String(overview.activeLectureViewers)}
              detail={rosterCount > 0 ? `of ${rosterCount} roster` : undefined}
            />
            <SignalTile
              icon={Dumbbell}
              label="Flashcard studiers"
              value={String(overview.activeFlashcardStudiers)}
              detail={rosterCount > 0 ? `of ${rosterCount} roster` : undefined}
            />
            <SignalTile
              icon={BarChart3}
              label="Playground players"
              value={String(overview.activePlaygroundPlayers)}
              detail={rosterCount > 0 ? `of ${rosterCount} roster` : undefined}
            />
          </div>
        </CardContent>
      </Card>

      {hasEngagementDistributionData(engagementDistribution) ? (
        <Card className={chrome.cardBase}>
          <CardHeader className="pb-4">
            <CardTitle className={chrome.cardHeaderBase}>
              <div className={chrome.cardIconBase}>
                <Users className={chrome.cardIcon} />
              </div>
              Engagement distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={engagementDistribution} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {engagementDistribution.map((_, index) => (
                      <Cell key={index} fill={ENGAGEMENT_COLORS[index % ENGAGEMENT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {hasTrend ? (
        <Card className={chrome.cardBase}>
          <CardHeader className="pb-4">
            <CardTitle className={chrome.cardHeaderBase}>
              <div className={chrome.cardIconBase}>
                <LineChart className={chrome.cardIcon} />
              </div>
              Attendance trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="rate" stroke="#0d9488" strokeWidth={2.5} name="Attendance %" />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

export function ClassAnalyticsRosterPanel({
  rows,
  searchQuery,
  chrome,
  emptyMessage,
}: {
  rows: ClassAnalyticsStudentRow[]
  searchQuery: string
  chrome: PanelChrome
  emptyMessage?: string
}) {
  const [sort, setSort] = useState<ClassAnalyticsSort>("engagement")

  const visibleRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const filtered = q
      ? rows.filter((row) => {
          const hay = [
            row.student.full_name,
            row.student.student_id,
            row.student.section,
            row.student.session_code,
            ...row.signals,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
          return hay.includes(q)
        })
      : rows
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "assessments":
          return (b.assessmentAvg ?? -1) - (a.assessmentAvg ?? -1) || b.assessmentCount - a.assessmentCount
        case "practice":
          return (b.practiceScore ?? -1) - (a.practiceScore ?? -1) || b.practiceAttempts - a.practiceAttempts
        case "points":
          return b.classroomPoints - a.classroomPoints
        case "attendance":
          return (b.attendanceRate ?? -1) - (a.attendanceRate ?? -1)
        case "lectures":
          return b.lecturesCompleted - a.lecturesCompleted || b.lecturesOpened - a.lecturesOpened
        case "flashcards":
          return b.flashcardsDecksStudied - a.flashcardsDecksStudied || b.flashcardsStudyEvents - a.flashcardsStudyEvents
        case "playground":
          return b.playgroundTotalScore - a.playgroundTotalScore || b.playgroundSessionsPlayed - a.playgroundSessionsPlayed
        case "name":
          return a.student.full_name.localeCompare(b.student.full_name)
        default:
          return b.engagementScore - a.engagementScore || a.student.full_name.localeCompare(b.student.full_name)
      }
    })
  }, [rows, searchQuery, sort])

  if (rows.length === 0) {
    return (
      <Card className={chrome.cardBase}>
        <CardContent className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          {emptyMessage ??
            "Assessment submissions, practice, attendance, and classroom points will appear here as students engage."}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SORT_OPTIONS.map((option) => (
          <Button
            key={option.id}
            type="button"
            size="sm"
            variant={sort === option.id ? "default" : "outline"}
            className="h-8 rounded-full"
            onClick={() => setSort(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {visibleRows.length === 0 ? (
        <Card className={chrome.cardBase}>
          <CardContent className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No students match your search.
          </CardContent>
        </Card>
      ) : (
        visibleRows.map((row) => {
          const metrics = [
            row.assessmentAvg != null ? `${row.assessmentAvg}% assessments` : null,
            row.practiceAttempts > 0 && row.practiceScore != null ? `${row.practiceScore}% practice` : null,
            row.attendanceRate != null ? `${row.attendanceRate}% attendance` : null,
            row.classroomPoints > 0 ? `${Math.round(row.classroomPoints)} pts` : null,
            row.lecturesOpened > 0
              ? `${row.lecturesCompleted}/${row.lecturesOpened} lectures`
              : null,
            row.flashcardsDecksStudied > 0 ? `${row.flashcardsDecksStudied} flashcard decks` : null,
            row.playgroundSessionsPlayed > 0
              ? `${row.playgroundSessionsPlayed} playground${row.playgroundAccuracy != null ? ` · ${row.playgroundAccuracy}%` : ""}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")

          return (
            <Card key={row.student.id || row.student.student_id} className={chrome.cardBase}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{row.student.full_name}</p>
                    {row.student.section || row.student.session_code ? (
                      <Badge variant="secondary" className="text-xs">
                        {row.student.section ?? row.student.session_code}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {metrics || "No activity recorded yet"}
                  </p>
                  {row.signals.length > 0 ? (
                    <p className="text-xs text-teal-700 dark:text-teal-300 mt-2">{row.signals.join(" · ")}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Engagement</p>
                    <p className={cn("text-xl font-bold", scoreTone(row.engagementScore))}>{row.engagementScore}</p>
                  </div>
                  <Button asChild size="sm" variant="outline" className="h-8">
                    <Link href={`${FACULTY_DASHBOARD_BASE}/management/students/${row.student.id}`}>Profile</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })
      )}

      {visibleRows.some((row) => row.signals.includes("Attendance risk") || row.signals.includes("Low assessment avg")) ? (
        <Card className={cn(chrome.cardBase, "border-amber-200/70 dark:border-amber-500/30")}>
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">Students needing outreach</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Filter by Engagement or open Cora Insights for struggle signals.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function SignalTile({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof BarChart3
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">{value}</p>
      {detail ? <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{detail}</p> : null}
    </div>
  )
}
