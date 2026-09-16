"use client"

import {
  BarChart3,
  Clock,
  FileText,
  Loader,
  RefreshCw,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { FacultyIntegratedToolbar } from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { PlaygroundStatCard } from "@/components/instructor/playground/playground-stat-card"
import { stripHtmlToPlain } from "@/lib/direct-messages/html"

const playgroundChrome = facultyEmbedChrome("playground")
const fp = playgroundChrome.p

export interface PlaygroundPerformanceSession {
  id: number
  session_code: string
  created_at: string
  is_active?: boolean
  selected_topics?: string[] | null
}

export interface PerformanceStudentRow {
  resultId: number
  studentId: string
  studentName: string
  displayName: string
  score: number
  questionsAnswered: number
  correctAnswers: number
  accuracyPercentage: number
  completedAt: string | null
  sessionCode: string
}

export interface PerformanceQuestionStat {
  questionOrder: number
  questionText: string
  questionType: string
  totalAnswers: number
  correctAnswers: number
  avgResponseTimeMs: number
  accuracyPercentage: number
}

export interface PerformanceOverallStats {
  totalSessions: number
  totalParticipants: number
  uniqueStudents: number
  avgScore: number
  avgQuestionsAnswered: number
  avgAccuracy: number
}

export interface PerformanceRecentSession {
  id: number
  sessionCode: string
  createdAt: string
  endedAt: string | null
  isActive: boolean
  participantCount: number
  avgScore: number
}

function StatusPill({ active }: { active: boolean }) {
  if (active) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Live
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
      Closed
    </span>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className={cn(PORTAL_CARD, "p-8 text-center sm:p-10")}>
      <BarChart3 className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
      <p className={cn("font-semibold", PORTAL_TEXT)}>{title}</p>
      <p className={cn("mx-auto mt-1 max-w-md text-sm", PORTAL_TEXT_MUTED)}>{description}</p>
    </div>
  )
}

