"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { dbTimeToCDT } from "@/lib/timezone"
import { getStudentData, getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { getStudentNavGroupTheme } from "@/lib/student-module-themes"
import {
  PORTAL_CTA,
  PORTAL_MUTED_BTN,
  PORTAL_OUTLINE_BTN,
} from "@/lib/appearance/portal-nav-classes"
import { getBackPathForAssessmentV2 } from "@/lib/student-dashboard-paths"
import {
  BookOpen,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  History,
  Calendar,
  Zap,
  ClipboardList,
} from "lucide-react"

interface AssessmentAttempt {
  id: number
  started_at: string
  completed_at: string | null
  is_completed: boolean
  score: number
  total_questions: number
  percentage: number
}

interface AssessmentHistoryItem {
  id: number
  title: string
  description: string
  available_until: string
  retake_limit: number
  assessment_type: string
  status: string
  attempts: AssessmentAttempt[]
}

interface AssessmentStats {
  total: number
  completed: number
  pending: number
  overdue: number
}

/** Light jeans card; dark keeps elevated module chrome. */
const HISTORY_CARD = cn(
  "rounded-xl border bg-white border-gray-200 shadow-md",
  "transition-shadow duration-300 hover:shadow-lg",
  "dark:border-white/15 dark:bg-[color-mix(in_srgb,var(--card)_78%,white)]",
  "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_22px_rgba(0,0,0,0.45)]",
  "dark:hover:brightness-110",
)

const HISTORY_TITLE = "text-gray-800 dark:text-[var(--cc-text)]"
const HISTORY_BODY = "text-gray-700 dark:text-[var(--cc-text-muted)]"
const HISTORY_MUTED = "text-gray-700/80 dark:text-[var(--cc-text-muted)]"

function normalizeAssessmentType(type: string): string {
  return type.toLowerCase().replace(/-/g, "_")
}

function getAssessmentTypeLabel(type: string): string {
  const t = normalizeAssessmentType(type)
  if (t === "homework") return "Homework"
  if (t === "quiz") return "Quiz"
  if (t === "mid_semester" || t === "midsem") return "Mid-Semester"
  if (t === "final") return "Final"
  return type
}

function getTakeAssessmentPath(id: number, type: string): string {
  const t = normalizeAssessmentType(type)
  if (t === "homework") return `/student/homework/${id}`
  if (t === "mid_semester" || t === "midsem") return `/student/mid-semester/${id}`
  if (t === "final") return `/student/final/${id}`
  return `/student/quiz/${id}`
}

function getContinueLabel(type: string): string {
  const t = normalizeAssessmentType(type)
  if (t === "homework") return "Continue Homework"
  if (t === "mid_semester" || t === "midsem") return "Continue Exam"
  if (t === "final") return "Continue Final"
  return "Continue Quiz"
}

/** Layout-accurate skeleton: stats row + timeline cards with rail + attempt nodes. */
export function AssessmentHistorySkeleton({ embedInDashboard }: { embedInDashboard?: boolean }) {
  const theme = getStudentNavGroupTheme("assessments")
  return (
    <div className="w-full min-w-0 space-y-5" aria-busy aria-label="Loading assessment history">
      {!embedInDashboard ? (
        <div className="space-y-2">
          <div className="h-7 w-48 animate-pulse rounded-lg bg-gray-200 dark:bg-white/10" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-gray-100 dark:bg-white/5" />
        </div>
      ) : null}

      <div className="space-y-3 border-b border-[var(--border)] pb-3">
        <div className="space-y-1">
          <div className="h-3 w-16 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
          <div className="h-4 w-56 max-w-full animate-pulse rounded bg-gray-100 dark:bg-white/5" />
        </div>
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-5 w-24 animate-pulse rounded-md bg-gray-100 dark:bg-white/10" />
          ))}
        </div>
      </div>

      <div className="relative space-y-4 pl-1 sm:pl-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="relative flex gap-3 sm:gap-4">
            <div className="relative z-10 mt-5 flex w-3.5 shrink-0 justify-center">
              <span
                className={cn(
                  "h-3.5 w-3.5 animate-pulse rounded-full ring-4 ring-white dark:ring-[var(--card)]",
                  theme.page.iconBg,
                )}
              />
            </div>
            <div className={cn(HISTORY_CARD, "min-w-0 flex-1 p-4 sm:p-5")}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className={cn("h-5 w-14 animate-pulse rounded-full", theme.page.iconBg)} />
                <div className="h-5 w-20 animate-pulse rounded-full bg-gray-100 dark:bg-white/10" />
              </div>
              <div className="mb-2 h-5 w-3/5 max-w-xs animate-pulse rounded bg-gray-200 dark:bg-white/10" />
              <div className="mb-4 h-3 w-2/5 max-w-[12rem] animate-pulse rounded bg-gray-100 dark:bg-white/5" />
              <div className="space-y-3 border-t border-gray-100 pt-4 dark:border-white/10">
                {Array.from({ length: 2 }).map((__, j) => (
                  <div key={j} className="flex gap-3">
                    <div className="mt-1.5 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-gray-300 dark:bg-white/20" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-3.5 w-28 animate-pulse rounded bg-gray-200 dark:bg-white/10" />
                      <div className="h-3 w-40 animate-pulse rounded bg-gray-100 dark:bg-white/5" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AssessmentHistory({
  embedInDashboard = false,
  typeFilter,
}: {
  embedInDashboard?: boolean
  /** When set, only show one assessment type (e.g. homework-only legacy view). */
  typeFilter?: string
}) {
  const router = useRouter()
  const assessmentsTheme = getStudentNavGroupTheme("assessments")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<AssessmentHistoryItem[]>([])
  const [stats, setStats] = useState<AssessmentStats>({ total: 0, completed: 0, pending: 0, overdue: 0 })

  useEffect(() => {
    const load = () => {
      const studentData = getStudentData()
      if (!studentData?.section) {
        router.push("/student/login")
        return
      }
      const studentId = studentData.databaseId || studentData.id
      if (!studentId) {
        setError("Student session not found. Please log in again.")
        setLoading(false)
        return
      }
      fetchHistory(studentId, studentData.section)
    }
    load()

    const onFocus = () => load()
    window.addEventListener("focus", onFocus)
    const onVisibilityChange = () => document.visibilityState === "visible" && load()
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [router, typeFilter])

  const fetchHistory = async (studentId: string, section: string) => {
    try {
      const params = new URLSearchParams({
        studentId,
        session: section,
      })
      if (typeFilter) params.set("type", typeFilter)

      const response = await studentApiFetch(`/api/student/assessment-history?${params.toString()}`, {
        cache: "no-store",
        headers: { ...getStudentAuthHeaders(), "Cache-Control": "no-cache" },
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || "Failed to load history")
        return
      }
      setHistory(data.assessmentHistory || [])
      setStats(data.stats || { total: 0, completed: 0, pending: 0, overdue: 0 })
    } catch {
      setError("Failed to load history. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const getBestScore = (attempts: AssessmentAttempt[]) => {
    const completed = attempts.filter((a) => a.is_completed)
    if (completed.length === 0) return null
    return Math.max(...completed.map((a) => a.percentage))
  }

  const getStatusBadge = (status: string) => {
    if (status === "completed") {
      return (
        <Badge className="border-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Completed
        </Badge>
      )
    }
    if (status === "overdue") {
      return (
        <Badge className="border-0 bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
          <AlertCircle className="mr-1 h-3 w-3" />
          Overdue
        </Badge>
      )
    }
    return (
      <Badge className="border-0 bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300">
        <Clock className="mr-1 h-3 w-3" />
        Pending
      </Badge>
    )
  }

  const handleViewReport = (item: AssessmentHistoryItem, latestAttemptId?: number) => {
    if (latestAttemptId) {
      router.push(`/student/results/${latestAttemptId}`)
      return
    }
    const t = normalizeAssessmentType(item.assessment_type)
    if (t === "homework") {
      router.push(`/student/homework/${item.id}/results`)
    }
  }

  if (loading) return <AssessmentHistorySkeleton embedInDashboard={embedInDashboard} />

  if (error) {
    return (
      <Alert variant="destructive" className="rounded-2xl">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center sm:py-16">
        <div
          className={cn(
            "mb-4 flex size-14 items-center justify-center rounded-2xl",
            assessmentsTheme.page.iconBg,
          )}
        >
          <History className={cn("h-7 w-7", assessmentsTheme.page.iconText)} />
        </div>
        <h3 className={cn("mb-2 text-lg font-semibold sm:text-xl", HISTORY_TITLE)}>No History Yet</h3>
        <p className={cn("mb-6 max-w-sm px-4 text-sm sm:text-base", HISTORY_BODY)}>
          Completed assessments and attempts will appear here.
        </p>
        <Link href={getBackPathForAssessmentV2(typeFilter ?? "quiz")}>
          <Button variant="ghost" className={cn("min-h-[44px] gap-2 rounded-xl", PORTAL_CTA)}>
            <BookOpen className="h-4 w-4" />
            Browse Assessments
          </Button>
        </Link>
      </div>
    )
  }

  const statStrip = [
    { label: "total", value: stats.total, color: "var(--cc-accent)", icon: ClipboardList },
    { label: "completed", value: stats.completed, color: "#10B981", icon: CheckCircle2 },
    { label: "pending", value: stats.pending, color: "#F59E0B", icon: Clock },
    { label: "overdue", value: stats.overdue, color: "#F43F5E", icon: AlertCircle },
  ]

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="space-y-3 border-b border-[var(--border)] pb-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
            History
          </p>
          <p className="mt-0.5 text-sm text-[var(--cc-text)]">
            Attempts and scores
            <span className="text-[var(--cc-text-muted)]"> · review reports or continue</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {statStrip.map((stat) => (
            <span key={stat.label} className="inline-flex items-center gap-1.5 text-sm">
              <stat.icon className="h-3.5 w-3.5 shrink-0" style={{ color: stat.color }} aria-hidden />
              <span className="font-semibold tabular-nums" style={{ color: stat.color }}>
                {stat.value}
              </span>
              <span className="text-[var(--cc-text-muted)]">{stat.label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="relative space-y-4 pl-1 sm:pl-2">
        {history.map((item, index) => {
          const bestScore = getBestScore(item.attempts)
          const latestAttempt = item.attempts[0]
          const typeLabel = getAssessmentTypeLabel(item.assessment_type)
          const isLast = index === history.length - 1

          return (
            <div key={item.id} className="relative flex gap-3 sm:gap-4">
              <div className="relative z-10 mt-5 flex w-3.5 shrink-0 flex-col items-center">
                {!isLast ? (
                  <span
                    aria-hidden
                    className="absolute left-1/2 top-[7px] bottom-[-1.75rem] w-px -translate-x-1/2 bg-gradient-to-b from-[var(--cc-accent)] via-gray-200 to-gray-100 dark:via-white/15 dark:to-transparent"
                  />
                ) : null}
                <span
                  className={cn(
                    "relative z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-white dark:ring-[var(--card)]",
                    item.status === "completed"
                      ? "bg-emerald-500"
                      : item.status === "overdue"
                        ? "bg-rose-500"
                        : "bg-[var(--cc-accent)]",
                  )}
                />
              </div>

              <div className={cn(HISTORY_CARD, "min-w-0 flex-1 p-4 sm:p-5")}>
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 text-xs font-semibold",
                          assessmentsTheme.page.badge,
                          assessmentsTheme.page.border,
                        )}
                      >
                        {typeLabel}
                      </Badge>
                      {getStatusBadge(item.status)}
                      {bestScore !== null && (
                        <Badge
                          variant="outline"
                          className="border-emerald-300 text-emerald-800 dark:border-emerald-700 dark:text-emerald-300"
                        >
                          Best {Math.round(bestScore)}%
                        </Badge>
                      )}
                    </div>
                    <h3 className={cn("break-words text-base font-bold sm:text-lg", HISTORY_TITLE)}>
                      {item.title}
                    </h3>
                    {item.description ? (
                      <p className={cn("mt-1 break-words text-xs sm:text-sm", HISTORY_BODY)}>
                        {item.description}
                      </p>
                    ) : null}
                    <div className={cn("mt-3 flex flex-wrap items-center gap-3 text-xs", HISTORY_MUTED)}>
                      {item.available_until ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 shrink-0 text-[var(--cc-accent-dark)] dark:text-[var(--cc-accent)]" />
                          Due: {dbTimeToCDT(item.available_until)}
                        </span>
                      ) : null}
                      <span className="flex items-center gap-1">
                        <Zap className="h-3.5 w-3.5 shrink-0 text-[var(--cc-accent-dark)] dark:text-[var(--cc-accent)]" />
                        {item.attempts.length}/{item.retake_limit || 1} attempts
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className={cn(
                        "h-9 gap-2 rounded-lg px-3 text-xs font-medium",
                        latestAttempt?.is_completed ? PORTAL_CTA : PORTAL_MUTED_BTN,
                      )}
                      onClick={() => handleViewReport(item, latestAttempt?.id)}
                      disabled={!latestAttempt?.is_completed}
                    >
                      <Eye className="h-4 w-4" />
                      View Report
                    </Button>
                    {item.status !== "completed" && item.attempts.length < (item.retake_limit || 1) ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className={cn("h-9 gap-2 rounded-lg px-3 text-xs font-medium", PORTAL_OUTLINE_BTN)}
                        onClick={() => router.push(getTakeAssessmentPath(item.id, item.assessment_type))}
                      >
                        <BookOpen className="h-4 w-4" />
                        {getContinueLabel(item.assessment_type)}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {item.attempts.length > 0 ? (
                  <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50/80 p-3 dark:border-white/10 dark:bg-black/20 sm:p-4">
                    <p className={cn("mb-3 text-xs font-semibold uppercase tracking-wide", HISTORY_TITLE)}>
                      Attempt timeline
                    </p>
                    <ol className="relative space-y-0">
                      {item.attempts.slice(0, 5).map((attempt, idx) => {
                        const attemptNo = item.attempts.length - idx
                        const isAttemptLast = idx === Math.min(item.attempts.length, 5) - 1
                        return (
                          <li key={attempt.id} className="relative flex gap-3 pb-4 last:pb-0">
                            <div className="relative flex w-2.5 shrink-0 flex-col items-center">
                              {!isAttemptLast ? (
                                <span
                                  aria-hidden
                                  className="absolute left-1/2 top-[9px] bottom-0 w-px -translate-x-1/2 bg-gray-200 dark:bg-white/15"
                                />
                              ) : null}
                              <span
                                className={cn(
                                  "relative z-10 mt-1 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-[var(--card)]",
                                  attempt.is_completed
                                    ? "bg-emerald-500"
                                    : "bg-amber-400 dark:bg-amber-500",
                                )}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className={cn("text-sm font-semibold", HISTORY_TITLE)}>
                                  Attempt {attemptNo}
                                </span>
                                <span
                                  className={cn(
                                    "shrink-0 text-sm font-bold tabular-nums",
                                    attempt.is_completed
                                      ? "text-emerald-700 dark:text-emerald-400"
                                      : HISTORY_MUTED,
                                  )}
                                >
                                  {attempt.is_completed
                                    ? `${Math.round(attempt.percentage)}%`
                                    : "Incomplete"}
                                </span>
                              </div>
                              <p className={cn("mt-0.5 truncate text-xs", HISTORY_MUTED)}>
                                {dbTimeToCDT(attempt.started_at)}
                              </p>
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                  </div>
                ) : null}

              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
