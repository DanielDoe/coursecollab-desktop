"use client"

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react"
import Link from "next/link"
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Search,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { InstructorPolicySurfaceCard } from "@/components/instructor/InstructorPolicySurfaceCard"
import { InstructorPolicyLoadingState } from "@/components/instructor/InstructorPolicyLoadingState"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { getInstructorData } from "@/lib/auth"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import { CC_FIELD } from "@/lib/appearance/ui-primitives"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

interface DiagnosticSummary {
  totalIssues: number
  days: number
  courseId?: number
  courseCode?: string
}

interface ByErrorType {
  errorType: string
  count: number
}

interface ByStudent {
  studentId: number
  studentName: string
  studentIdDisplay: string
  issueCount: number
}

interface RecentItem {
  answerId: number
  attemptId: number
  questionId: number
  answeredAt: string
  studentName: string
  studentIdDisplay: string
  quizTitle: string
  assessmentType: string
  quizId: number
  requiresReview: boolean
  errorType: string
  issueKind?: string
  retryCount: number | null
}

interface DiagnosticsData {
  summary: DiagnosticSummary
  byErrorType: ByErrorType[]
  byAssessment: ByAssessment[]
  byStudent: ByStudent[]
  recentItems: RecentItem[]
}

interface ByAssessment {
  assessmentType: string
  count: number
}

const SEARCH_FIELD = cn("h-10 rounded-lg border pl-9 pr-9 shadow-none", CC_FIELD.base, CC_FIELD.focus)
const SELECT_FIELD = cn("h-10 w-full rounded-lg border shadow-none sm:w-[9.5rem]", CC_FIELD.base, CC_FIELD.focus)
const TABLE_WRAP = "overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]"
const TABLE_HEAD = "bg-[var(--muted)]/40 text-left text-xs font-medium uppercase tracking-wide text-[var(--cc-text-muted)]"
const TABLE_ROW = "border-t border-[var(--border)]"

function PolicyBlock({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-4 border-t border-[var(--border)] pt-5 first:border-t-0 first:pt-0">
      <div>
        <h4 className={cn("text-sm font-semibold", PORTAL_TEXT)}>{title}</h4>
        {description ? <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>{description}</p> : null}
      </div>
      {children}
    </div>
  )
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    })
  } catch {
    return dateStr
  }
}

function formatAssessmentType(type: string): string {
  const map: Record<string, string> = {
    quiz: "Quiz",
    homework: "Homework",
    mid_semester: "Mid-Semester",
    final: "Final Exam",
  }
  return map[type] ?? type
}

