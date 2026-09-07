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
import { getStudentModuleTheme, studentModuleSpinnerClass } from "@/lib/student-module-themes"
import { portalOutlineButtonClass } from "@/lib/portal-module-themes"

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
            <div className="absolute inset-0 border-4 border-amber-200 dark:border-amber-900 rounded-full" />
            <div className="absolute inset-0 border-4 border-transparent border-t-amber-600 dark:border-t-amber-400 rounded-full animate-spin" />
            <Trophy className="h-8 w-8 text-amber-600 dark:text-amber-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">Loading leaderboard</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Preparing rankings...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4 sm:space-y-6 w-full min-w-0 overflow-x-hidden"
    >
      {/* Header */}
      <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] shadow-sm p-3 sm:p-4 md:p-5 lg:p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 shrink-0">
              {mode === "CLASSROOM" ? (
                <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              ) : (
                <User className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-200">
                {mode === "CLASSROOM" ? "Classroom Leaderboard" : "Performance Analytics"}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {mode === "CLASSROOM"
                  ? `${leaderboard.length} ${leaderboard.length === 1 ? "participant" : "participants"} competing`
                  : "Track your progress and improve your skills"}
              </p>
            </div>
            {mode === "CLASSROOM" && pollLeaderboard && leaderboard.length > 0 && (
              <Badge className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 text-sm px-3 py-1.5">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="w-2 h-2 rounded-full bg-green-500 mr-2 inline-block"
                />
                Live
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Classroom Leaderboard */}
      {mode === "CLASSROOM" && (
        <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] shadow-sm overflow-hidden">
          <div className="p-3 sm:p-4 md:p-5 lg:p-6 w-full min-w-0 overflow-x-hidden">
            {leaderboard.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16"
              >
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-6">
                  <Trophy className="h-12 w-12 text-amber-400 dark:text-amber-500" />
                </div>
                <h3 className="text-2xl font-bold text-slate-700 dark:text-slate-300 mb-2">No players yet</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">Be the first to join and claim the top spot!</p>
                <Link href={PLAYGROUND_BASE}>
                  <Button className={playgroundTheme.page.cta}>
                    <Zap className="h-4 w-4 mr-2" />
                    Start Playing
                  </Button>
                </Link>
              </motion.div>
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
                          isTopThree
                            ? entry.rank === 1
                              ? "bg-gradient-to-r from-yellow-50/50 via-amber-50/50 to-amber-50/50 dark:from-yellow-900/20 dark:via-amber-900/20 dark:to-amber-900/20 border-yellow-300/50 dark:border-yellow-700/50 shadow-lg shadow-yellow-500/20"
                              : entry.rank === 2
                                ? "bg-gradient-to-r from-slate-50/50 via-gray-50/50 to-slate-100/50 dark:from-slate-800/30 dark:via-gray-800/30 dark:to-slate-800/30 border-slate-300/50 dark:border-slate-700/50 shadow-md shadow-slate-400/20"
                                : cn(playgroundTheme.page.softBg, playgroundTheme.page.border, "shadow-md shadow-amber-500/20")
                            : cn(playgroundTheme.page.softBg, "border border-slate-200/70 dark:border-white/[0.08] hover:border-amber-500/40 dark:hover:border-amber-500/50 hover:shadow-lg")
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
                                    entry.rank === 1 && "bg-gradient-to-br from-yellow-400 to-yellow-600",
                                    entry.rank === 2 && "bg-gradient-to-br from-slate-400 to-slate-600",
                                    entry.rank === 3 && "bg-gradient-to-br from-amber-500 to-amber-700"
                                  )}
                                >
                                  {entry.rank === 1 && <Crown className="h-7 w-7 text-yellow-50 fill-yellow-50" />}
                                  {entry.rank === 2 && <Medal className="h-7 w-7 text-slate-50 fill-slate-50" />}
                                  {entry.rank === 3 && <Award className="h-7 w-7 text-amber-50 fill-amber-50" />}
                                </div>
                              ) : (
                                <div className={cn("flex items-center justify-center w-full h-full rounded-xl border-2", playgroundTheme.page.iconBg, playgroundTheme.page.border)}>
                                  <span className={cn("text-lg font-bold", playgroundTheme.page.iconText)}>{entry.rank}</span>
                                </div>
                              )}
                            </motion.div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white truncate">
                                  {entry.displayName}
                                  {isMe && <span className={cn("ml-1 text-xs", playgroundTheme.page.iconText)}>(You)</span>}
                                </h3>
                                {isTopThree && (
                                  <Badge
                                    className={cn(
                                      "text-xs px-2.5 py-1 font-semibold shadow-sm",
                                      entry.rank === 1 && "bg-yellow-500 text-yellow-950",
                                      entry.rank === 2 && "bg-slate-400 text-slate-950",
                                      entry.rank === 3 && "bg-amber-600 text-amber-950"
                                    )}
                                  >
                                    Top {entry.rank}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-4 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                      {accuracy}%
                                    </span>
                                  </div>
                                  <span className="text-xs text-slate-500 dark:text-slate-400">
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
                                <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                <p
                                  className={cn(
                                    "text-3xl md:text-4xl font-extrabold tabular-nums",
                                    isTopThree ? cn(playgroundTheme.page.iconText, "font-extrabold") : "text-slate-700 dark:text-slate-300"
                                  )}
                                >
                                  {entry.score.toLocaleString()}
                                </p>
                              </div>
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
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
              className={cn("rounded-2xl border-l-4 border border-slate-200/60 dark:border-white/[0.08] p-5 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all", "border-l-amber-500/60 dark:border-l-amber-400/50", playgroundTheme.page.softBg)}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-amber-500/15 dark:bg-amber-500/25">
                  <Trophy className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">Best Score</p>
              </div>
              <p className="text-3xl font-bold text-slate-800 dark:text-slate-200">{personalStats.bestScore.toLocaleString()}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.3, type: "spring" }}
              className="rounded-2xl border-l-4 border-l-amber-500/50 dark:border-l-amber-400/40 border border-slate-200/60 dark:border-white/[0.08] bg-amber-50/60 dark:bg-amber-950/20 p-5 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-amber-500/15 dark:bg-amber-500/25">
                  <BarChart3 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">Average Score</p>
              </div>
              <p className="text-3xl font-bold text-slate-800 dark:text-slate-200">{personalStats.avgScore.toLocaleString()}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.4, type: "spring" }}
              className={cn("rounded-2xl border-l-4 border border-slate-200/60 dark:border-white/[0.08] p-5 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all", "border-l-amber-500/50 dark:border-l-amber-400/40", playgroundTheme.page.softBg)}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-amber-500/15 dark:bg-amber-500/25">
                  <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">Games Played</p>
              </div>
              <p className="text-3xl font-bold text-slate-800 dark:text-slate-200">{personalStats.totalGames.toLocaleString()}</p>
            </motion.div>
          </div>

          <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] shadow-sm overflow-hidden">
            <div className={cn("p-4 sm:p-5 border-b border-slate-200/60 dark:border-white/[0.08]", playgroundTheme.page.softBg)}>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Recent Games</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Your latest playground sessions</p>
            </div>
            <div className="p-4 sm:p-6">
              {personalStats.recentGames.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
                    <Trophy className="h-10 w-10 text-amber-400 dark:text-amber-500" />
                  </div>
                  <p className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No games played yet</p>
                  <p className="text-slate-600 dark:text-slate-400">Start playing to see your history here!</p>
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
                          className={cn("rounded-xl border-2 hover:shadow-lg transition-all p-5", playgroundTheme.page.border, playgroundTheme.page.softBg, "hover:border-amber-500/40 dark:hover:border-amber-500/50")}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Game {personalStats.totalGames - index}</h3>
                                <Badge variant="outline" className={cn("text-xs", playgroundTheme.page.border)}>
                                  {accuracy}% accuracy
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                  <span className="text-sm text-slate-600 dark:text-slate-400">
                                    {game.correctAnswers}/{game.questionsAnswered} correct
                                  </span>
                                </div>
                                {game.completedAt && (
                                  <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {new Date(game.completedAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <div className="flex items-baseline gap-1 mb-1">
                                <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                <p className={cn("text-2xl font-extrabold", playgroundTheme.page.iconText)}>
                                  {game.score.toLocaleString()}
                                </p>
                              </div>
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Points</p>
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
          <Button variant="outline" size="lg" className="border-slate-200 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-700/50">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </motion.div>
  )
}