export function InstructorPlaygroundPerformanceTab({
  sessions,
  selectedSessionId,
  onSelectSession,
  loading,
  performanceData,
  questionStats,
  overallStats,
  recentSessions,
  accumulatedScore,
  avgScore,
  avgResponseTimeMs,
  onRefresh,
  getSessionDisplayLabel,
}: {
  sessions: PlaygroundPerformanceSession[]
  selectedSessionId: string
  onSelectSession: (id: string) => void
  loading: boolean
  performanceData: PerformanceStudentRow[]
  questionStats: PerformanceQuestionStat[]
  overallStats: PerformanceOverallStats | null
  recentSessions: PerformanceRecentSession[]
  accumulatedScore: number
  avgScore: number
  avgResponseTimeMs: number
  onRefresh: () => void
  getSessionDisplayLabel: (session: PlaygroundPerformanceSession) => string
}) {
  const sortedSessions = [...sessions].sort((a, b) => b.id - a.id)
  const sessionRow = sessions.find((s) => s.id.toString() === selectedSessionId)

  const sessionStatItems = [
    { label: "Participants", value: String(performanceData.length), icon: Users },
    { label: "Total points", value: accumulatedScore.toLocaleString(), icon: TrendingUp },
    { label: "Avg score", value: avgScore.toLocaleString(), icon: BarChart3 },
    {
      label: "Avg response",
      value: avgResponseTimeMs > 0 ? `${(avgResponseTimeMs / 1000).toFixed(1)}s` : "—",
      icon: Clock,
    },
  ]

  return (
    <div className="space-y-4">
      <FacultyIntegratedToolbar
        moduleId="playground"
        filters={
          <Select value={selectedSessionId} onValueChange={onSelectSession}>
            <SelectTrigger className="h-9 w-full min-w-[220px] rounded-lg border-0 bg-muted/50 shadow-none sm:min-w-[280px]">
              <SelectValue placeholder="Select a session" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sessions — last 30 days</SelectItem>
              {sortedSessions.map((session) => (
                <SelectItem key={session.id} value={session.id.toString()}>
                  <span className="font-mono">{session.session_code}</span>
                  <span className="mx-1.5 text-[var(--cc-text-muted)]">·</span>
                  <span>{getSessionDisplayLabel(session)}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        meta={
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {selectedSessionId === "all"
              ? "Accuracy and volume across recent sessions"
              : sessionRow
                ? `${sessionRow.session_code} · ${getSessionDisplayLabel(sessionRow)}`
                : "Session performance"}
          </p>
        }
        trailing={
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="h-9 gap-1.5 rounded-lg">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      {loading ? (
        <div className={cn(PORTAL_CARD, "py-16 text-center")}>
          <Loader className={cn("mx-auto h-8 w-8 animate-spin", facultyModuleSpinnerClass("playground"))} />
          <p className={cn("mt-3 text-sm", PORTAL_TEXT_MUTED)}>Loading performance data…</p>
        </div>
      ) : selectedSessionId === "all" ? (
        overallStats ? (
          <div className="space-y-4">
            {recentSessions.length > 0 ? (
              <div className="space-y-3">
                <h3 className={cn("px-1 text-sm font-semibold", PORTAL_TEXT)}>Recent sessions</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {recentSessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => onSelectSession(String(session.id))}
                      className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 text-left transition-colors hover:bg-[var(--cc-accent-soft)]/45"
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", fp.softBg)}>
                          <BarChart3 className={cn("h-4 w-4", fp.iconText)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={cn("font-mono text-sm font-semibold", PORTAL_TEXT)}>{session.sessionCode}</p>
                          <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>
                            {new Date(session.createdAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <StatusPill active={session.isActive} />
                            <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                              {session.participantCount} players · avg {session.avgScore ? session.avgScore.toFixed(1) : "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyState
            title="No overall stats yet"
            description="Run a classroom playground session to see aggregate metrics here."
          />
        )
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {sessionStatItems.map((item) => (
              <PlaygroundStatCard key={item.label} {...item} />
            ))}
          </div>

          {questionStats.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <FileText className={cn("h-4 w-4", fp.iconText)} />
                <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>Question breakdown</h3>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {questionStats.map((stat) => (
                  <article
                    key={stat.questionOrder}
                    className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-semibold",
                          fp.softBg,
                          fp.iconText,
                        )}
                      >
                        {stat.questionOrder}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={cn("line-clamp-2 text-sm font-medium", PORTAL_TEXT)}>
                          {stripHtmlToPlain(stat.questionText) || stat.questionText}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {stat.questionType === "mcq" ? "MCQ" : "True/False"}
                          </span>
                          <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                            {stat.totalAnswers} answers · {(stat.avgResponseTimeMs / 1000).toFixed(1)}s
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                stat.accuracyPercentage >= 80
                                  ? "bg-emerald-500"
                                  : stat.accuracyPercentage >= 60
                                    ? "bg-amber-500"
                                    : "bg-red-500",
                              )}
                              style={{ width: `${Math.min(stat.accuracyPercentage, 100)}%` }}
                            />
                          </div>
                          <span className={cn("w-10 text-right text-xs font-semibold tabular-nums", PORTAL_TEXT)}>
                            {stat.accuracyPercentage.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {performanceData.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Users className={cn("h-4 w-4", fp.iconText)} />
                <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>Student results</h3>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {performanceData.map((perf, index) => (
                  <article
                    key={perf.resultId}
                    className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", fp.softBg)}>
                        {index === 0 ? (
                          <Trophy className={cn("h-4 w-4", fp.iconText)} />
                        ) : (
                          <span className={cn("text-sm font-semibold", fp.iconText)}>{index + 1}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-sm font-semibold", PORTAL_TEXT)}>
                          {perf.displayName || perf.studentName}
                        </p>
                        <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>
                          {perf.correctAnswers}/{perf.questionsAnswered} correct · {Number(perf.accuracyPercentage).toFixed(0)}%
                        </p>
                        <p className={cn("mt-1 text-lg font-semibold tabular-nums", PORTAL_TEXT)}>{perf.score}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {questionStats.length === 0 && performanceData.length === 0 ? (
            <EmptyState
              title="No performance data for this session"
              description="Students need to answer questions in this session. Finished attempts appear here automatically."
            />
          ) : null}
        </div>
      )}
    </div>
  )
}