export function InstructorSubmissionIssuesPanel({ embedInAdmin }: { embedInAdmin?: boolean } = {}) {
  const { courseScopeVersion } = useInstructorDashboardV2()
  const selectedCourseId = getInstructorData()?.selectedCourseId ?? null
  const [data, setData] = useState<DiagnosticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(7)
  const [search, setSearch] = useState("")

  const load = useCallback(async () => {
    if (!selectedCourseId) {
      setData(null)
      setError("Select a course from the top bar to view submission issues for that offering.")
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await instructorApiFetch(`/api/instructor/submission-diagnostics?days=${days}`, {
        headers: buildInstructorApiHeaders(),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        setData(body as DiagnosticsData)
      } else {
        setData(null)
        setError(
          typeof body.error === "string"
            ? body.error
            : `Could not load diagnostics (${res.status})`,
        )
      }
    } catch (e) {
      console.error("[SubmissionDiagnostics] Failed to load:", e)
      setData(null)
      setError("Network error while loading submission diagnostics.")
    } finally {
      setLoading(false)
    }
  }, [days, selectedCourseId])

  useEffect(() => {
    void load()
  }, [load, courseScopeVersion])

  const totalIssues = data?.summary.totalIssues ?? 0
  const affectedStudents = data?.byStudent.length ?? 0
  const errorTypes = data?.byErrorType.length ?? 0

  const filteredRecentItems = useMemo(() => {
    const items = data?.recentItems ?? []
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (r) =>
        r.studentName.toLowerCase().includes(q) ||
        r.studentIdDisplay.toLowerCase().includes(q),
    )
  }, [data?.recentItems, search])

  const metaLine = loading
    ? "Loading submission diagnostics…"
    : `${totalIssues} issue${totalIssues === 1 ? "" : "s"} · ${affectedStudents} student${affectedStudents === 1 ? "" : "s"} · ${errorTypes} error type${errorTypes === 1 ? "" : "s"}${data?.summary.courseCode ? ` · ${data.summary.courseCode}` : ""}`

  if (loading && !data && !error) {
    return (
      <InstructorPolicyLoadingState
        moduleId="submission-issues"
        label={embedInAdmin ? "Loading submission diagnostics…" : undefined}
      />
    )
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <InstructorPolicySurfaceCard className="w-full">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recent submissions by student…"
              className={SEARCH_FIELD}
              aria-label="Search recent submissions by student"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--cc-text-muted)] hover:bg-[var(--cc-accent-soft)]/45 hover:text-[var(--cc-text)]"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className={SELECT_FIELD}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-10 shrink-0 rounded-lg"
              aria-label="Refresh submission diagnostics"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{metaLine}</p>

        {error ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/25 px-3.5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{error}</p>
                <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
                  Check your course selection and try again.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-lg"
                onClick={() => void load()}
              >
                Try again
              </Button>
            </div>
          </div>
        ) : data ? (
          <>
            <div
              className={cn(
                "rounded-xl px-3.5 py-3",
                data.summary.totalIssues > 0
                  ? "bg-amber-500/10 text-amber-900 dark:text-amber-100"
                  : "bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
              )}
            >
              <div className="flex items-start gap-3">
                {data.summary.totalIssues > 0 ? (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                )}
                <div>
                  <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>
                    {data.summary.totalIssues} issue{data.summary.totalIssues !== 1 ? "s" : ""} in the last{" "}
                    {data.summary.days} days
                  </p>
                  {data.summary.totalIssues === 0 ? (
                    <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>
                      No flagged submissions for this course in the selected window. Tracks answers saved after
                      network or timeout failures and items marked for manual review.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {data.summary.totalIssues > 0 ? (
              <>
                {data.byErrorType.length > 0 ? (
                  <PolicyBlock title="By error type">
                    <div className="flex flex-wrap gap-2">
                      {data.byErrorType.map((r) => (
                        <span
                          key={r.errorType}
                          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-1.5 text-sm"
                        >
                          <span className={PORTAL_TEXT}>{r.errorType}</span>
                          <span className="tabular-nums font-semibold text-amber-600 dark:text-amber-400">
                            {r.count}
                          </span>
                        </span>
                      ))}
                    </div>
                  </PolicyBlock>
                ) : null}

                {data.byStudent.length > 0 ? (
                  <PolicyBlock title="Students with most issues">
                    <div className={TABLE_WRAP}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr>
                            <th className={cn(TABLE_HEAD, "px-4 py-2")}>Student</th>
                            <th className={cn(TABLE_HEAD, "px-4 py-2 text-right")}>Issues</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.byStudent.map((r) => (
                            <tr key={r.studentId} className={TABLE_ROW}>
                              <td className="px-4 py-2">
                                <Link
                                  href={`${FACULTY_DASHBOARD_BASE}/results?student=${r.studentId}`}
                                  className="text-[var(--cc-accent-dark)] hover:underline"
                                >
                                  {r.studentName} ({r.studentIdDisplay})
                                </Link>
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums">{r.issueCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </PolicyBlock>
                ) : null}

                {filteredRecentItems.length > 0 ? (
                  <PolicyBlock title="Recent affected submissions">
                    <div className={cn(TABLE_WRAP, "overflow-x-auto")}>
                      <table className="w-full min-w-[500px] text-sm">
                        <thead>
                          <tr>
                            <th className={cn(TABLE_HEAD, "px-4 py-2")}>Date</th>
                            <th className={cn(TABLE_HEAD, "px-4 py-2")}>Student</th>
                            <th className={cn(TABLE_HEAD, "px-4 py-2")}>Assessment</th>
                            <th className={cn(TABLE_HEAD, "px-4 py-2")}>Error</th>
                            <th className={cn(TABLE_HEAD, "px-4 py-2")}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRecentItems.slice(0, 20).map((r) => (
                            <tr key={r.answerId} className={TABLE_ROW}>
                              <td className="whitespace-nowrap px-4 py-2">{formatDate(r.answeredAt)}</td>
                              <td className="px-4 py-2">
                                {r.studentName} ({r.studentIdDisplay})
                              </td>
                              <td className="px-4 py-2">
                                {r.quizTitle} ({formatAssessmentType(r.assessmentType)})
                              </td>
                              <td className="px-4 py-2 text-amber-600 dark:text-amber-400">{r.errorType}</td>
                              <td className="px-4 py-2">
                                <Link
                                  href={`${FACULTY_DASHBOARD_BASE}/results/${r.attemptId}`}
                                  className="text-[var(--cc-accent-dark)] hover:underline"
                                >
                                  View attempt
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </PolicyBlock>
                ) : search.trim() ? (
                  <p className={cn("rounded-xl border border-[var(--border)] bg-[var(--muted)]/25 px-3.5 py-4 text-sm", PORTAL_TEXT_MUTED)}>
                    No recent submissions match &ldquo;{search.trim()}&rdquo;.
                  </p>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </InstructorPolicySurfaceCard>
    </div>
  )
}
