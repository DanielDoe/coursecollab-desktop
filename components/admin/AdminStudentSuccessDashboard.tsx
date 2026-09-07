"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangle,
  BarChart3,
  Brain,
  GraduationCap,
  Mail,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { buildAdminApiHeaders } from "@/lib/admin-api-headers"

type Summary = {
  totalStudents: number
  activeStudents: number
  newEnrollments30d: number
  atRiskCount: number
  progressReviewsTotal: number
  progressReviewsEmailed: number
  progressReviews30d: number
  aiConversations30d: number
  aiActiveStudents30d: number
  aiTopicsCovered30d: number
  attempts30d: number
  completedAttempts30d: number
  avgScore30d: number
  engagementCredits: number
  studentsWithCredits: number
  platformEvents24h: number
}

type CourseRow = {
  courseCode: string
  courseName: string
  studentCount: number
  avgTotalScore: number
  atRisk: number
}

type AtRiskStudent = {
  fullName: string
  section: string
  totalScore: number
  attendanceScore: number
  letterGrade: string | null
}

export function AdminStudentSuccessDashboard() {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([])

  const load = () => {
    setLoading(true)
    fetch("/api/admin/student-success-analytics", { headers: buildAdminApiHeaders() })
      .then((r) => r.json())
      .then((data) => {
        setSummary(data.summary ?? null)
        setCourses(data.courseBreakdown ?? [])
        setAtRiskStudents(data.atRiskStudents ?? [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">Loading institutional student success analytics…</p>
        </div>
      </div>
    )
  }

  const chartData = courses.map((c) => ({
    name: c.courseCode || "Course",
    avgScore: c.avgTotalScore,
    atRisk: c.atRisk,
    students: c.studentCount,
  }))

  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            <GraduationCap className="h-3.5 w-3.5" />
            Institutional Analytics
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Student Success Dashboard
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Cross-course view of enrollment, at-risk students, AI tutor engagement, progress reviews, and platform activity —
            powering proactive student success interventions.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/40 dark:to-background">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Users className="h-4 w-4" /> Total Students</CardDescription>
            <CardTitle className="text-3xl">{summary?.totalStudents ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {summary?.activeStudents ?? 0} active · {summary?.newEnrollments30d ?? 0} new (30d)
          </CardContent>
        </Card>

        <Card className="border-rose-100 bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/40 dark:to-background">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-rose-600" /> At-Risk Students</CardDescription>
            <CardTitle className="text-3xl text-rose-700 dark:text-rose-300">{summary?.atRiskCount ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Attendance &lt; 70% and total grade &lt; 60%
          </CardContent>
        </Card>

        <Card className="border-violet-100 bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/40 dark:to-background">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-violet-600" /> Progress Reviews</CardDescription>
            <CardTitle className="text-3xl">{summary?.progressReviews30d ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {summary?.progressReviewsEmailed ?? 0} emailed · {summary?.progressReviewsTotal ?? 0} total saved
          </CardContent>
        </Card>

        <Card className="border-teal-100 bg-gradient-to-br from-teal-50 to-white dark:from-teal-950/40 dark:to-background">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Brain className="h-4 w-4 text-teal-600" /> AI Tutor (30d)</CardDescription>
            <CardTitle className="text-3xl">{summary?.aiConversations30d ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {summary?.aiActiveStudents30d ?? 0} students · {summary?.aiTopicsCovered30d ?? 0} topics
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
              Performance by Course
            </CardTitle>
            <CardDescription>Average total score and at-risk count per active course</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avgScore" name="Avg Score %" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="atRisk" name="At-Risk" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No course data available</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              Engagement Signals
            </CardTitle>
            <CardDescription>Learning activity across the platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-muted-foreground">Attempts (30d)</span>
              <span className="font-semibold">{summary?.attempts30d ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-muted-foreground">Completion rate</span>
              <span className="font-semibold">
                {summary?.attempts30d
                  ? Math.round(((summary.completedAttempts30d ?? 0) / summary.attempts30d) * 100)
                  : 0}%
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-muted-foreground">Avg attempt score</span>
              <span className="font-semibold">{summary?.avgScore30d ?? 0}%</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-muted-foreground">Engagement credits</span>
              <span className="font-semibold">{summary?.engagementCredits ?? 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-muted-foreground">Platform events (24h)</span>
              <span className="font-semibold">{summary?.platformEvents24h ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-5 w-5 text-rose-600" />
            Students Needing Intervention
          </CardTitle>
          <CardDescription>Students flagged by attendance and grade thresholds</CardDescription>
        </CardHeader>
        <CardContent>
          {atRiskStudents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Total Score</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atRiskStudents.map((s, i) => (
                  <TableRow key={`${s.fullName}-${i}`}>
                    <TableCell className="font-medium">{s.fullName}</TableCell>
                    <TableCell>{s.section}</TableCell>
                    <TableCell>{s.totalScore.toFixed(1)}%</TableCell>
                    <TableCell>{s.attendanceScore.toFixed(1)}%</TableCell>
                    <TableCell>{s.letterGrade ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="text-[10px]">At Risk</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No at-risk students currently flagged.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
