"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useState, useEffect, useMemo, memo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge as UIBadge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Lightbulb,
  ArrowLeft,
  AlertCircle,
  Trophy,
  Award,
  Flame,
  Target,
  Clock,
  Zap,
  Star,
  Crown,
  Medal,
  Sparkles,
  TrendingUp,
  Calendar,
  Eye,
  Brain,
  Play,
} from "lucide-react"
import { usePreventBack } from "@/hooks/use-prevent-back"
import { usePersistedState, useScrollRestoration } from "@/hooks/use-persisted-state"
import { useToast } from "@/hooks/use-toast"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { initialsFromName } from "@/lib/initials-from-name"
import { getStudentCourseIdFromSession } from "@/lib/student-session-ids"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { StudentHeader } from "@/components/student-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { motion, AnimatePresence } from "framer-motion"
import { PracticeHubFlashcardsSection } from "@/components/student/flashcards/PracticeHubFlashcardsSection"
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts"

interface TopicProgress {
  name: string
  questionCount: number
  completed: number
  correct: number
  accuracy: number
  lastPracticed: string | null
}

interface PracticeConfig {
  numQuestions: number
}

interface LeaderboardEntry {
  rank: number
  student_name?: string
  student_code?: string
  student_id?: number
  section?: string
  total_practice_points?: number
  total_practice_attempts?: number
  current_streak_days?: number
  avg_practice_score?: number
  avg_response_time_ms?: number
  is_current_user?: boolean
}

interface Badge {
  badge_type: string
  badge_name: string
  badge_description: string
  earned_at: string
}

interface RecentSession {
  id?: number
  topic: string
  score: number
  created_at: string
}

