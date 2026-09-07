"use client"

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Crown,
  Loader,
  Medal,
  RefreshCw,
  Trophy,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { FacultyIntegratedToolbar } from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { buildPodiumEntries } from "@/lib/playground-podium"
import { PlaygroundLeaderboardPodium } from "@/components/playground/PlaygroundLeaderboardPodium"
import { usePlaygroundPodiumReveal } from "@/hooks/use-playground-podium-reveal"

const playgroundChrome = facultyEmbedChrome("playground")
const fp = playgroundChrome.p

export interface PlaygroundLeaderboardSession {
  id: number
  session_code: string
  is_active?: boolean
  game_started?: boolean
  selected_topics?: string[] | null
}

export interface LeaderboardSessionMeta {
  id: number
  sessionCode: string
  label: string
  questionCount: number
  isActive: boolean
  gameStarted: boolean
  createdAt: string
}

export interface LeaderboardEntry {
  rank: number | null
  resultId: number
  studentId: string
  studentName: string
  displayName: string
  nickname: string | null
  score: number
  questionsAnswered: number
  correctAnswers: number
  accuracyPercentage: number
  completedAt: string | null
  sessionCode: string | null
  sessionsPlayed: number
  status: "waiting" | "playing" | "completed"
}

export interface LeaderboardStats {
  totalSessions: number
  uniqueStudents: number
  totalAttempts: number
  activeParticipants: number
  waitingParticipants: number
  avgScore: number
  maxScore: number
  avgAccuracy: number
}

function studentInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase()
}

function RankBadge({ rank }: { rank: number | null }) {
  if (rank === 1) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15">
        <Crown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
      </div>
    )
  }
  if (rank === 2) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
        <Medal className="h-5 w-5 text-muted-foreground" />
      </div>
    )
  }
  if (rank === 3) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15">
        <Medal className="h-5 w-5 text-orange-600 dark:text-orange-400" />
      </div>
    )
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <span className={cn("text-sm font-semibold tabular-nums", PORTAL_TEXT_MUTED)}>{rank ?? "—"}</span>
    </div>
  )
}

function StatusPill({ status }: { status: LeaderboardEntry["status"] }) {
  const config =
    status === "completed"
      ? {
          label: "Finished",
          dot: "bg-emerald-400",
          className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
        }
      : status === "waiting"
        ? {
            label: "Waiting",
            dot: "bg-amber-400",
            className: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25",
          }
        : {
            label: "Playing",
            dot: "bg-blue-400 animate-pulse",
            className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25",
          }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dot)} />
      {config.label}
    </span>
  )
}

