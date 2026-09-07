"use client"


import { useState, useEffect, useMemo } from "react"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Clock,
  Target,
  TrendingUp,
  Calendar,
  Award,
  Percent,
  Layers,
  Eye,
} from "lucide-react"
import { getPracticePath } from "@/lib/student-dashboard-paths"
import { format } from "date-fns"
import { StudentHeader } from "@/components/student-header"
import { normalizePracticeScorePercent } from "@/lib/practice-score-display"
import { usePracticeChrome } from "@/hooks/use-practice-chrome"
import { practiceChromeKpi } from "@/lib/practice-chrome-theme"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"

/** Light jeans card; dark keeps elevated module chrome (matches assessment history). */
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

interface PracticeAttempt {
  id: number
  topics: string[]
  difficulty: string
  total_questions: number
  correct_answers: number
  score_percentage: number
  time_spent_seconds: number
  completed_at: string | null
  started_at?: string | null
  answered_count?: number
  status?: "completed" | "in_progress"
}

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }
  return `${minutes}m ${seconds}s`
}

function scoreTone(scorePct: number): { fill: string; soft: string } {
  if (scorePct >= 80) return { fill: "#10b981", soft: "rgba(16,185,129,0.14)" }
  if (scorePct >= 50) return { fill: "#f59e0b", soft: "rgba(245,158,11,0.14)" }
  return { fill: "#f43f5e", soft: "rgba(244,63,94,0.12)" }
}