export default function PracticeHubPage({ embedded }: { embedded?: boolean }) {
  const router = useRouter()
  const homeHref = "/student/dashboard-v2"
  const { toast } = useToast()
  usePreventBack("/student/login")

  const [studentId, setStudentId] = useState<number | null>(null)
  const [studentName, setStudentName] = useState("")
  const [studentSession, setStudentSession] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const [topics, setTopics] = useState<TopicProgress[]>([])
  
  // Use persisted state for practice preferences
  const [selectedTopic, setSelectedTopic] = usePersistedState<string | null>("student-practice-topic", null)
  const [difficulty, setDifficulty] = usePersistedState<"easy" | "medium" | "hard" | "mixed">("student-practice-difficulty", "mixed")
  const [activeTab, setActiveTab] = usePersistedState("student-practice-tab", "practice")
  
  // Restore scroll position
  useScrollRestoration("student-practice")

  const [practiceConfig, setPracticeConfig] = useState<PracticeConfig>({ numQuestions: 10 })

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [currentStudent, setCurrentStudent] = useState<any>(null)
  const [badges, setBadges] = useState<Badge[]>([])
  const [blurPeerNames, setBlurPeerNames] = useState(false)
  const [showAccuracyOnLeaderboard, setShowAccuracyOnLeaderboard] = useState(true)
  const [showResponseTimeOnLeaderboard, setShowResponseTimeOnLeaderboard] = useState(true)
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])

  // New state variables for analytics and comparison
  const [analytics, setAnalytics] = useState<any>(null)
  const [comparison, setComparison] = useState<any>(null)
  const [practiceStats, setPracticeStats] = useState<any>(null)

  // Animation control flag - only animate when leaderboard tab is active
  const shouldAnimate = activeTab === "leaderboard"

  // Use real leaderboard data only
  const displayLeaderboard = leaderboard

  // Debug: Track tab changes
  useEffect(() => {
    console.log("🔄 [DEBUG] Tab changed to:", activeTab)
    console.log("📊 [DEBUG] Leaderboard entries count:", displayLeaderboard.length)
    console.log("⏱️ [DEBUG] Timestamp:", new Date().toISOString())
  }, [activeTab, displayLeaderboard.length])

  // Memoize the leaderboard entries to prevent re-renders
  const MemoizedLeaderboardList = useMemo(() => {
    console.log("🎨 [DEBUG] MemoizedLeaderboardList being recalculated")
    console.log("📈 [DEBUG] Processing", displayLeaderboard.length, "entries")
    if (displayLeaderboard.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
            <Trophy className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-300 mb-2">No Practice Data Yet</h3>
            <p className="text-slate-400 text-sm">
              Start practicing to see your rank on the leaderboard!
            </p>
          </div>
        </div>
      )
    }

    return displayLeaderboard.map((entry, index) => {
      const isCurrentStudent =
        entry.is_current_user ||
        entry.student_code === studentId?.toString() ||
        entry.student_id === studentId
      const hidePeerDetails = blurPeerNames && !isCurrentStudent
      const isTop3 = entry.rank <= 3
      
      if (index === 0) {
        console.log("🎯 [DEBUG] Rendering first leaderboard entry:", entry.student_name)
      }
      
      return (
        <motion.div
          key={entry.student_code}
          whileHover={shouldAnimate ? { scale: 1.02, y: -2 } : {}}
          transition={{ duration: 0.2 }}
          className={`relative rounded-xl border ${
            isCurrentStudent
              ? "bg-blue-500/20 border-blue-400/50"
              : isTop3
              ? "bg-gray-700/30 border-gray-500/30"
              : "bg-gray-800/20 border-gray-600/30"
          }`}
        >
          
          {/* Rank Badge */}
          <div className={`absolute top-0 left-0 w-full h-1 ${
            entry.rank === 1
              ? "bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500"
              : entry.rank === 2
              ? "bg-gradient-to-r from-gray-300 via-gray-400 to-gray-500"
              : entry.rank === 3
              ? "bg-gradient-to-r from-orange-400 via-orange-500 to-amber-500"
              : "bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"
          }`} />
          
          <div className="p-4 flex items-center gap-4">
            {/* Rank Number with Special Design for Top 3 */}
            <div className={`flex-shrink-0 ${
              entry.rank === 1
                ? "w-16 h-16"
                : entry.rank === 2 || entry.rank === 3
                ? "w-14 h-14"
                : "w-12 h-12"
            }`}>
                  {entry.rank === 1 ? (
                <div className="relative w-16 h-16">
                  <div className="w-full h-full bg-yellow-500 rounded-full flex items-center justify-center">
                    <Crown className="h-8 w-8 text-white" />
                  </div>
                </div>
              ) : entry.rank === 2 ? (
                <div className="w-14 h-14 bg-slate-400 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">{entry.rank}</span>
                </div>
              ) : entry.rank === 3 ? (
                <div className="w-14 h-14 bg-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">{entry.rank}</span>
                </div>
              ) : (
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                  isCurrentStudent
                    ? "bg-purple-500 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}>
                  {entry.rank}
                </div>
              )}
            </div>

            {/* Student Info */}
            <div className={`flex-1 min-w-0 ${hidePeerDetails ? "blur-[6px] select-none pointer-events-none" : ""}`}>
              <div className="flex items-center gap-2 mb-1">
                <h3 className={`font-bold truncate ${
                  isTop3 ? "text-xl" : "text-lg"
                } ${
                  isCurrentStudent 
                    ? "text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" 
                    : "text-white/60"
                }`}>
                  {isCurrentStudent ? (entry.student_name || "You") : hidePeerDetails ? "Student" : (entry.student_name || "Student")}
                  {isCurrentStudent && (
                    <span className="ml-2 text-sm font-normal text-purple-300">(You 🎯)</span>
                  )}
                </h3>
                {isTop3 && shouldAnimate && (
                  <motion.div
                    animate={{ rotate: [0, 10, 0, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-2xl"
                  >
                    {entry.rank === 1 ? "👑" : entry.rank === 2 ? "🥈" : "🥉"}
                  </motion.div>
                )}
                {isTop3 && !shouldAnimate && (
                  <div className="text-2xl">
                    {entry.rank === 1 ? "👑" : entry.rank === 2 ? "🥈" : "🥉"}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 text-sm">
                {isCurrentStudent ? (
                <>
                <span className="text-purple-200 font-semibold px-2 py-1 bg-purple-700/30 rounded-md">
                  {entry.section}
                </span>
                <span className="text-white/40">•</span>
                <span className="text-white/70">{entry.total_practice_attempts} sessions</span>
                    {(entry.current_streak_days ?? 0) > 0 && (
                      <>
                        <span className="text-white/40">•</span>
                        <motion.div
                          animate={shouldAnimate ? { scale: [1, 1.08, 1] } : {}}
                          transition={shouldAnimate ? { duration: 1.5, repeat: Infinity } : {}}
                          className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-full shadow-lg shadow-orange-500/30"
                        >
                          <Flame className="h-4 w-4 text-white" />
                          <span className="text-sm font-bold text-white">
                            {entry.current_streak_days} 🔥
                          </span>
                        </motion.div>
                      </>
                    )}
                </>
                ) : hidePeerDetails ? (
                  <span className="text-white/50">Details hidden</span>
                ) : (
                  <>
                    <span className="text-purple-200 font-semibold px-2 py-1 bg-purple-700/30 rounded-md">
                      {entry.section}
                    </span>
                    <span className="text-white/40">•</span>
                    <span className="text-white/70">{entry.total_practice_attempts} sessions</span>
                    {(entry.current_streak_days ?? 0) > 0 && (
                      <>
                        <span className="text-white/40">•</span>
                        <span className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-full text-sm font-bold text-white">
                          <Flame className="h-4 w-4" />
                          {entry.current_streak_days} 🔥
                        </span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className={`flex items-center gap-6 ${hidePeerDetails ? "blur-[6px] select-none pointer-events-none" : ""}`}>
               {isCurrentStudent || !hidePeerDetails ? (
               <>
               {/* Points */}
               <div className="text-center px-3 py-2 bg-gray-800/30 rounded-lg backdrop-blur-sm">
                 <div className={`font-bold ${
                   isTop3 ? "text-3xl" : "text-2xl"
                 } ${
                   entry.rank === 1
                     ? "text-yellow-400"
                     : entry.rank === 2
                     ? "text-gray-300"
                     : entry.rank === 3
                     ? "text-orange-400"
                     : "text-blue-300"
                 }`}>
                   {(entry.total_practice_points ?? 0).toLocaleString()}
                 </div>
                 <div className="text-xs text-white/60 font-semibold uppercase tracking-wider mt-1">
                   XP
                 </div>
               </div>

               {/* Response Time */}
               {showResponseTimeOnLeaderboard && entry.avg_response_time_ms && entry.avg_response_time_ms > 0 && (
                 <div className="text-center px-3 py-2 bg-gray-800/30 rounded-lg backdrop-blur-sm">
                   <div className={`font-bold ${
                     isTop3 ? "text-3xl" : "text-2xl"
                   } ${
                     entry.avg_response_time_ms < 5000
                       ? "text-green-400"
                       : entry.avg_response_time_ms < 10000
                       ? "text-blue-400"
                       : entry.avg_response_time_ms < 20000
                       ? "text-yellow-400"
                       : "text-orange-400"
                   }`}>
                     {(entry.avg_response_time_ms / 1000).toFixed(1)}s
                   </div>
                   <div className="text-xs text-white/60 font-semibold uppercase tracking-wider mt-1">
                     avg
                   </div>
                 </div>
               )}
 
               {/* Average Score with circular progress */}
               {showAccuracyOnLeaderboard && (
               <div className="relative">
                {entry.avg_practice_score >= 90 && (
                  <div className="absolute -top-2 -left-2 z-10 pointer-events-none">
                    {shouldAnimate ? (
                      <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 2.5, repeat: Infinity }}>
                        <UIBadge className="bg-green-600 text-white border-0 px-3 py-1.5">
                          <Star className="h-4 w-4 mr-1" />
                          Master
                        </UIBadge>
                      </motion.div>
                    ) : (
                      <UIBadge className="bg-green-600 text-white border-0 px-3 py-1.5">
                        <Star className="h-4 w-4 mr-1" />
                        Master
                      </UIBadge>
                    )}
                  </div>
                )}
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="24"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="4"
                    fill="none"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="24"
                    stroke={
                      entry.avg_practice_score >= 90
                        ? "#10b981"
                        : entry.avg_practice_score >= 80
                        ? "#3b82f6"
                        : entry.avg_practice_score >= 70
                        ? "#eab308"
                        : "#f97316"
                    }
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                    strokeDashoffset={151 - (151 * entry.avg_practice_score) / 100}
                    strokeDasharray="151"
                    className="drop-shadow-[0_0_8px_currentColor]"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center mt-0.5">
                    <motion.div className={`${
                      isTop3 ? "text-lg" : "text-base"
                    } ${
                      entry.avg_practice_score >= 90
                        ? "text-green-400"
                        : entry.avg_practice_score >= 80
                        ? "text-blue-400"
                        : entry.avg_practice_score >= 70
                        ? "text-yellow-400"
                        : "text-orange-400"
                    } font-bold`}
                      animate={shouldAnimate ? { scale: [1, 1.08, 1] } : {}}
                      transition={shouldAnimate ? { duration: 2, repeat: Infinity } : {}}
                    >
                      {Number(entry.avg_practice_score || 0).toFixed(0)}
                    </motion.div>
                    <div className="text-[9px] text-white/50 font-semibold">%</div>
                  </div>
                </div>
              </div>
               )}
               </>
               ) : (
                 <div className="text-white/40 text-sm">•••</div>
               )}
            </div>
            
          </div>

          {/* Glowing Progress Bar based on XP */}
          {displayLeaderboard[0] && isCurrentStudent && (
            <div className="px-4 pb-3">
              <div className="relative h-3 bg-white/5 rounded-full overflow-hidden border border-white/10">
                <div
                  style={{ width: `${((entry.total_practice_points ?? 0) / (displayLeaderboard[0].total_practice_points || 1)) * 100}%` }}
                  className={`h-full relative ${
                    entry.rank === 1
                      ? "bg-yellow-500"
                      : entry.rank === 2
                      ? "bg-slate-400"
                      : entry.rank === 3
                      ? "bg-orange-500"
                      : isCurrentStudent
                      ? "bg-purple-500"
                      : "bg-blue-400"
                  }`}
                />
              </div>
            </div>
          )}
        </motion.div>
      )
    })
  }, [displayLeaderboard, studentId, shouldAnimate, blurPeerNames, showAccuracyOnLeaderboard, showResponseTimeOnLeaderboard])

  useEffect(() => {
    const studentData = getStudentData()
    if (!studentData || !studentData.databaseId) {
      router.push("/student/login")
      return
    }

    setStudentId(Number.parseInt(studentData.databaseId))
    setStudentName(studentData.name)
    setStudentSession(studentData.section || "")

    const courseId = getStudentCourseIdFromSession()

    fetchTopicsWithProgress(Number.parseInt(studentData.databaseId), studentData.section, courseId)
    fetchPracticeConfig(studentData.section)
    fetchLeaderboard(Number.parseInt(studentData.databaseId), studentData.section, courseId)
    fetchRecentSessions(Number.parseInt(studentData.databaseId))
    fetchAnalytics(Number.parseInt(studentData.databaseId))
    fetchComparison(Number.parseInt(studentData.databaseId), studentData.section)
    fetchPracticeStats(Number.parseInt(studentData.databaseId))
  }, [router])

  const fetchTopicsWithProgress = async (
    studentDbId: number,
    session: string,
    courseId: number | null,
  ) => {
    try {
      const courseQs = courseId != null ? `&courseId=${courseId}` : ""
      const response = await fetch(
        `/api/practice/topics-progress?studentId=${studentDbId}&session=${encodeURIComponent(session)}${courseQs}`,
      )
      const data = await response.json()
      if (response.ok) {
        setTopics(data.topics || [])
      }
    } catch (error) {
      console.error("[v0] Failed to fetch topics:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPracticeConfig = async (session: string) => {
    try {
      const response = await instructorApiFetch(`/api/practice/config?session=${session}`)
      const data = await response.json()
      if (response.ok) {
        setPracticeConfig(data)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch practice config:", error)
    }
  }

  const fetchLeaderboard = async (
    studentDbId: number,
    session: string,
    courseId: number | null,
  ) => {
    console.log("🔍 [DEBUG] fetchLeaderboard called for student:", studentDbId, "session:", session)
    const startTime = performance.now()
    try {
      const courseQs = courseId != null ? `&courseId=${courseId}` : ""
      const response = await fetch(
        `/api/practice/leaderboard?studentId=${studentDbId}&session=${encodeURIComponent(session)}&limit=100${courseQs}`,
      )
      const data = await response.json()
      const fetchTime = performance.now() - startTime
      console.log("✅ [DEBUG] Leaderboard fetch completed in", fetchTime.toFixed(2), "ms")
      console.log("📊 [DEBUG] Leaderboard data:", data.leaderboard?.length || 0, "entries for session:", session)
      if (response.ok) {
        setLeaderboard(data.leaderboard || [])
        setCurrentStudent(data.currentStudent)
        setBadges(data.badges || [])
        setBlurPeerNames(data.leaderboardPrivacy?.blurPeerNames ?? data.privacyMode ?? false)
        setShowAccuracyOnLeaderboard(data.leaderboardDisplay?.showAccuracy ?? true)
        setShowResponseTimeOnLeaderboard(data.leaderboardDisplay?.showResponseTime ?? true)
        console.log("💾 [DEBUG] Leaderboard state updated with", data.leaderboard?.length || 0, "students")
      }
    } catch (error) {
      console.error("[v0] Failed to fetch leaderboard:", error)
    }
  }

  const fetchRecentSessions = async (studentDbId: number) => {
    try {
      const response = await instructorApiFetch(`/api/practice/recent-sessions?studentId=${studentDbId}&limit=5`)
      const data = await response.json()
      if (response.ok) {
        setRecentSessions(data.sessions || [])
      }
    } catch (error) {
      console.error("[v0] Failed to fetch recent sessions:", error)
    }
  }

  // New fetch functions for analytics and comparison
  const fetchAnalytics = async (studentDbId: number) => {
    console.log("📈 [DEBUG] fetchAnalytics called")
    const startTime = performance.now()
    try {
      const response = await instructorApiFetch(`/api/practice/analytics?studentId=${studentDbId}`)
      const data = await response.json()
      const fetchTime = performance.now() - startTime
      console.log("✅ [DEBUG] Analytics fetch completed in", fetchTime.toFixed(2), "ms")
      if (response.ok) {
        setAnalytics(data)
        console.log("💾 [DEBUG] Analytics state updated")
      }
    } catch (error) {
      console.error("[v0] Failed to fetch analytics:", error)
    }
  }

  const fetchComparison = async (studentDbId: number, session: string) => {
    try {
      const response = await instructorApiFetch(`/api/practice/comparison?studentId=${studentDbId}&session=${session}`)
      const data = await response.json()
      if (response.ok) {
        setComparison(data)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch comparison:", error)
    }
  }

  const fetchPracticeStats = async (studentDbId: number) => {
    try {
      const response = await studentApiFetch("/api/student/practice/stats", {
        headers: {
          "x-student-id": studentDbId.toString()
        }
      })
      if (response.ok) {
        const data = await response.json()
        setPracticeStats(data.stats)
      }
    } catch (error) {
      console.error("Failed to fetch practice stats:", error)
    }
  }

  const handleStartPractice = async () => {
    if (!selectedTopic) {
      toast({
        title: "No topic selected",
        description: "Please select a topic to practice.",
        variant: "destructive",
      })
      return
    }

    // Check if there are new questions available
    const selectedTopicData = topics.find(t => t.name === selectedTopic)
    if (selectedTopicData && selectedTopicData.completed >= selectedTopicData.questionCount) {
      toast({
        title: "No New Questions Available",
        description: `You've already practiced all ${selectedTopicData.questionCount} questions in ${selectedTopic}. Try a different topic or difficulty level.`,
        variant: "destructive",
      })
      return
    }

    setGenerating(true)

    try {
      const response = await instructorApiFetch("/api/practice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          topics: [selectedTopic],
          count: practiceConfig.numQuestions,
          difficulty: difficulty === "mixed" ? undefined : difficulty,
          courseId: getStudentCourseIdFromSession(),
        }),
      })

      const data = await response.json()

      if (response.ok) {
        sessionStorage.setItem("practiceAttemptId", data.attemptId.toString())
        sessionStorage.setItem("practiceQuestions", JSON.stringify(data.questions))
        router.push("/student/practice/quiz")
      } else {
        toast({
          title: "Failed to generate practice",
          description: data.error || "Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[v0] Error generating practice:", error)
      toast({
        title: "Error",
        description: "Failed to generate practice quiz.",
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        {!embedded && <StudentHeader />}
        <main className="container mx-auto px-4 py-12 text-center">
          <div className="text-slate-600 dark:text-slate-400 animate-pulse">Loading practice hub...</div>
        </main>
      </div>
    )
  }

  const selectedTopicData = topics.find((t) => t.name === selectedTopic)

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {!embedded && <StudentHeader />}

      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 max-w-7xl">
        <div className="mb-6 sm:mb-8 relative">
          {/* Title Row */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="p-2 sm:p-2.5 md:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-600 to-purple-800 dark:from-purple-700 dark:to-purple-900 shadow-lg flex-shrink-0">
              <Lightbulb className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-purple-800 dark:from-purple-400 dark:to-purple-600 bg-clip-text text-transparent">
                Practice Hub
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground dark:text-slate-400 mt-0.5 sm:mt-1">Master your skills with personalized practice</p>
              {studentSession && (
                <UIBadge variant="outline" className="mt-1.5 sm:mt-2 text-xs border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
                  Session: {studentSession}
                </UIBadge>
              )}
            </div>
          </div>

          {/* Back Button - Floating to the right on mobile, full button on desktop */}
          <Button 
            onClick={() => router.push(homeHref)} 
            variant="outline" 
            size="sm"
            className="absolute top-0 right-0 sm:hidden h-9 px-3 rounded-lg border-2 border-purple-200/60 dark:border-purple-700/60 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-900/30 dark:hover:to-pink-900/30 hover:border-purple-400 dark:hover:border-purple-500 text-purple-700 dark:text-purple-300 shadow-md hover:shadow-lg transition-all duration-200 gap-1.5"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-medium">Back</span>
          </Button>
          
          <Button 
            onClick={() => router.push(homeHref)} 
            variant="outline" 
            size="lg"
            className="hidden sm:flex absolute top-0 right-0 rounded-xl border-2 border-purple-200/60 dark:border-purple-700/60 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-900/30 dark:hover:to-pink-900/30 hover:border-purple-400 dark:hover:border-purple-500 text-purple-700 dark:text-purple-300 transition-all duration-200 shadow-sm hover:shadow-md text-sm md:text-base px-3 md:px-4 shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <Tabs 
          defaultValue="practice" 
          value={activeTab} 
          onValueChange={(newTab) => {
            console.log("🔄 [DEBUG] Switching from", activeTab, "to", newTab)
            const startTime = performance.now()
            setActiveTab(newTab)
            requestAnimationFrame(() => {
              const switchTime = performance.now() - startTime
              console.log("⏱️ [DEBUG] Tab switch took", switchTime.toFixed(2), "ms")
            })
          }} 
          className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-2 border-slate-200/60 dark:border-slate-700/60 shadow-xl rounded-xl sm:rounded-2xl p-1 sm:p-2 h-11 sm:h-12 md:h-14">
            <TabsTrigger 
              value="practice" 
              className="rounded-lg sm:rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:via-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/30 dark:data-[state=active]:shadow-purple-900/50 transition-all duration-300 text-xs sm:text-sm md:text-base font-semibold px-2 sm:px-3"
            >
              <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 mr-1 sm:mr-1.5 md:mr-2 shrink-0" />
              <span>Practice</span>
            </TabsTrigger>
            <TabsTrigger 
              value="leaderboard" 
              className="rounded-lg sm:rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:via-yellow-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-amber-500/30 dark:data-[state=active]:shadow-amber-900/50 transition-all duration-300 text-xs sm:text-sm md:text-base font-semibold px-2 sm:px-3"
            >
              <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 mr-1 sm:mr-1.5 md:mr-2 shrink-0" />
              <span>Leaderboard</span>
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            {activeTab === "practice" && (
          <TabsContent value="practice" className="space-y-6" forceMount>
            {currentStudent && (
              <Card className="border-purple-200 dark:border-purple-700/50 bg-gradient-to-br from-purple-50 to-transparent dark:from-purple-900/20 dark:to-transparent shadow-sm">
                <CardHeader className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                        <div className="min-w-0 flex-1">
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg dark:text-slate-200">
                        <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400 shrink-0" />
                        <span>Your Progress</span>
                          </CardTitle>
                      <CardDescription className="text-xs sm:text-sm dark:text-slate-400 mt-1">
                        Rank #{currentStudent.rank} in {studentSession}
                          </CardDescription>
                      </div>
                      {currentStudent.current_streak_days > 0 && (
                      <UIBadge className="bg-orange-500 dark:bg-orange-600 gap-1 text-white px-2 py-1 text-xs">
                        <Flame className="h-3 w-3 shrink-0" />
                        {currentStudent.current_streak_days} day streak
                      </UIBadge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div className="text-center p-2 sm:p-3 rounded-lg bg-purple-50/50 dark:bg-purple-900/20 border border-purple-200/50 dark:border-purple-700/50">
                      <div className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">{currentStudent.total_practice_points}</div>
                      <div className="text-xs text-muted-foreground dark:text-slate-400 mt-1">Points</div>
                      </div>
                    <div className="text-center p-2 sm:p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-700/50">
                      <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{currentStudent.total_practice_attempts}</div>
                      <div className="text-xs text-muted-foreground dark:text-slate-400 mt-1">Sessions</div>
                      </div>
                    <div className="text-center p-2 sm:p-3 rounded-lg bg-green-50/50 dark:bg-green-900/20 border border-green-200/50 dark:border-green-700/50">
                      <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">{Number(currentStudent.avg_practice_score || 0).toFixed(0)}%</div>
                      <div className="text-xs text-muted-foreground dark:text-slate-400 mt-1">Avg Score</div>
                      </div>
                    <div className="text-center p-2 sm:p-3 rounded-lg bg-amber-50/50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-700/50">
                      <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">{badges.length}</div>
                      <div className="text-xs text-muted-foreground dark:text-slate-400 mt-1">Badges</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {topics.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Topics Available</AlertTitle>
                <AlertDescription>
                  There are currently no practice topics available for your session. Please check back later.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
              <div className="lg:col-span-2 space-y-4 sm:space-y-5 md:space-y-6">
                <Card className="shadow-sm dark:bg-slate-800 dark:border-slate-700">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-base sm:text-lg dark:text-slate-200">Select a Topic</CardTitle>
                    <CardDescription className="text-xs sm:text-sm dark:text-slate-400">Choose one topic to practice</CardDescription>
                    </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-h-[500px] sm:max-h-[600px] overflow-y-auto pr-2">
                      {topics.map((topic) => (
                            <Card
                          key={topic.name}
                          className={`cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] ${
                                selectedTopic === topic.name
                              ? "border-purple-600 dark:border-purple-500 bg-purple-50 dark:bg-purple-900/30 shadow-md"
                              : topic.completed >= topic.questionCount
                                ? "border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-900/20 opacity-75"
                                : "border-border dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-600 dark:bg-slate-800/50"
                              }`}
                              onClick={() => setSelectedTopic(topic.name)}
                            >
                          <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-4">
                            <CardTitle className="text-sm sm:text-base flex items-center justify-between gap-2 dark:text-slate-200">
                                  <span className="truncate">{topic.name}</span>
                                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                    {topic.completed >= topic.questionCount && (
                                      <UIBadge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700">
                                        Complete
                                      </UIBadge>
                                    )}
                                  {selectedTopic === topic.name && (
                                      <Star className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400 fill-purple-600 dark:fill-purple-400" />
                                    )}
                                  </div>
                                </CardTitle>
                            <CardDescription className="text-xs dark:text-slate-400 mt-1">
                                  {topic.questionCount} total • {topic.questionCount - topic.completed} new questions available
                                </CardDescription>
                              </CardHeader>
                          <CardContent className="space-y-2 sm:space-y-3 p-3 sm:p-4 pt-0">
                                  <div className="flex items-center justify-between text-xs sm:text-sm">
                              <span className="text-muted-foreground dark:text-slate-400">Progress</span>
                              <span className="font-semibold dark:text-slate-200">
                                      {topic.completed}/{topic.questionCount}
                                    </span>
                                  </div>
                            <Progress value={(topic.completed / topic.questionCount) * 100} className="h-1.5 sm:h-2" />
                                <div className="flex items-center justify-between text-xs sm:text-sm">
                              <span className="text-muted-foreground dark:text-slate-400">Accuracy</span>
                                  <span
                                className={`font-semibold ${
                                      topic.accuracy >= 80
                                    ? "text-green-600 dark:text-green-400"
                                        : topic.accuracy >= 60
                                      ? "text-yellow-600 dark:text-yellow-400"
                                      : "text-red-600 dark:text-red-400"
                                    }`}
                                  >
                                    {topic.accuracy.toFixed(0)}%
                                  </span>
                                </div>
                                {topic.lastPracticed && (
                              <div className="text-xs text-muted-foreground dark:text-slate-500">
                                    Last practiced: {new Date(topic.lastPracticed).toLocaleDateString()}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
              </div>

              <div className="space-y-4 sm:space-y-5 md:space-y-6">
                <Card className="border-purple-200 dark:border-purple-700/50 bg-gradient-to-br from-purple-50 to-transparent dark:from-purple-900/20 dark:to-transparent shadow-lg sticky top-4">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg dark:text-slate-200">
                      <Target className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400 shrink-0" />
                      <span>Practice Summary</span>
                          </CardTitle>
                    <CardDescription className="text-xs sm:text-sm dark:text-slate-400">
                      {selectedTopic ? `Ready to practice ${selectedTopic}` : "Select a topic to begin"}
                          </CardDescription>
                    </CardHeader>
                  <CardContent className="space-y-4 sm:space-y-5 md:space-y-6 p-4 sm:p-6 pt-0">
                      {selectedTopicData && (
                      <div className="space-y-4">
                          <div className="flex items-center justify-center">
                          <div className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32">
                              <svg className="w-full h-full transform -rotate-90">
                                <circle
                                cx="64"
                                cy="64"
                                r="56"
                                  stroke="currentColor"
                                  strokeWidth="8"
                                  fill="none"
                                className="text-gray-200 dark:text-slate-700"
                                />
                                <circle
                                cx="64"
                                cy="64"
                                r="56"
                                stroke="currentColor"
                                  strokeWidth="8"
                                  fill="none"
                                strokeDasharray={`${2 * Math.PI * 56}`}
                                strokeDashoffset={`${2 * Math.PI * 56 * (1 - selectedTopicData.completed / selectedTopicData.questionCount)}`}
                                className="text-purple-600 dark:text-purple-400 transition-all duration-500"
                                />
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <div className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">
                                  {((selectedTopicData.completed / selectedTopicData.questionCount) * 100).toFixed(0)}%
                                </div>
                              <div className="text-xs text-muted-foreground dark:text-slate-400">Complete</div>
                              </div>
                            </div>
                          </div>

                        <div className="space-y-2 sm:space-y-3 pt-3 sm:pt-4 border-t border-slate-200 dark:border-slate-700">
                          <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm text-muted-foreground dark:text-slate-400">Topic</span>
                            <span className="font-semibold text-xs sm:text-sm dark:text-slate-200 truncate ml-2">{selectedTopicData.name}</span>
                              </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm text-muted-foreground dark:text-slate-400">Questions</span>
                            <span className="font-semibold text-xs sm:text-sm dark:text-slate-200">{practiceConfig.numQuestions}</span>
                              </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm text-muted-foreground dark:text-slate-400">Accuracy</span>
                            <span className="font-semibold text-xs sm:text-sm dark:text-slate-200">{selectedTopicData.accuracy.toFixed(0)}%</span>
                            </div>
                            </div>
                          </div>
                    )}

                    <div className="space-y-2 sm:space-y-3 pt-3 sm:pt-4 border-t border-slate-200 dark:border-slate-700">
                      <Label className="text-xs sm:text-sm font-semibold dark:text-slate-300">Difficulty Level</Label>
                      <RadioGroup value={difficulty} onValueChange={(v: any) => setDifficulty(v)}>
                        <div className="grid grid-cols-2 gap-2">
                            {(["easy", "medium", "hard", "mixed"] as const).map((level) => (
                            <div key={level} className="flex items-center space-x-1.5 sm:space-x-2">
                              <RadioGroupItem value={level} id={level} className="dark:border-slate-600" />
                              <Label htmlFor={level} className="capitalize cursor-pointer text-xs sm:text-sm dark:text-slate-300">
                                {level}
                                </Label>
                            </div>
                            ))}
                        </div>
                          </RadioGroup>
                        </div>

                          <Button
                            onClick={handleStartPractice}
                            disabled={generating || !selectedTopic}
                      className="w-full bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 dark:from-purple-700 dark:to-purple-800 dark:hover:from-purple-800 dark:hover:to-purple-900 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 text-sm sm:text-base h-11 sm:h-12"
                            size="lg"
                          >
                            {generating ? (
                              <>
                          <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 animate-pulse" />
                          <span className="hidden sm:inline">Generating...</span>
                          <span className="sm:hidden">Generate</span>
                              </>
                            ) : (
                              <>
                          <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                          Start Practice
                              </>
                            )}
                          </Button>
                    </CardContent>
                  </Card>

                <Card className="shadow-sm dark:bg-slate-800 dark:border-slate-700">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2 dark:text-slate-200">
                      <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400 shrink-0" />
                      Recent Sessions
                    </CardTitle>
                    </CardHeader>
                  <CardContent className="space-y-3 p-4 sm:p-6 pt-0">
                      {recentSessions.length === 0 ? (
                      <p className="text-xs sm:text-sm text-muted-foreground dark:text-slate-400 text-center py-4">No practice sessions yet</p>
                      ) : (
                        <>
                            {recentSessions.map((session, index) => (
                          <div key={index} className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-muted/50 dark:bg-slate-700/50 hover:bg-muted dark:hover:bg-slate-700 transition-colors gap-2 sm:gap-3">
                                <div className="flex-1 min-w-0">
                              <div className="text-xs sm:text-sm font-medium dark:text-slate-200 truncate">{session.topic}</div>
                              <div className="text-xs text-muted-foreground dark:text-slate-400">
                                    {new Date(session.created_at).toLocaleDateString()}
                                  </div>
                                </div>
                            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                <div
                              className={`text-xs sm:text-sm font-bold ${
                                    Number(session.score) >= 80
                                  ? "text-green-600 dark:text-green-400"
                                      : Number(session.score) >= 60
                                    ? "text-yellow-600 dark:text-yellow-400"
                                    : "text-red-600 dark:text-red-400"
                                  }`}
                                >
                                  {Number(session.score || 0).toFixed(0)}%
                                </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/student/practice/results/${session.id}`)}
                                className="h-7 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm dark:text-slate-300 dark:hover:bg-slate-700"
                              >
                                <Eye className="h-3 w-3 mr-1 shrink-0" />
                                <span className="hidden sm:inline">View</span>
                                <span className="sm:hidden">View</span>
                              </Button>
                            </div>
                          </div>
                        ))}
                          <Button
                            variant="outline"
                          className="w-full rounded-full bg-transparent dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 text-xs sm:text-sm h-9 sm:h-10"
                            onClick={() => router.push("/student/practice/history")}
                          >
                            View All Sessions
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>

                <PracticeHubFlashcardsSection variant="legacy" />
              </div>
            </div>
          </TabsContent>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {activeTab === "leaderboard" && (
          <TabsContent value="leaderboard" className="space-y-6" forceMount>
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left Panel: Analytics & Personal Performance */}
              <div className="lg:col-span-1 space-y-6">
                {/* Profile Header Card */}
                {currentStudent && (
                  <div>
                    <Card
                      className={`border-2 ${
                        currentStudent.rank === 1
                          ? "border-yellow-400 bg-yellow-50"
                          : currentStudent.rank === 2
                            ? "border-gray-300 bg-gray-50"
                            : currentStudent.rank === 3
                              ? "border-orange-400 bg-orange-50"
                              : "border-purple-200 bg-purple-50"
                      }`}
                    >
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${
                              currentStudent.rank === 1
                                ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white shadow-lg"
                                : currentStudent.rank === 2
                                  ? "bg-gradient-to-br from-gray-300 to-gray-500 text-white shadow-lg"
                                  : currentStudent.rank === 3
                                    ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg"
                                    : "bg-gradient-to-br from-purple-500 to-purple-700 text-white"
                            }`}
                          >
                            {initialsFromName(studentName, "ST")}
                          </div>
                          <div className="flex-1">
                            <CardTitle className="text-lg">{studentName}</CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-1">
                              <span>{studentSession}</span>
                              {currentStudent.rank <= 3 && shouldAnimate && (
                                <motion.div
                                  animate={{ scale: [1, 1.15, 1] }}
                                  transition={{ duration: 2, repeat: Infinity }}
                                >
                                  {currentStudent.rank === 1 && <Crown className="h-4 w-4 text-yellow-500" />}
                                  {currentStudent.rank === 2 && <Medal className="h-4 w-4 text-gray-400" />}
                                  {currentStudent.rank === 3 && <Medal className="h-4 w-4 text-orange-600" />}
                                </motion.div>
                              )}
                              {currentStudent.rank <= 3 && !shouldAnimate && (
                                <>
                                  {currentStudent.rank === 1 && <Crown className="h-4 w-4 text-yellow-500" />}
                                  {currentStudent.rank === 2 && <Medal className="h-4 w-4 text-gray-400" />}
                                  {currentStudent.rank === 3 && <Medal className="h-4 w-4 text-orange-600" />}
                                </>
                              )}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="mt-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Rank #{currentStudent.rank}</span>
                            {currentStudent.current_streak_days > 0 && (
                              <UIBadge className="bg-orange-500 gap-1">
                                <Flame className="h-3 w-3" />
                                {currentStudent.current_streak_days} day streak
                              </UIBadge>
                            )}
                          </div>
                          {analytics?.xpInfo && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Level {analytics.xpInfo.current_level}</span>
                                <span className="font-semibold">
                                  {analytics.xpInfo.level_progress} / {analytics.xpInfo.xp_to_next_level} XP
                                </span>
                              </div>
                              <Progress
                                value={(analytics.xpInfo.level_progress / analytics.xpInfo.xp_to_next_level) * 100}
                                className="h-2"
                              />
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-3 rounded-lg bg-white/50 backdrop-blur-sm">
                            <div className="text-2xl font-bold text-purple-600">
                              {currentStudent.total_practice_points}
                            </div>
                            <div className="text-xs text-muted-foreground">XP Points</div>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-white/50 backdrop-blur-sm">
                            <div className="text-2xl font-bold">{currentStudent.total_practice_attempts}</div>
                            <div className="text-xs text-muted-foreground">Sessions</div>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-white/50 backdrop-blur-sm">
                            <div className="text-2xl font-bold">{Number(currentStudent.avg_practice_score || 0).toFixed(0)}%</div>
                            <div className="text-xs text-muted-foreground">Avg Score</div>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-white/50 backdrop-blur-sm">
                            <div className="text-2xl font-bold">{badges.length}</div>
                            <div className="text-xs text-muted-foreground">Badges</div>
                          </div>
                        </div>
                        
                        {/* Response Time Card - Creative Design */}
                        {currentStudent.avg_response_time_ms && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="mt-4 p-4 rounded-xl bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50 dark:from-cyan-900/20 dark:via-blue-900/20 dark:to-indigo-900/20 border-2 border-cyan-200 dark:border-cyan-700/50 relative overflow-hidden"
                          >
                            {/* Animated background circles */}
                            <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-200/30 dark:bg-cyan-600/10 rounded-full blur-2xl" />
                            <div className="absolute bottom-0 left-0 w-16 h-16 bg-blue-200/30 dark:bg-blue-600/10 rounded-full blur-xl" />
                            
                            <div className="relative flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <motion.div
                                  animate={{ rotate: [0, 360] }}
                                  transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                                  className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 dark:from-cyan-500 dark:to-blue-600 flex items-center justify-center shadow-lg"
                                >
                                  <Clock className="h-6 w-6 text-white" />
                                </motion.div>
                                <div>
                                  <div className="text-sm font-semibold text-cyan-900 dark:text-cyan-100">Avg Response Time</div>
                                  <div className="text-xs text-cyan-700 dark:text-cyan-300">Speed matters in practice!</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-400 dark:to-blue-400 bg-clip-text text-transparent">
                                  {(currentStudent.avg_response_time_ms / 1000).toFixed(1)}s
                                </div>
                                <div className="text-xs text-cyan-600 dark:text-cyan-400 font-medium">
                                  {currentStudent.avg_response_time_ms < 5000 ? "⚡ Lightning!" : 
                                   currentStudent.avg_response_time_ms < 10000 ? "🚀 Quick" : 
                                   currentStudent.avg_response_time_ms < 20000 ? "💭 Thoughtful" : "🧠 Careful"}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Practice Insights Card */}
                <div>
                  <Card className="shadow-sm dark:bg-gray-800 dark:border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2 dark:text-white">
                        <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        Practice Insights
                      </CardTitle>
                      <CardDescription className="dark:text-gray-400">
                        Your learning journey and progress
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 dark:text-gray-200">
                      {/* Quick Stats Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-700">
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {currentStudent?.total_practice_attempts || 0}
                          </div>
                          <div className="text-xs text-blue-700 dark:text-blue-300">Practice Sessions</div>
                        </div>
                        <div className="p-3 rounded-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-700">
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {Number(currentStudent?.avg_practice_score || 0).toFixed(0)}%
                          </div>
                          <div className="text-xs text-green-700 dark:text-green-300">Average Score</div>
                        </div>
                        <div className="p-3 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border border-purple-200 dark:border-purple-700">
                          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {currentStudent?.current_streak_days || 0}
                          </div>
                          <div className="text-xs text-purple-700 dark:text-purple-300">Day Streak</div>
                        </div>
                        <div className="p-3 rounded-lg bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border border-orange-200 dark:border-orange-700">
                          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                            {topics?.length || 0}
                          </div>
                          <div className="text-xs text-orange-700 dark:text-orange-300">Topics Studied</div>
                        </div>
                      </div>

                      {/* Motivational Message */}
                      <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-700">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-800">
                            <Lightbulb className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm text-purple-900 dark:text-purple-100 mb-1">
                              Learning Tip
                            </h4>
                            <p className="text-xs text-purple-700 dark:text-purple-300">
                              {currentStudent?.total_practice_attempts === 0 
                                ? "Start your first practice session to begin tracking your progress! 🚀"
                                : currentStudent?.avg_practice_score && Number(currentStudent.avg_practice_score) >= 80
                                ? "Excellent work! You're mastering the material. Try more challenging topics! 🎯"
                                : currentStudent?.avg_practice_score && Number(currentStudent.avg_practice_score) >= 60
                                ? "Good progress! Focus on reviewing incorrect answers to improve further. 💪"
                                : "Keep practicing! Every session helps you learn and improve. 📚"
                              }
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Topic Progress Summary */}
                      {topics && topics.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-3 dark:text-gray-300">Topic Progress</h4>
                          <div className="space-y-2">
                            {topics.slice(0, 3).map((topic, index) => (
                              <div key={topic.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 dark:bg-gray-700/30">
                                <div className="flex-1">
                                  <div className="text-sm font-medium truncate">{topic.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {topic.completed || 0} questions completed
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`text-sm font-bold ${
                                    Number(topic.accuracy || 0) >= 80 ? 'text-green-600 dark:text-green-400' :
                                    Number(topic.accuracy || 0) >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                                    'text-red-600 dark:text-red-400'
                                  }`}>
                                    {Number(topic.accuracy || 0).toFixed(0)}%
                                  </div>
                                </div>
                              </div>
                            ))}
                            {topics.length > 3 && (
                              <div className="text-xs text-muted-foreground text-center py-2">
                                +{topics.length - 3} more topics
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Call to Action */}
                      <div className="pt-2">
                        <Button 
                          onClick={() => setActiveTab("practice")} 
                          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Start New Practice
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Badge Showcase */}
                {badges.length > 0 && (
                  <div>
                    <Card className="shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Award className="h-4 w-4 text-purple-500" />
                          Badge Collection
                        </CardTitle>
                        <CardDescription>Achievements you've unlocked</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-3">
                          {badges.map((badge, index) => (
                            <div
                              key={index}
                              className="flex flex-col items-center p-3 rounded-lg border bg-gradient-to-br from-white to-gray-50 text-center hover:shadow-md transition-shadow"
                            >
                              <Award
                                className={`h-8 w-8 mb-2 ${
                                  badge.badge_type === "milestone"
                                    ? "text-blue-500"
                                    : badge.badge_type === "streak"
                                      ? "text-orange-500"
                                      : badge.badge_type === "excellence"
                                        ? "text-purple-500"
                                        : "text-green-500"
                                }`}
                              />
                              <div className="font-semibold text-xs">{badge.badge_name}</div>
                              <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                                {badge.badge_description}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Activity Heatmap */}
                {analytics?.activityHeatmap && (
                  <div>
                    <Card className="shadow-sm dark:bg-gray-800 dark:border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2 dark:text-white">
                          <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          Practice Activity
                        </CardTitle>
                        <CardDescription className="dark:text-gray-400">Last 28 days</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-7 gap-1">
                          {Array.from({ length: 28 }).map((_, i) => {
                            const date = new Date()
                            date.setDate(date.getDate() - (27 - i))
                            const dateStr = date.toISOString().split("T")[0]
                            const activity = analytics.activityHeatmap.find(
                              (a: any) => a.date.split("T")[0] === dateStr,
                            )
                            const sessions = activity?.sessions || 0

                            return (
                              <div
                                key={i}
                                className={`aspect-square rounded-sm ${
                                  sessions === 0
                                    ? "bg-gray-100"
                                    : sessions === 1
                                      ? "bg-purple-200"
                                      : sessions === 2
                                        ? "bg-purple-400"
                                        : "bg-purple-600"
                                }`}
                                title={`${dateStr}: ${sessions} session${sessions !== 1 ? "s" : ""}`}
                              />
                            )
                          })}
                        </div>
                        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground dark:text-gray-400">
                          <span>Less</span>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-gray-700" />
                            <div className="w-3 h-3 rounded-sm bg-purple-200 dark:bg-purple-800" />
                            <div className="w-3 h-3 rounded-sm bg-purple-400 dark:bg-purple-600" />
                            <div className="w-3 h-3 rounded-sm bg-purple-600 dark:bg-purple-400" />
                          </div>
                          <span>More</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>

              {/* Right Panel: Global Leaderboard */}
              <div className="lg:col-span-2 space-y-6">
                {/* Top 3 Podium */}
                {leaderboard.length >= 3 && (
                  <div>
                    <Card className="border-2 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-yellow-900 dark:text-yellow-200">
                          <Trophy className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
                          Top Practitioners
                        </CardTitle>
                        <CardDescription className="text-yellow-700 dark:text-yellow-300">The best of the best</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4">
                          {displayLeaderboard[1] && (
                          <div className="flex flex-col items-center">
                            <div className="relative">
                              <div className={`w-20 h-20 rounded-full bg-gray-400 flex items-center justify-center text-2xl font-bold text-white mb-2 ${blurPeerNames ? "blur-[4px]" : ""}`}>
                                {blurPeerNames ? "#" : (displayLeaderboard[1].student_name?.charAt(0) || "2")}
                              </div>
                              <div className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md">
                                <Medal className="h-5 w-5 text-gray-400" />
                              </div>
                            </div>
                            <div className={`text-center mt-2 ${blurPeerNames ? "blur-[6px] select-none" : ""}`}>
                              <div className="font-bold text-sm text-gray-700 dark:text-gray-200">
                                {blurPeerNames ? "Student" : displayLeaderboard[1].student_name || "Student"}
                              </div>
                              <div className="text-xs text-gray-500">#{displayLeaderboard[1].rank}</div>
                              <div className="text-lg font-bold text-gray-800 dark:text-gray-100 mt-1">
                                {blurPeerNames ? "•••" : (displayLeaderboard[1].total_practice_points ?? 0).toLocaleString()}
                              </div>
                              <div className="text-xs text-gray-500">XP</div>
                            </div>
                          </div>
                          )}

                          {displayLeaderboard[0] && (
                          <div className="flex flex-col items-center -mt-4">
                          <motion.div
                              animate={shouldAnimate ? { scale: [1, 1.05, 1] } : {}}
                              transition={shouldAnimate ? { repeat: Infinity, duration: 2.5 } : {}}
                              className="relative"
                            >
                              <div className={`w-24 h-24 rounded-full bg-yellow-500 flex items-center justify-center text-3xl font-bold text-white mb-2 ${blurPeerNames ? "blur-[4px]" : ""}`}>
                                {blurPeerNames ? "#" : (displayLeaderboard[0].student_name?.charAt(0) || "1")}
                              </div>
                              <div className="absolute -top-3 -right-2 bg-white rounded-full p-1 shadow-lg">
                                <Crown className="h-6 w-6 text-yellow-500" />
                              </div>
                              {shouldAnimate && (
                              <motion.div
                                animate={{ rotate: 360 }}
                                  transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                                className="absolute inset-0 -z-10"
                              >
                                <Sparkles className="h-6 w-6 text-yellow-400 absolute -top-2 -left-2" />
                                <Sparkles className="h-4 w-4 text-yellow-300 absolute -bottom-1 -right-1" />
                              </motion.div>
                              )}
                            </motion.div>
                            <div className={`text-center mt-2 ${blurPeerNames ? "blur-[6px] select-none" : ""}`}>
                              <div className="font-bold text-gray-700 dark:text-gray-200">
                                {blurPeerNames ? "Student" : displayLeaderboard[0].student_name || "Student"}
                              </div>
                              <div className="text-xs text-gray-500">#{displayLeaderboard[0].rank}</div>
                              <div className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-1">
                                {blurPeerNames ? "•••" : (displayLeaderboard[0].total_practice_points ?? 0).toLocaleString()}
                              </div>
                              <div className="text-xs text-gray-500">XP</div>
                            </div>
                          </div>
                          )}

                          {displayLeaderboard[2] && (
                          <div className="flex flex-col items-center">
                            <div className="relative">
                              <div className={`w-20 h-20 rounded-full bg-orange-500 flex items-center justify-center text-2xl font-bold text-white mb-2 ${blurPeerNames ? "blur-[4px]" : ""}`}>
                                {blurPeerNames ? "#" : (displayLeaderboard[2].student_name?.charAt(0) || "3")}
                              </div>
                              <div className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md">
                                <Medal className="h-5 w-5 text-orange-600" />
                              </div>
                            </div>
                            <div className={`text-center mt-2 ${blurPeerNames ? "blur-[6px] select-none" : ""}`}>
                              <div className="font-bold text-sm text-gray-700 dark:text-gray-200">
                                {blurPeerNames ? "Student" : displayLeaderboard[2].student_name || "Student"}
                              </div>
                              <div className="text-xs text-gray-500">#{displayLeaderboard[2].rank}</div>
                              <div className="text-lg font-bold text-gray-800 dark:text-gray-100 mt-1">
                                {blurPeerNames ? "•••" : (displayLeaderboard[2].total_practice_points ?? 0).toLocaleString()}
                              </div>
                              <div className="text-xs text-gray-500">XP</div>
                            </div>
                          </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}


                {/* All Students Performance - Creative List */}
                  <div>
                  <Card className="border bg-gray-900 overflow-hidden max-h-[700px] flex flex-col">
                    <CardHeader className="relative bg-blue-600/20 border-b border-white/10 flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-2xl font-bold flex items-center gap-3 text-white">
                            {shouldAnimate ? (
                              <motion.div
                                animate={{ rotate: [0, 10, 0, -10, 0] }}
                                transition={{ duration: 3, repeat: Infinity }}
                              >
                                <Trophy className="h-7 w-7 text-yellow-400" />
                              </motion.div>
                            ) : (
                              <Trophy className="h-7 w-7 text-yellow-400" />
                            )}
                            {studentSession} Champions League
                        </CardTitle>
                          <CardDescription className="mt-2 text-purple-200 font-medium">
                            {blurPeerNames
                              ? "Your rank — other students hidden for privacy"
                              : "Full class rankings — see how you compare"}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-3">
                          <UIBadge className="bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 text-white border-0 px-5 py-2.5 text-base font-bold shadow-lg shadow-yellow-500/30">
                            <Sparkles className="h-4 w-4 mr-2" />
                            {leaderboard.length} Students
                          </UIBadge>
                        </div>
                      </div>
                      </CardHeader>
                    <CardContent className="relative p-6 bg-slate-800/50 flex-1 overflow-y-auto">
                      <div className="space-y-3">
                        {MemoizedLeaderboardList}

                      </div>

                      {/* Motivational Message */}
                      {displayLeaderboard.length > 0 && (
                        <div className="relative mt-6 p-6 bg-purple-500/30 border-2 border-purple-400/50 rounded-2xl overflow-hidden">
                          
                          <div className="relative flex items-center gap-4">
                            <div className="p-3 bg-purple-600 rounded-2xl">
                              <TrendingUp className="h-7 w-7 text-white" />
                          </div>
                            <div className="flex-1">
                              <p className="font-black text-xl text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] mb-2">
                                🎯 Keep practicing to climb the leaderboard!
                              </p>
                              <p className="text-sm text-purple-100 font-medium">
                                🏆 Complete practice sessions to earn XP • 
                                📊 Track your progress and improve your scores • 
                                ⭐ Compete with classmates and reach the top!
                              </p>
                        </div>
                          </div>
                        </div>
                      )}
                      </CardContent>
                    </Card>
                  </div>
              </div>
            </div>
          </TabsContent>
            )}
          </AnimatePresence>
        </Tabs>
      </main>
    </div>
  )
}
