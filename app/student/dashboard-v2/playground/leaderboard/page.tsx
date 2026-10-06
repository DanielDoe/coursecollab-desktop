"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Trophy, Medal, Award, Users, User, Crown, Sparkles, TrendingUp, Zap, Star, BarChart3, ArrowLeft } from "lucide-react"
import { motion, AnimatePresence } from "@/components/student/dashboard-v2/light-motion"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { buildPodiumEntries } from "@/lib/playground-podium"
import { PlaygroundLeaderboardPodium } from "@/components/playground/PlaygroundLeaderboardPodium"
import { usePlaygroundPodiumReveal } from "@/hooks/use-playground-podium-reveal"
import { playgroundStudentLeaderboardFingerprint } from "@/lib/playground-leaderboard-utils"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
const playgroundTheme = getStudentModuleTheme("playground")

interface LeaderboardEntry {
  rank: number
  displayName: string
  score: number
  questionsAnswered: number
  correctAnswers: number
  is_current_user?: boolean
}

interface PersonalStats {
  bestScore: number
  avgScore: number
  totalGames: number
  recentGames: Array<{
    score: number
    questionsAnswered: number
    correctAnswers: number
    completedAt: string
  }>
}

const PLAYGROUND_BASE = "/student/dashboard-v2/playground"

