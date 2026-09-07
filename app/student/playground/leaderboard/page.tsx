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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-blue-900/20 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 border-4 border-purple-200 dark:border-purple-900 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-purple-600 dark:border-t-purple-400 rounded-full animate-spin"></div>
            <Trophy className="h-8 w-8 text-purple-600 dark:text-purple-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">Loading leaderboard</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Preparing rankings...</p>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-blue-900/20">
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
                  className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30"
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
                    <Badge variant="outline" className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 text-sm px-3 py-1.5">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="w-2 h-2 rounded-full bg-green-500 mr-2 inline-block"
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
                className="text-4xl lg:text-5xl font-extrabold mb-4 bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 bg-clip-text text-transparent"
              >
                {mode === "CLASSROOM" ? "Classroom Leaderboard" : "Performance Analytics"}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-lg text-slate-600 dark:text-slate-400"
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
              <Card className="border-0 shadow-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl overflow-hidden">
                <CardHeader className="relative pb-6 pt-8 px-8">
                  {/* Decorative background elements */}
                  <div className="absolute inset-0 overflow-hidden rounded-t-lg">
                    <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-purple-500/5 to-transparent rounded-full blur-3xl" />
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-pink-500/5 to-transparent rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-gradient-to-t from-blue-500/5 to-transparent rounded-full blur-3xl" />
                  </div>
                  
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 200 }}
                        className="relative"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl blur-lg opacity-50" />
                        <div className="relative p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30">
                          <Trophy className="h-7 w-7 text-white" />
                        </div>
                      </motion.div>
                      <div>
                        <CardTitle className="text-3xl font-extrabold mb-1.5 bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 bg-clip-text text-transparent">
                          Rankings
                        </CardTitle>
                        <CardDescription className="text-base font-medium text-slate-600 dark:text-slate-400">
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
                        <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-lg shadow-green-500/30 px-4 py-1.5 text-sm font-semibold">
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
                        className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 mb-6"
                      >
                        <Trophy className="h-12 w-12 text-purple-400 dark:text-purple-500" />
                      </motion.div>
                      <h3 className="text-2xl font-bold text-slate-700 dark:text-slate-300 mb-2">No players yet</h3>
                      <p className="text-muted-foreground mb-6">Be the first to join and claim the top spot!</p>
                      <Button 
                        onClick={() => router.push("/student/playground")} 
                        size="lg"
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/30"
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
                                isTopThree
                                  ? entry.rank === 1
                                    ? "bg-gradient-to-r from-yellow-50/50 via-amber-50/50 to-orange-50/50 dark:from-yellow-900/20 dark:via-amber-900/20 dark:to-orange-900/20 border-yellow-300/50 dark:border-yellow-700/50 shadow-lg shadow-yellow-500/20"
                                    : entry.rank === 2
                                    ? "bg-gradient-to-r from-slate-50/50 via-gray-50/50 to-slate-100/50 dark:from-slate-800/30 dark:via-gray-800/30 dark:to-slate-800/30 border-slate-300/50 dark:border-slate-700/50 shadow-md shadow-slate-400/20"
                                    : "bg-gradient-to-r from-amber-50/50 via-orange-50/50 to-amber-100/50 dark:from-amber-900/20 dark:via-orange-900/20 dark:to-amber-900/20 border-amber-300/50 dark:border-amber-700/50 shadow-md shadow-amber-500/20"
                                  : "bg-gradient-to-r from-purple-50/30 via-pink-50/30 to-blue-50/30 dark:from-purple-900/10 dark:via-pink-900/10 dark:to-blue-900/10 border-purple-200/50 dark:border-purple-800/50 hover:border-purple-400 dark:hover:border-purple-600 hover:shadow-lg"
                              )}
                            >
                              {/* Animated glow effect */}
                              <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100"
                                animate={{
                                  x: ['-100%', '100%'],
                                }}
                                transition={{
                                  repeat: Infinity,
                                  duration: 2,
                                  ease: "linear"
                                }}
                              />

                              <div className="relative p-3 sm:p-5 md:p-6 z-10">
                                <div className="flex items-center gap-3 sm:gap-4 md:gap-6">
                                  {/* Rank */}
                                  <motion.div
                                    whileHover={{ scale: 1.1, rotate: [0, -10, 10, 0] }}
                                    transition={{ duration: 0.3 }}
                                    className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 flex-shrink-0"
                                  >
                                    {isTopThree ? (
                                      <div className={cn(
                                        "flex items-center justify-center w-full h-full rounded-xl shadow-lg",
                                        entry.rank === 1 && "bg-gradient-to-br from-yellow-400 to-yellow-600",
                                        entry.rank === 2 && "bg-gradient-to-br from-slate-400 to-slate-600",
                                        entry.rank === 3 && "bg-gradient-to-br from-amber-500 to-amber-700"
                                      )}>
                                        {entry.rank === 1 && <Crown className="h-7 w-7 text-yellow-50 fill-yellow-50" />}
                                        {entry.rank === 2 && <Medal className="h-7 w-7 text-slate-50 fill-slate-50" />}
                                        {entry.rank === 3 && <Award className="h-7 w-7 text-amber-50 fill-amber-50" />}
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-center w-full h-full rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 border-2 border-purple-200 dark:border-purple-800">
                                        <span className="text-lg font-bold text-purple-700 dark:text-purple-300">{entry.rank}</span>
                                      </div>
                                    )}
                                  </motion.div>

                                  {/* Student Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                      <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white truncate">
                                        {entry.displayName}
                                        {isMe && <span className="ml-1 text-xs text-purple-600">(You)</span>}
                                      </h3>
                                      {isTopThree && (
                                        <motion.div
                                          initial={{ scale: 0 }}
                                          animate={{ scale: 1 }}
                                          transition={{ delay: index * 0.1 + 0.5, type: "spring" }}
                                        >
                                          <Badge className={cn(
                                            "text-xs px-2.5 py-1 font-semibold shadow-sm",
                                            entry.rank === 1 && "bg-yellow-500 text-yellow-950",
                                            entry.rank === 2 && "bg-slate-400 text-slate-950",
                                            entry.rank === 3 && "bg-amber-600 text-amber-950"
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
                                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
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
                                      <TrendingUp className={cn(
                                        "h-5 w-5",
                                        isTopThree ? "text-purple-600 dark:text-purple-400" : "text-purple-400 dark:text-purple-500"
                                      )} />
                                      <p className={cn(
                                        "text-3xl md:text-4xl font-extrabold tabular-nums",
                                        isTopThree 
                                          ? "bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent"
                                          : "text-slate-700 dark:text-slate-300"
                                      )}>
                                        {entry.score.toLocaleString()}
                                      </p>
                                    </div>
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                      Points
                                    </p>
                                    </>
                                    ) : (
                                    <p className="text-2xl font-bold text-slate-400 blur-[6px] select-none">•••</p>
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
                  <Card className="border-0 shadow-xl bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 hover:shadow-2xl transition-all duration-300 overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-400/20 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform" />
                    <CardContent className="pt-6 text-center relative z-10">
                      <motion.div
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 mb-4 shadow-lg"
                      >
                        <Trophy className="h-8 w-8 text-white" />
                      </motion.div>
                      <motion.p
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.6, type: "spring" }}
                        className="text-4xl font-extrabold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent mb-2"
                      >
                        {personalStats.bestScore.toLocaleString()}
                      </motion.p>
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Best Score</p>
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.5, type: "spring" }}
                  whileHover={{ scale: 1.05, y: -5 }}
                >
                  <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 hover:shadow-2xl transition-all duration-300 overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform" />
                    <CardContent className="pt-6 text-center relative z-10">
                      <motion.div
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 mb-4 shadow-lg"
                      >
                        <BarChart3 className="h-8 w-8 text-white" />
                      </motion.div>
                      <motion.p
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.7, type: "spring" }}
                        className="text-4xl font-extrabold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-2"
                      >
                        {personalStats.avgScore.toLocaleString()}
                      </motion.p>
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Average Score</p>
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.6, type: "spring" }}
                  whileHover={{ scale: 1.05, y: -5 }}
                >
                  <Card className="border-0 shadow-xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 hover:shadow-2xl transition-all duration-300 overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400/20 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform" />
                    <CardContent className="pt-6 text-center relative z-10">
                      <motion.div
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mb-4 shadow-lg"
                      >
                        <Users className="h-8 w-8 text-white" />
                      </motion.div>
                      <motion.p
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.8, type: "spring" }}
                        className="text-4xl font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2"
                      >
                        {personalStats.totalGames.toLocaleString()}
                      </motion.p>
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Games Played</p>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Recent Games */}
              <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl">
                <CardHeader className="bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-blue-500/10 border-b border-purple-200/50 dark:border-purple-900/50">
                  <CardTitle className="text-2xl font-bold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
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
                        className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 mb-4"
                      >
                        <Trophy className="h-10 w-10 text-purple-400 dark:text-purple-500" />
                      </motion.div>
                      <p className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No games played yet</p>
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
                              className="group relative overflow-hidden rounded-xl border-2 border-purple-200/50 dark:border-purple-800/50 bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-900/10 dark:to-pink-900/10 hover:border-purple-400 dark:hover:border-purple-600 hover:shadow-lg transition-all duration-300"
                            >
                              <div className="p-5">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                        Game {personalStats.totalGames - index}
                                      </h3>
                                      <Badge variant="outline" className="text-xs border-purple-300 dark:border-purple-700">
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
                                        <span className="text-xs text-muted-foreground">
                                          {new Date(game.completedAt).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right ml-4">
                                    <div className="flex items-baseline gap-1 mb-1">
                                      <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                      <p className="text-2xl font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
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
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transition-all duration-300"
            >
              <Zap className="h-5 w-5 mr-2" />
              Play Again
            </Button>
            <Button
              onClick={() => router.push("/student/dashboard")}
              variant="outline"
              size="lg"
              className="border-2 border-purple-300 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-300"
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