export default function PracticeHistoryPage({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter()
  const practiceHref = embedded ? getPracticePath() : "/student/practice"
  const { roles } = usePracticeChrome()
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const studentData = getStudentData()
    if (!studentData || !studentData.databaseId) {
      router.push("/student/login")
      return
    }

    fetchHistory(Number.parseInt(studentData.databaseId))
  }, [router])

  const resumeAttempt = (attempt: PracticeAttempt) => {
    sessionStorage.setItem("practiceAttemptId", String(attempt.id))
    const keyed = sessionStorage.getItem(`practiceQuestions:${attempt.id}`)
    if (keyed) {
      sessionStorage.setItem("practiceQuestions", keyed)
      router.push("/student/dashboard-v2/practice/quiz")
      return
    }
    router.push(getPracticePath())
  }

  const fetchHistory = async (studentDbId: number) => {
    try {
      const response = await studentApiFetch(`/api/practice/history?studentId=${studentDbId}`)
      const data = await response.json()
      if (response.ok) {
        setAttempts(data.attempts || [])
      } else {
        console.error("[v0] Failed to fetch history:", data.error)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch history:", error)
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    if (attempts.length === 0) {
      return { total: 0, avgScore: 0, bestScore: 0, questions: 0 }
    }
    const completed = attempts.filter((a) => a.status !== "in_progress" && a.completed_at)
    let sum = 0
    let best = 0
    let questions = 0
    for (const a of completed.length > 0 ? completed : attempts) {
      const pct = normalizePracticeScorePercent(a.score_percentage)
      sum += pct
      best = Math.max(best, pct)
      questions += a.total_questions || 0
    }
    const basis = completed.length > 0 ? completed : attempts
    return {
      total: attempts.length,
      avgScore: basis.length > 0 ? Math.round(sum / basis.length) : 0,
      bestScore: Math.round(best),
      questions,
    }
  }, [attempts])

  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center",
          HISTORY_MUTED,
          embedded ? "min-h-[280px]" : "min-h-screen bg-secondary",
        )}
      >
        Loading history…
      </div>
    )
  }

  const kpiCards = [
    {
      label: "Sessions",
      hint: "All attempts",
      value: stats.total,
      crest: "bg-gradient-to-br from-[var(--cc-accent)] to-[var(--cc-accent-hover)] shadow-[var(--cc-accent)]/35",
      icon: Layers,
    },
    {
      label: "Avg score",
      hint: "Across sessions",
      value: `${stats.avgScore}%`,
      crest: "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/35",
      icon: Percent,
    },
    {
      label: "Best score",
      hint: "Personal best",
      value: `${stats.bestScore}%`,
      crest: "bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/35",
      icon: Award,
    },
    {
      label: "Questions",
      hint: "Total answered",
      value: stats.questions,
      crest: "bg-gradient-to-br from-sky-500 to-blue-600 shadow-sky-500/35",
      icon: Target,
    },
  ]

  return (
    <div className={embedded ? "min-w-0" : "min-h-screen bg-secondary"}>
      {!embedded && <StudentHeader />}

      <main className={cn(embedded ? "min-w-0 space-y-5" : "container mx-auto max-w-6xl space-y-5 px-4 py-8")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className={cn("font-bold tracking-tight", HISTORY_TITLE, embedded ? "text-lg" : "text-2xl sm:text-3xl")}>
              Practice History
            </h2>
            <p className={cn("mt-1 text-sm", HISTORY_MUTED)}>
              View all your past practice sessions
            </p>
          </div>
          {!embedded ? (
            <Button
              variant="outline"
              className="gap-2 rounded-xl border-gray-200 bg-white text-gray-800 shadow-sm hover:bg-gray-50 dark:border-white/15 dark:bg-transparent dark:text-[var(--cc-text)]"
              onClick={() => router.push(practiceHref)}
            >
              <ArrowLeft className="h-4 w-4" /> Back to Practice Hub
            </Button>
          ) : null}
        </div>

        {attempts.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 pt-3 sm:grid-cols-4 sm:gap-4">
            {kpiCards.map((stat) => (
              <div key={stat.label} className={cn(HISTORY_CARD, "group relative flex flex-col pb-4")}>
                <div
                  className={cn(
                    "relative mx-3 -mt-3 h-14 overflow-hidden rounded-xl text-white shadow-lg",
                    "transition-transform duration-300 group-hover:-translate-y-0.5",
                    stat.crest,
                  )}
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-4 -top-6 h-20 w-20 rounded-full bg-white/15"
                  />
                  <div className="relative flex h-full items-center justify-between gap-2 px-3.5">
                    <stat.icon className="h-6 w-6 shrink-0 opacity-95" aria-hidden />
                    <span className="text-2xl font-bold tabular-nums tracking-tight sm:text-3xl">
                      {stat.value}
                    </span>
                  </div>
                </div>
                <div className="px-4 pt-3">
                  <h5 className={cn("text-sm font-semibold leading-snug", HISTORY_TITLE)}>
                    {stat.label}
                  </h5>
                  <p className={cn("mt-0.5 text-xs", HISTORY_MUTED)}>{stat.hint}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {attempts.length === 0 ? (
          <div className={cn(HISTORY_CARD, "px-6 py-12 text-center")}>
            <div
              className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${roles.recent.fill}28` }}
            >
              <Clock className="h-5 w-5" style={{ color: roles.recent.ink }} />
            </div>
            <p className={cn("mb-1 text-sm font-semibold", HISTORY_TITLE)}>No practice sessions yet</p>
            <p className={cn("mb-4 text-sm", HISTORY_MUTED)}>
              Start a topic from Practice Hub to build your history.
            </p>
            <Button
              onClick={() => router.push(practiceHref)}
              className="rounded-xl border-0 shadow-sm hover:opacity-90"
              style={{ backgroundColor: roles.cta.fill, color: roles.cta.icon }}
            >
              Start practicing
            </Button>
          </div>
        ) : (
          <div className="relative space-y-4 pl-1 sm:pl-2">
            <div
              aria-hidden
              className="absolute bottom-8 left-[1.15rem] top-8 w-px bg-gradient-to-b from-[var(--cc-accent)] via-gray-200 to-gray-100 dark:via-white/15 dark:to-transparent sm:left-[1.35rem]"
            />

            {attempts.map((attempt, index) => {
              const isInProgress = attempt.status === "in_progress" || !attempt.completed_at
              const scorePct = isInProgress
                ? Math.round(
                    ((attempt.answered_count ?? attempt.correct_answers ?? 0) /
                      Math.max(1, attempt.total_questions)) *
                      100,
                  )
                : normalizePracticeScorePercent(attempt.score_percentage)
              const tone = scoreTone(scorePct)
              const thumb = practiceChromeKpi(index, roles)
              const topicLabel =
                attempt.topics?.length > 0 ? attempt.topics.join(", ") : "Practice session"
              const duration = formatDuration(attempt.time_spent_seconds)
              const when = attempt.completed_at ?? attempt.started_at

              return (
                <div key={attempt.id} className="relative flex gap-3 sm:gap-4">
                  <div className="relative z-10 mt-5 flex w-8 shrink-0 justify-center sm:w-9">
                    <span
                      className="flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-white dark:ring-[var(--card)]"
                      style={{ backgroundColor: tone.fill }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      isInProgress ? resumeAttempt(attempt) : router.push(`/student/practice/results/${attempt.id}`)
                    }
                    className={cn(
                      HISTORY_CARD,
                      "group min-w-0 flex-1 p-4 text-left sm:p-5",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)]",
                    )}
                  >
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <SolidListThumbTile thumb={thumb} icon={Target} size="compact" />
                        <div className="min-w-0">
                          <h3 className={cn("text-base font-semibold sm:text-lg", HISTORY_TITLE)}>
                            Practice Session #{attempt.id}
                          </h3>
                          <p className={cn("mt-1 flex items-center gap-1.5 text-sm", HISTORY_MUTED)}>
                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                            {when ? format(new Date(when), "PPp") : "In progress"}
                          </p>
                        </div>
                      </div>
                      <span
                        className="shrink-0 rounded-xl px-3 py-1.5 text-base font-bold tabular-nums shadow-sm"
                        style={{ backgroundColor: tone.soft, color: tone.fill }}
                      >
                        {isInProgress
                          ? `${attempt.answered_count ?? 0}/${attempt.total_questions}`
                          : `${scorePct.toFixed(0)}%`}
                      </span>
                    </div>

                    {isInProgress ? (
                      <p className={cn("mb-3 text-sm font-medium", HISTORY_BODY)}>
                        In progress — resume to finish this session
                      </p>
                    ) : null}

                    <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, scorePct)}%`, backgroundColor: tone.fill }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <MetaCell
                        icon={Target}
                        label="Topics"
                        value={topicLabel}
                      />
                      <MetaCell
                        icon={TrendingUp}
                        label="Difficulty"
                        value={attempt.difficulty || "—"}
                        capitalize
                      />
                      <MetaCell
                        icon={Award}
                        label="Score"
                        value={
                          isInProgress
                            ? `${attempt.answered_count ?? 0}/${attempt.total_questions} answered`
                            : `${attempt.correct_answers}/${attempt.total_questions}`
                        }
                      />
                      <MetaCell
                        icon={Clock}
                        label={isInProgress ? "Started" : "Time"}
                        value={isInProgress && when ? format(new Date(when), "p") : duration}
                      />
                    </div>

                    <div
                      className={cn(
                        "mt-3 flex items-center gap-1.5 text-xs font-semibold transition-colors",
                        HISTORY_BODY,
                        "group-hover:text-[var(--cc-accent)]",
                      )}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {isInProgress ? "Resume session" : "View results"}
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

function MetaCell({
  icon: Icon,
  label,
  value,
  capitalize = false,
}: {
  icon: typeof Target
  label: string
  value: string
  capitalize?: boolean
}) {
  return (
    <div className="min-w-0 rounded-lg bg-gray-50/80 px-2.5 py-2 dark:bg-white/[0.04]">
      <p className={cn("text-[11px] font-medium uppercase tracking-wide", HISTORY_MUTED)}>
        {label}
      </p>
      <div className="mt-1 flex items-start gap-1.5">
        <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", HISTORY_MUTED)} />
        <p
          className={cn(
            "min-w-0 break-words text-sm font-semibold leading-snug",
            HISTORY_TITLE,
            capitalize && "capitalize",
          )}
        >
          {value}
        </p>
      </div>
    </div>
  )
}