export default function DashboardV2PlaygroundLeaderboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const sessionId = searchParams.get("sessionId")
  const mode = searchParams.get("mode")

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [personalStats, setPersonalStats] = useState<PersonalStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [pollLeaderboard, setPollLeaderboard] = useState(false)
  const leaderboardFingerprintRef = useRef("")
  const [studentId, setStudentId] = useState<string | null>(null)

  useEffect(() => {
    const student = getStudentData()
    if (student) {
      setStudentId(student.id)
    } else {
      router.push("/student/login")
    }
  }, [router])

  useEffect(() => {
    if (!sessionId || !mode) {
      router.push(PLAYGROUND_BASE)
      return
    }
    if (mode === "PERSONAL" && !studentId) return

    const fetchData = async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false
      if (!silent) setIsLoading(true)

      try {
        if (mode === "CLASSROOM") {
          const studentIdParam = studentId ? `&studentId=${studentId}` : ""
          const response = await studentApiFetch(
            `/api/playground/leaderboard?sessionId=${sessionId}${studentIdParam}`,
          )
          if (!response.ok) throw new Error("Failed to fetch leaderboard")
          const data = await response.json()
          const nextLeaderboard = data.leaderboard || []
          const finalized = Boolean(data.leaderboardFinalized)
          setPollLeaderboard(!finalized)
          const fingerprint = playgroundStudentLeaderboardFingerprint(nextLeaderboard)
          if (fingerprint !== leaderboardFingerprintRef.current) {
            leaderboardFingerprintRef.current = fingerprint
            setLeaderboard(nextLeaderboard)
          }
        } else if (mode === "PERSONAL" && studentId) {
          const response = await studentApiFetch(`/api/playground/personal?studentId=${studentId}`)
          if (!response.ok) throw new Error("Failed to fetch personal stats")
          const data = await response.json()
          setPersonalStats(data)
          setPollLeaderboard(false)
        }
      } catch (error) {
        if (!silent) {
          leaderboardFingerprintRef.current = ""
          toast({
            title: "Error",
            description: "Failed to load leaderboard",
            variant: "destructive",
          })
        }
      } finally {
        if (!silent) setIsLoading(false)
      }
    }

    void fetchData()
  }, [sessionId, mode, studentId, router, toast])

  useEffect(() => {
    if (mode !== "CLASSROOM" || !pollLeaderboard || !sessionId) return

    const fetchData = async () => {
      try {
        const studentIdParam = studentId ? `&studentId=${studentId}` : ""
        const response = await studentApiFetch(
          `/api/playground/leaderboard?sessionId=${sessionId}${studentIdParam}`,
        )
        if (!response.ok) return
        const data = await response.json()
        const nextLeaderboard = data.leaderboard || []
        const finalized = Boolean(data.leaderboardFinalized)
        setPollLeaderboard(!finalized)
        const fingerprint = playgroundStudentLeaderboardFingerprint(nextLeaderboard)
        if (fingerprint !== leaderboardFingerprintRef.current) {
          leaderboardFingerprintRef.current = fingerprint
          setLeaderboard(nextLeaderboard)
        }
      } catch {
        // Silent background poll — keep current board on failure.
      }
    }

    const interval = setInterval(() => {
      void fetchData()
    }, 10000)

    return () => clearInterval(interval)
  }, [mode, pollLeaderboard, sessionId, studentId])

  const calculateAccuracy = (correct: number, total: number) => {
    if (total === 0) return 0
    return Math.round((correct / total) * 100)
  }

  const listRevealed = usePlaygroundPodiumReveal(sessionId ?? "", mode === "CLASSROOM" ? leaderboard.length : 0)
  const podiumEntries = useMemo(
    () =>
      buildPodiumEntries(
        leaderboard.map((e) => ({
          rank: e.rank,
          displayName: e.displayName,
          score: e.score,
        })),
      ),
    [leaderboard],
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-[var(--border)]" />
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[var(--cc-accent)]" />
            <Trophy className="absolute top-1/2 left-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-[var(--cc-accent)]" />
          </div>
          <p className="text-lg font-semibold text-[var(--cc-text)]">Loading leaderboard</p>
          <p className="text-sm text-[var(--cc-text-muted)]">Preparing rankings...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 space-y-4 overflow-x-hidden sm:space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm sm:p-4 md:p-5 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-xl bg-[var(--cc-accent-soft)] p-2">
              {mode === "CLASSROOM" ? (
                <Users className="h-5 w-5 text-[var(--cc-accent-dark)]" />
              ) : (
                <User className="h-5 w-5 text-[var(--cc-accent-dark)]" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--cc-text)] sm:text-xl">
                {mode === "CLASSROOM" ? "Classroom Leaderboard" : "Performance Analytics"}
              </h2>
              <p className="text-sm text-[var(--cc-text-muted)]">
                {mode === "CLASSROOM"
                  ? `${leaderboard.length} ${leaderboard.length === 1 ? "participant" : "participants"} competing`
                  : "Track your progress and improve your skills"}
              </p>
            </div>
            {mode === "CLASSROOM" && pollLeaderboard && leaderboard.length > 0 && (
              <Badge className="border border-[var(--cc-sem-success-border)] bg-[var(--cc-sem-success-soft)] px-3 py-1.5 text-sm text-[var(--cc-sem-success-text)]">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="mr-2 inline-block h-2 w-2 rounded-full bg-[var(--cc-sem-success)]"
                />
                Live
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Classroom Leaderboard */}
      {mode === "CLASSROOM" && (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
          <div className="p-3 sm:p-4 md:p-5 lg:p-6 w-full min-w-0 overflow-x-hidden">
            {leaderboard.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mb-6 inline-flex h-24 w-24 items-center justify-center rounded-full bg-[var(--cc-accent-soft)]">
                  <Trophy className="h-12 w-12 text-[var(--cc-accent)]" />
                </div>
                <h3 className="mb-2 text-2xl font-semibold text-[var(--cc-text)]">No players yet</h3>
                <p className="mb-6 text-[var(--cc-text-muted)]">Be the first to join and claim the top spot!</p>
                <Link href={PLAYGROUND_BASE}>
                  <Button className={playgroundTheme.page.cta}>
                    <Zap className="h-4 w-4 mr-2" />
                    Start Playing
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {podiumEntries.length > 0 ? (
                  <PlaygroundLeaderboardPodium
                    entries={podiumEntries}
                    listRevealed={listRevealed}
                    celebrationKey={sessionId ?? undefined}
                  />
                ) : null}

                <AnimatePresence>
                  {listRevealed ? (
                    <motion.div
                      key={`leaderboard-list-${sessionId}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                      transition={{ duration: 0.45, ease: "easeOut" }}
                      className="space-y-3"
                    >
                      {leaderboard.map((entry, index) => {
                    const isMe = Boolean(entry.is_current_user)
                    const accuracy = isMe ? calculateAccuracy(entry.correctAnswers, entry.questionsAnswered) : 0
                    const isTopThree = entry.rank <= 3
                    const maxScore = Math.max(0, ...leaderboard.map((e) => e.score ?? 0))
                    const scorePercentage = isMe && maxScore > 0 ? (entry.score / maxScore) * 100 : 0

                    return (
                      <motion.div
                        key={`${entry.rank}-${index}`}
                        initial={{ x: -50, opacity: 0, scale: 0.95 }}
                        animate={{ x: 0, opacity: 1, scale: 1 }}
                        exit={{ x: 50, opacity: 0, scale: 0.95 }}
                        transition={{ delay: index * 0.05, type: "spring", stiffness: 100, damping: 12 }}
                        whileHover={{ scale: 1.02, y: -2 }}
                        className={cn(
                          "group relative overflow-hidden rounded-2xl border-2 transition-all duration-300",
                          isMe
                            ? "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)]"
                            : "border-[var(--border)] bg-[var(--card)]"
                        )}
                      >
                        <div className="relative p-3 sm:p-5 md:p-6 z-10">
                          <div className="flex items-center gap-3 sm:gap-4 md:gap-6">
                            <motion.div
                              whileHover={{ scale: 1.1, rotate: [0, -10, 10, 0] }}
                              transition={{ duration: 0.3 }}
                              className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex-shrink-0"
                            >
                              {isTopThree ? (
                                <div
                                  className={cn(
                                    "flex items-center justify-center w-full h-full rounded-xl shadow-lg",
                                    entry.rank === 1 && "bg-[var(--cc-accent)] text-white",
                                    entry.rank === 2 && "border border-[var(--border)] bg-[var(--muted)] text-[var(--cc-text)]",
                                    entry.rank === 3 && "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                                  )}
                                >
                                  {entry.rank === 1 && <Crown className="h-7 w-7" />}
                                  {entry.rank === 2 && <Medal className="h-7 w-7" />}
                                  {entry.rank === 3 && <Award className="h-7 w-7" />}
                                </div>
                              ) : (
                                <div className={cn("flex items-center justify-center w-full h-full rounded-xl border-2", playgroundTheme.page.iconBg, playgroundTheme.page.border)}>
                                  <span className={cn("text-lg font-bold", playgroundTheme.page.iconText)}>{entry.rank}</span>
                                </div>
                              )}
                            </motion.div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="truncate text-lg font-semibold text-[var(--cc-text)] md:text-xl">
                                  {entry.displayName}
                                  {isMe && <span className={cn("ml-1 text-xs", playgroundTheme.page.iconText)}>(You)</span>}
                                </h3>
                                {isTopThree && (
                                  <Badge
                                    className={cn(
                                      "text-xs px-2.5 py-1 font-semibold shadow-sm",
                                      entry.rank === 1 && "bg-[var(--cc-accent)] text-white",
                                      entry.rank === 2 && "bg-[var(--muted)] text-[var(--cc-text)]",
                                      entry.rank === 3 && "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                                    )}
                                  >
                                    Top {entry.rank}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <Star className="h-4 w-4 text-[var(--cc-accent)]" />
                                    <span className="text-sm font-semibold text-[var(--cc-text)]">
                                      {accuracy}%
                                    </span>
                                  </div>
                                  <span className="text-xs text-[var(--cc-text-muted)]">
                                    ({entry.correctAnswers}/{entry.questionsAnswered})
                                  </span>
                                </div>
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: "100%" }}
                                  transition={{ delay: index * 0.05 + 0.3, duration: 0.5 }}
                                  className="flex-1 max-w-[200px] hidden sm:block"
                                >
                                  <Progress value={scorePercentage} className="h-2" />
                                </motion.div>
                              </div>
                            </div>

                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: index * 0.05 + 0.4, type: "spring" }}
                              className="text-right flex-shrink-0"
                            >
                              <div className="flex items-baseline gap-1.5 mb-1">
                                <TrendingUp className="h-5 w-5 text-[var(--cc-accent)]" />
                                <p className="text-3xl font-semibold tabular-nums text-[var(--cc-text)] md:text-4xl">
                                  {entry.score.toLocaleString()}
                                </p>
                              </div>
                              <p className="text-xs font-medium uppercase tracking-wide text-[var(--cc-text-muted)]">
                                Points
                              </p>
                            </motion.div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Personal Stats */}
      {mode === "PERSONAL" && personalStats && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4 md:gap-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"
            >
              <div className="mb-3 flex items-center gap-2">
                <div className="rounded-lg bg-[var(--cc-accent-soft)] p-1.5">
                  <Trophy className="h-5 w-5 text-[var(--cc-accent-dark)]" />
                </div>
                <p className="text-xs font-medium uppercase text-[var(--cc-text-muted)]">Best Score</p>
              </div>
              <p className="text-3xl font-semibold text-[var(--cc-text)]">{personalStats.bestScore.toLocaleString()}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.3, type: "spring" }}
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"
            >
              <div className="mb-3 flex items-center gap-2">
                <div className="rounded-lg bg-[var(--cc-accent-soft)] p-1.5">
                  <BarChart3 className="h-5 w-5 text-[var(--cc-accent-dark)]" />
                </div>
                <p className="text-xs font-medium uppercase text-[var(--cc-text-muted)]">Average Score</p>
              </div>
              <p className="text-3xl font-semibold text-[var(--cc-text)]">{personalStats.avgScore.toLocaleString()}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.4, type: "spring" }}
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5"
            >
              <div className="mb-3 flex items-center gap-2">
                <div className="rounded-lg bg-[var(--cc-accent-soft)] p-1.5">
                  <Users className="h-5 w-5 text-[var(--cc-accent-dark)]" />
                </div>
                <p className="text-xs font-medium uppercase text-[var(--cc-text-muted)]">Games Played</p>
              </div>
              <p className="text-3xl font-semibold text-[var(--cc-text)]">{personalStats.totalGames.toLocaleString()}</p>
            </motion.div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
            <div className="border-b border-[var(--border)] p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[var(--cc-accent)]" />
                <h3 className="text-base font-semibold text-[var(--cc-text)]">Recent Games</h3>
              </div>
              <p className="mt-1 text-sm text-[var(--cc-text-muted)]">Your latest playground sessions</p>
            </div>
            <div className="p-4 sm:p-6">
              {personalStats.recentGames.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-[var(--cc-accent-soft)]">
                    <Trophy className="h-10 w-10 text-[var(--cc-accent)]" />
                  </div>
                  <p className="mb-2 text-lg font-semibold text-[var(--cc-text)]">No games played yet</p>
                  <p className="text-[var(--cc-text-muted)]">Start playing to see your history here!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {personalStats.recentGames.map((game, index) => {
                      const accuracy = calculateAccuracy(game.correctAnswers, game.questionsAnswered)
                      return (
                        <motion.div
                          key={index}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          exit={{ x: 20, opacity: 0 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ scale: 1.02, x: 5 }}
                          className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-semibold text-[var(--cc-text)]">Game {personalStats.totalGames - index}</h3>
                                <Badge variant="outline" className={cn("text-xs", playgroundTheme.page.border)}>
                                  {accuracy}% accuracy
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <Star className="h-4 w-4 text-[var(--cc-accent)]" />
                                  <span className="text-sm text-[var(--cc-text-secondary)]">
                                    {game.correctAnswers}/{game.questionsAnswered} correct
                                  </span>
                                </div>
                                {game.completedAt && (
                                  <span className="text-xs text-[var(--cc-text-muted)]">
                                    {new Date(game.completedAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <div className="flex items-baseline gap-1 mb-1">
                                <TrendingUp className="h-5 w-5 text-[var(--cc-accent)]" />
                                <p className={cn("text-2xl font-extrabold", playgroundTheme.page.iconText)}>
                                  {game.score.toLocaleString()}
                                </p>
                              </div>
                              <p className="text-xs font-medium uppercase text-[var(--cc-text-muted)]">Points</p>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Link href={PLAYGROUND_BASE}>
          <Button size="lg" className={playgroundTheme.page.cta}>
            <Zap className="h-5 w-5 mr-2" />
            Play Again
          </Button>
        </Link>
        <Link href="/student/dashboard-v2">
          <Button variant="outline" size="lg">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  )
}
