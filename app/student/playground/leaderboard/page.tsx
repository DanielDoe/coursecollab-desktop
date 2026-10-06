"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Trophy, Medal, Award, Users, User, Crown, Sparkles, TrendingUp, Zap, Star, CheckCircle2, Clock, Target, BarChart3, ArrowLeft } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { StudentHeader } from "@/components/student-header"
import { getStudentData, getStudentAuthHeaders } from "@/lib/auth"
import { buildPodiumEntries } from "@/lib/playground-podium"
import { PlaygroundLeaderboardPodium } from "@/components/playground/PlaygroundLeaderboardPodium"
import { usePlaygroundPodiumReveal } from "@/hooks/use-playground-podium-reveal"
import { playgroundStudentLeaderboardFingerprint } from "@/lib/playground-leaderboard-utils"

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

export default function PlaygroundLeaderboard() {
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
  const [blurPeerNames, setBlurPeerNames] = useState(false)

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
      router.push("/student/playground")
      return
    }
    if (mode === "PERSONAL" && !studentId) return

    const fetchData = async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false
      if (!silent) setIsLoading(true)

      try {
        if (mode === "CLASSROOM") {
          const studentIdParam = studentId ? `&studentId=${studentId}` : ""
          const response = await fetch(`/api/playground/leaderboard?sessionId=${sessionId}${studentIdParam}`, {
            headers: getStudentAuthHeaders(),
          })
          if (!response.ok) throw new Error("Failed to fetch leaderboard")
          const data = await response.json()
          setBlurPeerNames(
            data.leaderboardPrivacy?.blurPeerNames ?? data.privacyMode ?? false,
          )
          const nextLeaderboard = data.leaderboard || []
          const finalized = Boolean(data.leaderboardFinalized)
          setPollLeaderboard(!finalized)
          const fingerprint = playgroundStudentLeaderboardFingerprint(nextLeaderboard)
          if (fingerprint !== leaderboardFingerprintRef.current) {
            leaderboardFingerprintRef.current = fingerprint
            setLeaderboard(nextLeaderboard)
          }
        } else if (mode === "PERSONAL" && studentId) {
          const response = await fetch(`/api/playground/personal?studentId=${studentId}`)
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
        const response = await fetch(`/api/playground/leaderboard?sessionId=${sessionId}${studentIdParam}`, {
          headers: getStudentAuthHeaders(),
        })
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
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--cc-background)] text-[var(--cc-text)]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-[var(--border)]"></div>
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[var(--cc-accent)]"></div>
            <Trophy className="absolute top-1/2 left-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-[var(--cc-accent)]" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-[var(--cc-text)]">Loading leaderboard</p>
            <p className="text-sm text-[var(--cc-text-muted)]">Preparing rankings...</p>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--cc-background)] text-[var(--cc-text)]">
      <StudentHeader />

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="max-w-6xl mx-auto">
          {/* Header Section */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 lg:mb-12"
          >
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-4 mb-6">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--cc-accent)]"
                >
                  {mode === "CLASSROOM" ? (
                    <Users className="h-10 w-10 text-white" />
                  ) : (
                    <User className="h-10 w-10 text-white" />
                  )}
                </motion.div>
                {mode === "CLASSROOM" && pollLeaderboard && leaderboard.length > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Badge variant="outline" className="border-[var(--cc-sem-success-border)] bg-[var(--cc-sem-success-soft)] px-3 py-1.5 text-sm text-[var(--cc-sem-success-text)]">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="mr-2 inline-block h-2 w-2 rounded-full bg-[var(--cc-sem-success)]"
                      />
                      Live
                    </Badge>
                  </motion.div>
                )}
              </div>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mb-4 text-4xl font-semibold tracking-tight text-[var(--cc-text)] lg:text-5xl"
              >
                {mode === "CLASSROOM" ? "Classroom Leaderboard" : "Performance Analytics"}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-lg text-[var(--cc-text-muted)]"
              >
                {mode === "CLASSROOM" 
                  ? `${leaderboard.length} ${leaderboard.length === 1 ? "participant" : "participants"} competing`
                  : "Track your progress and improve your skills"}
              </motion.p>
            </div>
          </motion.div>

          {/* Classroom Leaderboard */}
          {mode === "CLASSROOM" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="overflow-hidden border border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)] shadow-sm">
                <CardHeader className="relative px-8 pb-6 pt-8">
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 200 }}
                        className="relative"
                      >
                        <div className="relative rounded-2xl bg-[var(--cc-accent)] p-3">
                          <Trophy className="h-7 w-7 text-white" />
                        </div>
                      </motion.div>
                      <div>
                        <CardTitle className="mb-1.5 text-3xl font-semibold text-[var(--cc-text)]">
                          Rankings
                        </CardTitle>
                        <CardDescription className="text-base font-medium text-[var(--cc-text-muted)]">
                          Sorted by total score
                        </CardDescription>
                      </div>
                    </div>
                    {mode === "CLASSROOM" && pollLeaderboard && leaderboard.length > 0 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring" }}
                      >
                        <Badge className="border-0 bg-[var(--cc-success)] px-4 py-1.5 text-sm font-semibold text-white">
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="w-2 h-2 rounded-full bg-white mr-2 inline-block"
                          />
                          Live Updates
                        </Badge>
                      </motion.div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {leaderboard.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-16"
                    >
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 3 }}
                        className="mb-6 inline-flex h-24 w-24 items-center justify-center rounded-full bg-[var(--cc-accent-soft)]"
                      >
                        <Trophy className="h-12 w-12 text-[var(--cc-accent)]" />
                      </motion.div>
                      <h3 className="mb-2 text-2xl font-bold text-[var(--cc-text)]">No players yet</h3>
                      <p className="text-muted-foreground mb-6">Be the first to join and claim the top spot!</p>
                      <Button 
                        onClick={() => router.push("/student/playground")} 
                        size="lg"
                        className="bg-[var(--cc-accent)] text-white hover:bg-[var(--cc-accent-hover)]"
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Start Playing
                      </Button>
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
                          const showDetails = isMe || !blurPeerNames
                          const accuracy = showDetails
                            ? calculateAccuracy(entry.correctAnswers, entry.questionsAnswered)
                            : 0
                          const isTopThree = entry.rank <= 3
                          const maxScore = Math.max(
                            0,
                            ...leaderboard.map((e) =>
                              blurPeerNames && !e.is_current_user ? 0 : (e.score ?? 0),
                            ),
                          )
                          const scorePercentage =
                            isMe && maxScore > 0 ? (entry.score / maxScore) * 100 : 0

                          return (
                            <motion.div
                              key={`${entry.rank}-${index}`}
                              initial={{ x: -50, opacity: 0, scale: 0.95 }}
                              animate={{ x: 0, opacity: 1, scale: 1 }}
                              exit={{ x: 50, opacity: 0, scale: 0.95 }}
                              transition={{ 
                                delay: index * 0.05, 
                                type: "spring", 
                                stiffness: 100,
                                damping: 12
                              }}
                              whileHover={{ scale: 1.02, y: -2 }}
                              className={cn(
                                "group relative overflow-hidden rounded-2xl border-2 transition-all duration-300",
                                isMe
                                  ? "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)]"
                                  : "border-[var(--border)] bg-[var(--card)]"
                              )}
                            >
                              <div className="relative z-10 p-3 sm:p-5 md:p-6">
                                <div className="flex items-center gap-3 sm:gap-4 md:gap-6">
                                  {/* Rank */}
                                  <motion.div
                                    whileHover={{ scale: 1.1, rotate: [0, -10, 10, 0] }}
                                    transition={{ duration: 0.3 }}
                                    className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex-shrink-0"
                                  >
                                    {isTopThree ? (
                                      <div className={cn(
                                        "flex h-full w-full items-center justify-center rounded-xl",
                                        entry.rank === 1 && "bg-[var(--cc-accent)] text-white",
                                        entry.rank === 2 && "border border-[var(--border)] bg-[var(--muted)] text-[var(--cc-text)]",
                                        entry.rank === 3 && "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                                      )}>
                                        {entry.rank === 1 && <Crown className="h-7 w-7" />}
                                        {entry.rank === 2 && <Medal className="h-7 w-7" />}
                                        {entry.rank === 3 && <Award className="h-7 w-7" />}
                                      </div>
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--muted)]">
                                        <span className="text-lg font-bold text-[var(--cc-text)]">{entry.rank}</span>
                                      </div>
                                    )}
                                  </motion.div>

                                  {/* Student Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                      <h3 className="truncate text-lg font-bold text-[var(--cc-text)] md:text-xl">
                                        {entry.displayName}
                                        {isMe && <span className="ml-1 text-xs text-[var(--cc-accent)]">(You)</span>}
                                      </h3>
                                      {isTopThree && (
                                        <motion.div
                                          initial={{ scale: 0 }}
                                          animate={{ scale: 1 }}
                                          transition={{ delay: index * 0.1 + 0.5, type: "spring" }}
                                        >
                                          <Badge className={cn(
                                            "px-2.5 py-1 text-xs font-semibold",
                                            entry.rank === 1 && "bg-[var(--cc-accent)] text-white",
                                            entry.rank === 2 && "bg-[var(--muted)] text-[var(--cc-text)]",
                                            entry.rank === 3 && "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                                          )}>
                                            Top {entry.rank}
                                          </Badge>
                                        </motion.div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-4 flex-wrap">
                                      {showDetails ? (
                                      <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1.5">
                                          <Star className="h-4 w-4 text-[var(--cc-accent)]" />
                                          <span className="text-sm font-semibold text-[var(--cc-text)]">
                                            {accuracy}%
                                          </span>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                          ({entry.correctAnswers}/{entry.questionsAnswered})
                                        </span>
                                      </div>
                                      ) : (
                                        <span className="text-xs text-muted-foreground blur-[6px] select-none">
                                          Details hidden
                                        </span>
                                      )}
                                      {showDetails ? (
                                      <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: "100%" }}
                                        transition={{ delay: index * 0.05 + 0.3, duration: 0.5 }}
                                        className="flex-1 max-w-[200px] hidden sm:block"
                                      >
                                        <Progress value={scorePercentage} className="h-2" />
                                      </motion.div>
                                      ) : null}
                                    </div>
                                  </div>

                                  {/* Score */}
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: index * 0.05 + 0.4, type: "spring" }}
                                    className="text-right flex-shrink-0"
                                  >
                                    {showDetails ? (
                                    <>
                                    <div className="flex items-baseline gap-1.5 mb-1">
                                      <TrendingUp className="h-5 w-5 text-[var(--cc-accent)]" />
                                      <p className="text-3xl font-semibold tabular-nums text-[var(--cc-text)] md:text-4xl">
                                        {entry.score.toLocaleString()}
                                      </p>
                                    </div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                      Points
                                    </p>
                                    </>
                                    ) : (
                                    <p className="select-none text-2xl font-semibold text-[var(--cc-text-muted)] blur-[6px]">•••</p>
                                    )}
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
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Personal Stats */}
          {mode === "PERSONAL" && personalStats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-6"
            >
              {/* Stats Cards */}
              <div className="grid md:grid-cols-3 gap-4 md:gap-6">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.4, type: "spring" }}
                  whileHover={{ scale: 1.05, y: -5 }}
                >
                  <Card className="overflow-hidden border border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)] shadow-sm">
                    <CardContent className="relative z-10 pt-6 text-center">
                      <motion.div
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.5 }}
                        className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--cc-accent-soft)]"
                      >
                        <Trophy className="h-8 w-8 text-[var(--cc-accent)]" />
                      </motion.div>
                      <motion.p
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.6, type: "spring" }}
                        className="mb-2 text-4xl font-semibold text-[var(--cc-text)]"
                      >
                        {personalStats.bestScore.toLocaleString()}
                      </motion.p>
                      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">Best Score</p>
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.5, type: "spring" }}
                  whileHover={{ scale: 1.05, y: -5 }}
                >
                  <Card className="overflow-hidden border border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)] shadow-sm">
                    <CardContent className="relative z-10 pt-6 text-center">
                      <motion.div
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.5 }}
                        className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--cc-accent-soft)]"
                      >
                        <BarChart3 className="h-8 w-8 text-[var(--cc-accent)]" />
                      </motion.div>
                      <motion.p
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.7, type: "spring" }}
                        className="mb-2 text-4xl font-semibold text-[var(--cc-text)]"
                      >
                        {personalStats.avgScore.toLocaleString()}
                      </motion.p>
                      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">Average Score</p>
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.6, type: "spring" }}
                  whileHover={{ scale: 1.05, y: -5 }}
                >
                  <Card className="overflow-hidden border border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)] shadow-sm">
                    <CardContent className="relative z-10 pt-6 text-center">
                      <motion.div
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.5 }}
                        className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--cc-accent-soft)]"
                      >
                        <Users className="h-8 w-8 text-[var(--cc-accent)]" />
                      </motion.div>
                      <motion.p
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.8, type: "spring" }}
                        className="mb-2 text-4xl font-semibold text-[var(--cc-text)]"
                      >
                        {personalStats.totalGames.toLocaleString()}
                      </motion.p>
                      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">Games Played</p>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Recent Games */}
              <Card className="border border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)] shadow-sm">
                <CardHeader className="border-b border-[var(--border)]">
                  <CardTitle className="flex items-center gap-2 text-2xl font-semibold">
                    <Sparkles className="h-5 w-5 text-[var(--cc-accent)]" />
                    Recent Games
                  </CardTitle>
                  <CardDescription>Your latest playground sessions</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {personalStats.recentGames.length === 0 ? (
                    <div className="text-center py-12">
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 3 }}
                        className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-[var(--cc-accent-soft)]"
                      >
                        <Trophy className="h-10 w-10 text-[var(--cc-accent)]" />
                      </motion.div>
                      <p className="mb-2 text-lg font-semibold text-[var(--cc-text)]">No games played yet</p>
                      <p className="text-muted-foreground">Start playing to see your history here!</p>
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
                              className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--cc-background)]"
                            >
                              <div className="p-5">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <h3 className="text-lg font-bold text-[var(--cc-text)]">
                                        Game {personalStats.totalGames - index}
                                      </h3>
                                      <Badge variant="outline" className="border-[var(--border)] text-xs text-[var(--cc-text)]">
                                        {accuracy}% accuracy
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <div className="flex items-center gap-2">
                                        <Star className="h-4 w-4 text-[var(--cc-accent)]" />
                                        <span className="text-sm text-[var(--cc-text-muted)]">
                                          {game.correctAnswers}/{game.questionsAnswered} correct
                                        </span>
                                      </div>
                                      {game.completedAt && (
                                        <span className="text-xs text-muted-foreground">
                                          {new Date(game.completedAt).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right ml-4">
                                    <div className="flex items-baseline gap-1 mb-1">
                                      <TrendingUp className="h-5 w-5 text-[var(--cc-accent)]" />
                                      <p className="text-2xl font-semibold text-[var(--cc-text)]">
                                        {game.score.toLocaleString()}
                                      </p>
                                    </div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                      Points
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mt-10"
          >
            <Button
              onClick={() => router.push("/student/playground")}
              size="lg"
              className="bg-[var(--cc-accent)] text-white hover:bg-[var(--cc-accent-hover)]"
            >
              <Zap className="h-5 w-5 mr-2" />
              Play Again
            </Button>
            <Button
              onClick={() => router.push("/student/dashboard")}
              variant="outline"
              size="lg"
              className="border-[var(--border)] text-[var(--cc-text)]"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