export function InstructorPlaygroundLeaderboardTab({
  sessions,
  selectedLeaderboardSession,
  onSelectSession,
  loadingLeaderboard,
  refreshingLeaderboard = false,
  leaderboardData,
  leaderboardStats: _leaderboardStats,
  leaderboardSessionIsLive,
  onRefresh,
  getSessionDisplayLabel,
}: {
  sessions: PlaygroundLeaderboardSession[]
  selectedLeaderboardSession: string
  onSelectSession: (id: string) => void
  loadingLeaderboard: boolean
  refreshingLeaderboard?: boolean
  leaderboardData: LeaderboardEntry[]
  leaderboardStats: LeaderboardStats | null
  leaderboardSessionMeta?: LeaderboardSessionMeta | null
  selectedLeaderboardSessionRow?: PlaygroundLeaderboardSession | undefined
  leaderboardSessionIsLive: boolean
  onRefresh: () => void
  getSessionDisplayLabel: (session: PlaygroundLeaderboardSession) => string
}) {
  const [studentSearch, setStudentSearch] = useState("")
  const isSearching = studentSearch.trim().length > 0
  const listRevealed = usePlaygroundPodiumReveal(
    selectedLeaderboardSession,
    isSearching ? 0 : leaderboardData.length,
  )

  const podiumEntries = useMemo(
    () =>
      buildPodiumEntries(
        leaderboardData
          .filter((e) => e.status !== "waiting")
          .map((e) => ({
            rank: e.rank,
            displayName: e.studentName || e.displayName,
            studentName: e.studentName,
            score: e.score,
          })),
      ),
    [leaderboardData],
  )

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const aLive = a.is_active ? 1 : 0
      const bLive = b.is_active ? 1 : 0
      if (aLive !== bLive) return bLive - aLive
      return b.id - a.id
    })
  }, [sessions])

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase()
    if (!q) return leaderboardData
    return leaderboardData.filter((e) => {
      const hay = `${e.studentName} ${e.displayName} ${e.nickname ?? ""} ${e.studentId}`.toLowerCase()
      return hay.includes(q)
    })
  }, [leaderboardData, studentSearch])

  return (
    <div className="space-y-4">
      <FacultyIntegratedToolbar
        moduleId="playground"
        filters={
          <Select value={selectedLeaderboardSession || undefined} onValueChange={onSelectSession}>
            <SelectTrigger className="h-9 w-full min-w-[220px] rounded-lg border-0 bg-muted/50 shadow-none sm:min-w-[280px]">
              <SelectValue placeholder="Select playground session" />
            </SelectTrigger>
            <SelectContent>
              {sortedSessions.map((session) => (
                <SelectItem key={session.id} value={session.id.toString()}>
                  <span className="font-mono">{session.session_code}</span>
                  <span className="mx-1.5 text-[var(--cc-text-muted)]">·</span>
                  <span>{getSessionDisplayLabel(session)}</span>
                  {session.is_active && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      Live
                    </Badge>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        meta={
          leaderboardSessionIsLive ? (
            <p className={cn("text-xs", fp.iconText)}>
              Session is live — auto-refreshing every 8s
              {refreshingLeaderboard ? " · Updating…" : ""}
            </p>
          ) : (
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Rankings for the selected session</p>
          )
        }
        trailing={
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loadingLeaderboard} className="h-9 gap-1.5 rounded-lg">
            <RefreshCw className={cn("h-3.5 w-3.5", loadingLeaderboard && "animate-spin")} />
            Refresh
          </Button>
        }
      />

          {/* Podium — always visible when we have top performers */}
          {!loadingLeaderboard && leaderboardData.length > 0 && !isSearching && podiumEntries.length > 0 ? (
            <PlaygroundLeaderboardPodium
              entries={podiumEntries}
              listRevealed={listRevealed || isSearching}
              celebrationKey={selectedLeaderboardSession}
            />
          ) : null}

          {/* Student list */}
          {loadingLeaderboard && leaderboardData.length === 0 ? (
            <div className="text-center py-16">
              <Loader className={cn("h-8 w-8 mx-auto animate-spin", facultyModuleSpinnerClass("playground"))} />
              <p className={cn("mt-3 text-sm", PORTAL_TEXT_MUTED)}>Loading leaderboard…</p>
            </div>
          ) : leaderboardData.length > 0 ? (
            <div className="space-y-4">
              <FacultyIntegratedToolbar
                moduleId="playground"
                search={studentSearch}
                onSearchChange={setStudentSearch}
                onSearchClear={() => setStudentSearch("")}
                searchPlaceholder="Search students…"
                meta={
                  <p className={cn("text-xs font-medium", PORTAL_TEXT)}>
                    {listRevealed || isSearching ? "All students" : "Top three"}
                  </p>
                }
              />

              <AnimatePresence>
                {(listRevealed || isSearching) && (
                  <motion.div
                    key={`list-${selectedLeaderboardSession}`}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="space-y-2"
                  >
                    <div className="max-h-[min(70vh,640px)] overflow-auto">
                      <AnimatePresence mode="popLayout">
                        {filteredStudents.length === 0 ? (
                          <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={cn(PORTAL_CARD, "p-8 text-center text-sm", PORTAL_TEXT_MUTED)}
                          >
                            No students match &ldquo;{studentSearch}&rdquo;
                          </motion.p>
                        ) : (
                          filteredStudents.map((entry, idx) => {
                        const rank = entry.rank
                        const displayName = entry.studentName || entry.displayName
                        return (
                          <motion.div
                            key={entry.resultId || `${entry.studentId}-${idx}`}
                            layout
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ delay: Math.min(idx * 0.03, 0.35), duration: 0.3 }}
                            className="mb-2 flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 last:mb-0 sm:flex-row sm:items-center"
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <RankBadge rank={rank} />
                              <div
                                className={cn(
                                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
                                  fp.softBg,
                                  fp.iconText,
                                )}
                              >
                                {studentInitials(displayName)}
                              </div>
                              <div className="min-w-0">
                                <p className={cn("truncate font-semibold", PORTAL_TEXT)}>{displayName}</p>
                                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                  {entry.nickname && entry.nickname !== entry.studentName && (
                                    <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>@{entry.displayName}</span>
                                  )}
                                  <StatusPill status={entry.status} />
                                </div>
                              </div>
                            </div>

                            <div className="flex shrink-0 flex-wrap items-center gap-3 pl-[52px] sm:gap-5 sm:pl-0">
                              <div className="min-w-[52px] text-center">
                                <p className={cn("text-[10px] uppercase tracking-wide", PORTAL_TEXT_MUTED)}>Score</p>
                                <p className={cn("text-xl font-semibold tabular-nums", PORTAL_TEXT)}>{entry.score}</p>
                              </div>
                              <div className="hidden min-w-[44px] text-center sm:block">
                                <p className={cn("text-[10px] uppercase tracking-wide", PORTAL_TEXT_MUTED)}>Answered</p>
                                <p className={cn("text-sm font-semibold tabular-nums", PORTAL_TEXT)}>
                                  {entry.questionsAnswered}
                                </p>
                              </div>
                              <div className="hidden min-w-[44px] text-center sm:block">
                                <p className={cn("text-[10px] uppercase tracking-wide", PORTAL_TEXT_MUTED)}>Correct</p>
                                <p className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                                  {entry.correctAnswers}
                                </p>
                              </div>
                              <div className="min-w-[100px] sm:min-w-[120px]">
                                <p className={cn("mb-1 text-[10px] uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                                  Accuracy
                                </p>
                                <div className="flex items-center gap-2">
                                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${Math.min(entry.accuracyPercentage, 100)}%` }}
                                      transition={{ duration: 0.6, ease: "easeOut", delay: idx * 0.02 }}
                                      className={cn(
                                        "h-full rounded-full",
                                        entry.accuracyPercentage >= 80
                                          ? "bg-emerald-500"
                                          : entry.accuracyPercentage >= 60
                                            ? "bg-amber-500"
                                            : "bg-red-500",
                                      )}
                                    />
                                  </div>
                                  <span className={cn("w-10 text-right text-xs font-semibold tabular-nums", PORTAL_TEXT)}>
                                    {entry.accuracyPercentage.toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )
                      })
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
              )}
              </AnimatePresence>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(PORTAL_CARD, "py-16 text-center")}
            >
              <Trophy className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
              <p className={cn("text-lg font-semibold", PORTAL_TEXT)}>No leaderboard data</p>
              <p className={cn("text-sm mt-1 max-w-sm mx-auto", PORTAL_TEXT_MUTED)}>
                Students need to join and play this session before rankings appear here.
              </p>
            </motion.div>
          )}
    </div>
  )
}
