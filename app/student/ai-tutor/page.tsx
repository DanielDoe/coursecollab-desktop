"use client"

import type React from "react"
import { useEffect, useState, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Bot, 
  Brain, 
  BookOpen, 
  Target, 
  TrendingUp, 
  Zap, 
  Star, 
  Clock, 
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Lightbulb,
  Code,
  Calculator,
  FileText,
  Users,
  Award,
  BarChart3,
  PlayCircle,
  BookMarked,
  MessageSquare,
  Settings,
  Crown,
  Rocket,
  Shield,
  Globe,
  Mic,
  Camera,
  Download,
  Share2,
  Home,
  GraduationCap,
  Flame
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { useMembership } from "@/hooks/use-membership"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import type { MembershipTier } from "@/lib/membership-constants"
import { studentTierHasCodeBenchAccess } from "@/lib/codebench-entitlement-client"
import { EnhancedAIChat } from "@/components/enhanced-ai-chat"
import { TutorSettingsDrawer } from "@/components/ai-tutor/TutorSettingsDrawer"
import { StudentHeader } from "@/components/student-header"
import { useToast } from "@/hooks/use-toast"
import { LearningProgressDashboard } from "@/components/learning-progress-dashboard"
import { AITutorProgressDashboard } from "@/components/ai-tutor/AITutorProgressDashboard"
import { AIToolsLauncher } from "@/components/ai-tutor/AIToolsLauncher"
import { AIToolsSlidePanel } from "@/components/ai-tutor/AIToolsSlidePanel"
import { LearningStylePreferences } from "@/components/learning-style-preferences"
import { SmartLearningNotifications } from "@/components/smart-learning-notifications"
import { AdvancedAIFeatures } from "@/components/advanced-ai-features"

interface AIStats {
  totalQuestions: number
  weeklyProgress: number
  streakDays: number
  topicsMastered: number
  averageResponseTime: number
  satisfactionScore: number
}

interface StudySession {
  id: string
  topic: string
  duration: number
  questionsAnswered: number
  accuracy: number
  timestamp: Date
}

interface AIRecommendation {
  id: string
  type: 'quiz' | 'lecture' | 'practice' | 'homework' | 'exam'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  estimatedTime: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  link: string
}

const navItems = [
  {
    id: "overview",
    label: "Overview",
    icon: Home,
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30"
  },
  {
    id: "chat",
    label: "AI Chat",
    icon: MessageSquare,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30"
  },
  {
    id: "practice",
    label: "Practice",
    icon: Code,
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30"
  },
  {
    id: "analytics",
    label: "My Progress",
    icon: TrendingUp,
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/30"
  },
  {
    id: "tools",
    label: "AI Tools",
    icon: Rocket,
    color: "text-pink-600",
    bgColor: "bg-pink-100 dark:bg-pink-900/30"
  },
  {
    id: "settings",
    label: "Preferences",
    icon: Settings,
    color: "text-slate-600",
    bgColor: "bg-slate-100 dark:bg-slate-900/30"
  }
]

export default function StudentAITutorPage({ embedded }: { embedded?: boolean }) {
  const router = useRouter()
  const homeHref = "/student/dashboard-v2"
  const searchParams = useSearchParams()
  const { tier } = useMembership()
  const { toast } = useToast()
  const [studentData, setStudentData] = useState<any>(null)
  const [aiStats, setAiStats] = useState<AIStats>({
    totalQuestions: 0,
    weeklyProgress: 0,
    streakDays: 0,
    topicsMastered: 0,
    averageResponseTime: 0,
    satisfactionScore: 0
  })
  const [recentSessions, setRecentSessions] = useState<StudySession[]>([])
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([])
  const [activeTab, setActiveTab] = useState("overview")
  const [isLoading, setIsLoading] = useState(true)
  const [topicProgress, setTopicProgress] = useState<any[]>([])
  const [aiTutorCredits, setAiTutorCredits] = useState<{
    credits: number
    creditsLimit: number | "unlimited"
    isUnlimited: boolean
    coraMode?: "premium" | "lite"
  } | null>(null)
  const [effectiveTier, setEffectiveTier] = useState<MembershipTier | null>(null) // null = loading, "Scholar" = loaded but no access
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [persona, setPersona] = useState("mentor")
  const [tone, setTone] = useState("beginner")
  const [chatModes, setChatModes] = useState({
    socratic: true,
    "deep-reasoning": true,
    "debug-explain": true,
    "step-by-step": true,
  })
  const [learningMemory, setLearningMemory] = useState({
    "remember-gaps": true,
    "detect-confusion": true,
  })
  const [selectedTool, setSelectedTool] = useState<string | null>(null)

  useEffect(() => {
    const student = getStudentData()
    if (!student) {
      router.push("/student/login")
      return
    }
    setStudentData(student)
    
    // Ensure correct studentDatabaseId is set in sessionStorage
    // If student.id exists, use it; otherwise try to look it up
    const currentDbId = sessionStorage.getItem("studentDatabaseId")
    if (!currentDbId || currentDbId === "308") {
      // Try to get from student session data
      const studentSession = localStorage.getItem("studentSession")
      if (studentSession) {
        try {
          const sessionData = JSON.parse(studentSession)
          if (sessionData.databaseId && sessionData.databaseId !== "308") {
            sessionStorage.setItem("studentDatabaseId", sessionData.databaseId)
          }
        } catch (e) {
          console.error("[AI Tutor Page] Failed to parse studentSession:", e)
        }
      }
    }
    
    fetchAIStats()
    fetchRecentSessions()
    fetchRecommendations()
    fetchAITutorCredits()
    refreshMembershipData()
  }, [router])

  const refreshMembershipData = async () => {
    try {
      // Try multiple sources for student database ID
      let studentDbId = sessionStorage.getItem("studentDatabaseId") || 
                       localStorage.getItem("studentDatabaseId")
      
      // If still not found, try to get from student session data
      if (!studentDbId) {
        const studentSession = localStorage.getItem("studentSession")
        if (studentSession) {
          try {
            const sessionData = JSON.parse(studentSession)
            studentDbId = sessionData.databaseId || sessionData.id
          } catch (e) {
            console.error("[AI Tutor Page] Failed to parse studentSession:", e)
          }
        }
      }
      
      if (!studentDbId) {
        setEffectiveTier("Scholar")
        return
      }
      
      // Fetch effective membership tier (includes trial/donation access)
      // This API uses getEffectiveMembershipTier which checks for trial, donation, and beta access
      const response = await studentApiFetch(`/api/student/membership?studentId=${studentDbId}`)
      if (response.ok) {
        const data = await response.json()
        const tier = data.membership?.tier || "Scholar"
        setEffectiveTier(tier as MembershipTier)
        sessionStorage.setItem("studentMembershipTier", tier)
        localStorage.setItem("studentMembershipTier", tier)
        
        // Ensure studentDatabaseId is set correctly in sessionStorage
        if (!sessionStorage.getItem("studentDatabaseId")) {
          sessionStorage.setItem("studentDatabaseId", studentDbId)
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error(`[AI Tutor Page] Failed to fetch membership: ${response.status}`, errorData)
        setEffectiveTier("Scholar") // Default to Scholar on error
      }
    } catch (error) {
      console.error("Failed to refresh membership data:", error)
      setEffectiveTier("Scholar") // Default to Scholar on error
    }
  }

  const fetchAITutorCredits = async () => {
    try {
      const studentDbId = sessionStorage.getItem("studentDatabaseId")
      if (!studentDbId) return
      
      const response = await fetch(`/api/ai-tutor/credits?studentId=${studentDbId}`)
      if (response.ok) {
        const data = await response.json()
        setAiTutorCredits(data)
      }
    } catch (error) {
      console.error("Failed to fetch AI tutor credits:", error)
    }
  }

  const fetchAIStats = async () => {
    try {
      const studentDbId = sessionStorage.getItem("studentDatabaseId")
      if (!studentDbId) return
      
      const response = await fetch(`/api/ai-tutor/stats?studentId=${studentDbId}`)
      const data = await response.json()
      if (response.ok) {
        setAiStats(data.stats || {
          totalQuestions: 0,
          weeklyProgress: 0,
          streakDays: 0,
          topicsMastered: 0,
          averageResponseTime: 0,
          satisfactionScore: 0
        })
      }
    } catch (error) {
      console.error("Failed to fetch AI stats:", error)
    }
  }

  const fetchRecentSessions = async () => {
    try {
      const studentDbId = sessionStorage.getItem("studentDatabaseId")
      if (!studentDbId) return
      
      const response = await fetch(`/api/ai-tutor/sessions?studentId=${studentDbId}`)
      const data = await response.json()
      if (response.ok) {
        setRecentSessions(data.sessions || [])
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error)
    }
  }

  const fetchRecommendations = async () => {
    try {
      const studentDbId = sessionStorage.getItem("studentDatabaseId")
      if (!studentDbId) return
      
      const response = await fetch(`/api/ai-tutor/recommendations?studentId=${studentDbId}`)
      const data = await response.json()
      if (response.ok) {
        setRecommendations(data.recommendations || [])
      }
    } catch (error) {
      console.error("Failed to fetch recommendations:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-purple-950">
        {!embedded && <StudentHeader />}
        <div className="flex items-center justify-center min-h-[60vh]">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6"
          >
            <div className="relative mx-auto w-24 h-24">
              <motion.div
                animate={{ 
                  rotate: 360,
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                  scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                }}
                className="w-full h-full rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-indigo-600 shadow-2xl shadow-purple-500/30 flex items-center justify-center"
              >
                <Brain className="w-12 h-12 text-white" />
              </motion.div>
            </div>
            
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent"
            >
              Loading AI Tutor
            </motion.h2>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-purple-950">
      {!embedded && <StudentHeader />}
      
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-10 max-w-7xl">
        {/* Page Header - Matching CourseCollab Style */}
        <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4 mb-6 sm:mb-8 md:mb-10 relative">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
            <div className="p-2 sm:p-2.5 md:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-800 dark:from-purple-700 dark:to-indigo-900 shadow-lg shrink-0">
              <Brain className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-indigo-800 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent break-words">
                <span className="sm:hidden">AI Tutor</span>
                <span className="hidden sm:inline md:hidden">AI Learning</span>
                <span className="hidden md:inline">AI Learning Assistant</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5 sm:mt-1 break-words">
                {studentData?.name ? (
                  <>
                    <span className="sm:hidden">C++ mentor • GPT-4</span>
                    <span className="hidden sm:inline md:hidden">Your mentor, <span className="font-semibold text-slate-800 dark:text-slate-200">{studentData.name}</span> • GPT-4</span>
                    <span className="hidden md:inline">Your personal C++ mentor, <span className="font-semibold text-slate-800 dark:text-slate-200">{studentData.name}</span> • Powered by GPT-4</span>
                  </>
                ) : (
                  <>
                    <span className="sm:hidden">AI-powered C++ tutor</span>
                    <span className="hidden sm:inline">Your personalized AI-powered C++ programming tutor</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Back Button - Floating to the right on mobile, full button on desktop */}
          <Button 
            onClick={() => router.push(homeHref)} 
            variant="outline" 
            size="sm"
            className="absolute top-0 right-0 sm:relative sm:top-auto sm:right-auto gap-1.5 sm:gap-2 rounded-lg sm:rounded-full bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 text-xs sm:text-sm h-8 sm:h-9 md:h-10 px-2 sm:px-3 md:px-4 shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </div>

        {/* Quick Stats - Modern Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8"
        >
          <div className="rounded-xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm p-4 sm:p-5 hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-blue-100 dark:bg-blue-900/30 shrink-0">
                <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <Badge variant="secondary" className="text-[10px] sm:text-xs shrink-0">Total</Badge>
            </div>
            <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-500 dark:to-cyan-500 bg-clip-text text-transparent">
              {aiStats.totalQuestions}
            </p>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              <span className="sm:hidden">Questions</span>
              <span className="hidden sm:inline">Questions Asked</span>
            </p>
          </div>

          <div className="rounded-xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm p-4 sm:p-5 hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-green-100 dark:bg-green-900/30 shrink-0">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
              </div>
              <Badge variant="secondary" className="text-[10px] sm:text-xs shrink-0">Progress</Badge>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-baseline gap-2 sm:gap-3 mb-1">
              <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-500 dark:to-emerald-500 bg-clip-text text-transparent">
                {aiStats.weeklyProgress}%
              </p>
              <span className="hidden sm:inline text-xl text-slate-400 dark:text-slate-500">•</span>
              <div className="flex items-center gap-1.5">
                <Flame className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400 shrink-0" />
                <p className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-600 dark:from-orange-500 dark:to-red-500 bg-clip-text text-transparent">
                  {aiStats.streakDays}
                </p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <span className="sm:hidden">Progress • Streak 🔥</span>
              <span className="hidden sm:inline">Weekly Progress • Day Streak 🔥</span>
            </p>
          </div>

          <div className="rounded-xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm p-4 sm:p-5 hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-purple-100 dark:bg-purple-900/30 shrink-0">
                <Award className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <Badge variant="secondary" className="text-[10px] sm:text-xs shrink-0">Mastered</Badge>
            </div>
            <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-500 dark:to-pink-500 bg-clip-text text-transparent">
              {aiStats.topicsMastered}
            </p>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              <span className="sm:hidden">Topics</span>
              <span className="hidden sm:inline">Topics Mastered</span>
            </p>
          </div>

          {/* AI Tutor Credits Card */}
          {aiTutorCredits && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm p-4 sm:p-5 hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-indigo-100 dark:bg-indigo-900/30 shrink-0">
                  <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <Badge variant="secondary" className="text-[10px] sm:text-xs shrink-0">
                  {aiTutorCredits.coraMode === "lite" ? "Cora Lite" : "Available"}
                </Badge>
              </div>
              <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-500 dark:to-purple-500 bg-clip-text text-transparent">
                {aiTutorCredits.credits.toLocaleString()}
              </p>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 break-words">
                {typeof aiTutorCredits.creditsLimit === "number" ? (
                  <span>
                    <span className="sm:hidden">Cora ({aiTutorCredits.creditsLimit.toLocaleString()}/mo)</span>
                    <span className="hidden sm:inline">
                      Cora Credits ({aiTutorCredits.creditsLimit.toLocaleString()}/month)
                    </span>
                  </span>
                ) : (
                  <span>
                    <span className="sm:hidden">Cora Credits</span>
                    <span className="hidden sm:inline">Cora Credits</span>
                  </span>
                )}
              </p>
              {typeof aiTutorCredits.creditsLimit === "number" && (
                <Progress
                  value={Math.min(100, (aiTutorCredits.credits / aiTutorCredits.creditsLimit) * 100)}
                  className="mt-2 h-2"
                />
              )}
            </motion.div>
          )}
        </motion.div>

        {/* Modern Sidebar Navigation + Content */}
        <div className="grid lg:grid-cols-[280px_1fr] gap-4 sm:gap-6">
          {/* Vertical Sidebar Navigation */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-2 order-2 lg:order-1"
          >
            <div className="rounded-xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm p-2 sm:p-3">
              <div className="space-y-0.5 sm:space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = activeTab === item.id
                  
                  return (
                    <motion.button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl transition-all duration-200 text-xs sm:text-sm",
                        isActive
                          ? "bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-700 dark:to-indigo-700 text-white shadow-md"
                          : "hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300"
                      )}
                    >
                      <div className={cn(
                        "p-1.5 sm:p-2 rounded-lg transition-colors shrink-0",
                        isActive ? "bg-white/20" : item.bgColor
                      )}>
                        <Icon className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", isActive ? "text-white" : item.color)} />
                      </div>
                      <span className="font-medium truncate">{item.label}</span>
                      {isActive && (
                        <motion.div
                          layoutId="activeTab"
                          className="ml-auto"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </motion.div>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            </div>

            {/* Premium Tier Badge */}
            {tier === "premium" && (
              <div className="rounded-xl sm:rounded-2xl border border-yellow-200/60 dark:border-yellow-700/60 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                  <Crown className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
                  <span className="font-bold text-yellow-900 dark:text-yellow-200 text-xs sm:text-sm">Premium</span>
                </div>
                <p className="text-[10px] sm:text-xs text-yellow-700 dark:text-yellow-300 break-words">
                  <span className="sm:hidden">Unlimited chats & features</span>
                  <span className="hidden sm:inline">Unlimited AI chats & advanced features</span>
                </p>
              </div>
            )}
          </motion.div>

          {/* Main Content Area */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="min-h-[400px] sm:min-h-[500px] md:min-h-[600px] order-1 lg:order-2"
          >
            <AnimatePresence mode="wait">
              {/* Overview Tab */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  <SmartLearningNotifications 
                    studentId={sessionStorage.getItem("studentDatabaseId") || ""}
                    topicProgress={topicProgress}
                  />
                  
                  <LearningProgressDashboard 
                    studentId={sessionStorage.getItem("studentDatabaseId") || ""}
                    onProgressUpdate={(topics) => setTopicProgress(topics)}
                  />
                </div>
              )}

              {/* AI Chat Tab */}
              {activeTab === "chat" && (
                <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm overflow-hidden h-[calc(100vh-280px)] flex flex-col">
                  {/* Chat Header */}
                  <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between bg-white/50 dark:bg-slate-800/50 shrink-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
                        <span className="sm:hidden">Chat</span>
                        <span className="hidden sm:inline">AI Tutor Chat</span>
                      </h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsSettingsOpen(true)}
                      className="h-8 w-8 text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 shrink-0"
                      title="AI Tutor Settings"
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {/* Chat Content */}
                  <div className="flex-1 min-h-0">
                    <EnhancedAIChat 
                      studentId={sessionStorage.getItem("studentDatabaseId") || ""} 
                      hideHeader={true}
                      hideFooter={false}
                      className="bg-transparent h-full"
                      onSettingsClick={() => setIsSettingsOpen(true)}
                      learningMemory={learningMemory}
                    />
                  </div>
                </div>
              )}

              {/* Practice Hub Tab */}
              {activeTab === "practice" && (
                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
                    <div className="rounded-xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm p-4 sm:p-5 md:p-6 hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] transition-all cursor-pointer"
                      onClick={() => router.push(embedded ? "/student/dashboard-v2/practice" : "/student/practice")}
                    >
                      <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                        <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-green-100 dark:bg-green-900/30 shrink-0">
                          <Code className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-slate-100">Practice Hub</h3>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Interactive coding challenges</p>
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-3 sm:mb-4 break-words">
                        <span className="sm:hidden">AI-generated problems for your skill level</span>
                        <span className="hidden sm:inline">Solve AI-generated problems tailored to your skill level</span>
                      </p>
                      <Button className="w-full rounded-lg sm:rounded-full bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-xs sm:text-sm h-9 sm:h-10">
                        <span className="sm:hidden">Practice</span>
                        <span className="hidden sm:inline">Start Practicing</span>
                      </Button>
                    </div>

                    <div className={`rounded-xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm p-4 sm:p-5 md:p-6 transition-all ${
                      studentTierHasCodeBenchAccess(effectiveTier) ? "hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] cursor-pointer" : effectiveTier === null ? "" : "opacity-75 cursor-not-allowed"
                    }`}
                      onClick={() => {
                        if (effectiveTier === null) {
                          // Still loading, don't do anything
                          return
                        }
                        if (studentTierHasCodeBenchAccess(effectiveTier)) {
                          router.push(embedded ? "/student/dashboard-v2/codebench" : "/student/codebench")
                        } else {
                          toast({
                            title: "CodeBench Access Required",
                            description: "Cora in CodeBench requires Explorer or Trailblazer. Core CodeBench is available on Scholar.",
                            variant: "destructive",
                          })
                          router.push("/student/dashboard-v2/membership")
                        }
                      }}
                    >
                      <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                        <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-blue-100 dark:bg-blue-900/30 shrink-0">
                          <PlayCircle className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-slate-100">CodeBench</h3>
                            {effectiveTier === null ? (
                              <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 text-[10px] sm:text-xs shrink-0">
                                Checking...
                              </Badge>
                            ) : studentTierHasCodeBenchAccess(effectiveTier) ? (
                              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[10px] sm:text-xs shrink-0">
                                Available
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 text-[10px] sm:text-xs shrink-0">
                                <span className="sm:hidden">Upgrade</span>
                                <span className="hidden sm:inline">Upgrade Required</span>
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Run and test your code</p>
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-3 sm:mb-4 break-words">
                        <span className="sm:hidden">Write, compile, and run C++ code</span>
                        <span className="hidden sm:inline">Write, compile, and run C++ code in your browser</span>
                      </p>
                      <Button 
                        className={`w-full rounded-lg sm:rounded-full text-xs sm:text-sm h-9 sm:h-10 ${
                          studentTierHasCodeBenchAccess(effectiveTier) 
                            ? "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800" 
                            : "bg-slate-400 hover:bg-slate-500 dark:bg-slate-600 dark:hover:bg-slate-700"
                        }`}
                        disabled={!studentTierHasCodeBenchAccess(effectiveTier)}
                      >
                        {effectiveTier === null ? (
                          <span className="sm:hidden">Checking...</span>
                        ) : studentTierHasCodeBenchAccess(effectiveTier) ? (
                          <>
                            <span className="sm:hidden">Open</span>
                            <span className="hidden sm:inline">Open Editor</span>
                          </>
                        ) : (
                          <>
                            <span className="sm:hidden">Upgrade</span>
                            <span className="hidden sm:inline">Upgrade to Access</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* AI Recommendations */}
                  {recommendations.length > 0 && (
                    <div className="rounded-xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm p-4 sm:p-5 md:p-6">
                      <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2 text-slate-900 dark:text-slate-100">
                        <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400 shrink-0" />
                        <span className="sm:hidden">Recommended</span>
                        <span className="hidden sm:inline">Recommended for You</span>
                      </h3>
                      <div className="space-y-2 sm:space-y-3">
                        {recommendations.slice(0, 3).map((rec) => (
                          <div key={rec.id} className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                            <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-2 sm:gap-0 mb-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-100 break-words">{rec.title}</h4>
                                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5 sm:mt-1 break-words">{rec.description}</p>
                              </div>
                              <Badge variant={rec.priority === 'high' ? 'destructive' : 'secondary'} className="text-[10px] sm:text-xs shrink-0">
                                {rec.priority}
                              </Badge>
                            </div>
                            <Button size="sm" variant="outline" className="rounded-lg sm:rounded-full text-xs sm:text-sm h-8 sm:h-9 w-full sm:w-auto" onClick={() => router.push(rec.link)}>
                              <span className="sm:hidden">Try</span>
                              <span className="hidden sm:inline">Try Now</span>
                              <ArrowRight className="h-3 w-3 ml-1 sm:ml-1.5 shrink-0" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Analytics Tab */}
              {activeTab === "analytics" && (
                <div className="space-y-6">
                  <AITutorProgressDashboard 
                    studentId={sessionStorage.getItem("studentDatabaseId") || ""}
                  />
                </div>
              )}

              {/* AI Tools Tab */}
              {activeTab === "tools" && (
                <div className="relative h-[calc(100vh-250px)] sm:h-[calc(100vh-280px)] md:h-[calc(100vh-200px)] rounded-xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm overflow-hidden">
                  <AIToolsLauncher
                    onToolSelect={(toolId) => setSelectedTool(toolId)}
                  />
                  {selectedTool && (
                    <AIToolsSlidePanel
                      toolId={selectedTool}
                      onClose={() => setSelectedTool(null)}
                      studentId={sessionStorage.getItem("studentDatabaseId") || ""}
                    />
                  )}
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === "settings" && (
                <LearningStylePreferences studentId={sessionStorage.getItem("studentDatabaseId") || ""} />
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </main>

      {/* Settings Drawer */}
      {activeTab === "chat" && (
        <TutorSettingsDrawer
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          learningMemory={learningMemory}
          onLearningMemoryChange={(id, value) => setLearningMemory((prev) => ({ ...prev, [id]: value }))}
          onGenerateStudyPlan={() => {
            window.dispatchEvent(new CustomEvent('generate-study-plan', { 
              detail: { learningMemory } 
            }))
          }}
        />
      )}
    </div>
  )
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}
