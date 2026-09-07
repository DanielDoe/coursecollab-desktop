"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Brain,
  Users,
  MessageSquare,
  TrendingUp,
  Settings,
  BarChart3,
  AlertCircle,
  ArrowLeft,
  Home,
  Activity,
  Shield,
  Loader2,
  Eye,
  Flame,
  Map
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AITutorOverview } from "@/components/ai-tutor-overview"
import { AITutorStudents } from "@/components/ai-tutor-students"
import { AITutorConversations } from "@/components/ai-tutor-conversations"
import { AITutorStruggles } from "@/components/ai-tutor-struggles"
import { AITutorAnalytics } from "@/components/ai-tutor-analytics"
import { AITutorSettings } from "@/components/ai-tutor-settings"
import { LectureConfusionHeatmap } from "@/components/lecture-confusion-heatmap"
import { StudentLearningPath } from "@/components/student-learning-path"
import { DashboardKpiCard } from "@/components/dashboard-v2/DashboardKpiCard"
import { cn } from "@/lib/utils"

interface AIStats {
  totalQuestions: number
  activeStudents: number
  averageResponseTime: number
  satisfactionScore: number
  strugglingStudents: number
  weeklyGrowth: number
}

const navItems = [
  {
    id: "overview",
    label: "Dashboard",
    icon: Home,
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    description: "Quick insights and metrics"
  },
  {
    id: "students",
    label: "Student Activity",
    icon: Users,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    description: "Monitor student usage"
  },
  {
    id: "conversations",
    label: "Conversations",
    icon: MessageSquare,
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    description: "View AI chat logs"
  },
  {
    id: "struggles",
    label: "Struggle Alerts",
    icon: AlertCircle,
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    description: "Students needing help"
  },
  {
    id: "heatmap",
    label: "Slide Heatmap",
    icon: Flame,
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    description: "Confusing slides"
  },
  {
    id: "learning-path",
    label: "Learning Paths",
    icon: Map,
    color: "text-cyan-600",
    bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
    description: "Student journeys"
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    color: "text-pink-600",
    bgColor: "bg-pink-100 dark:bg-pink-900/30",
    description: "Detailed insights"
  },
  {
    id: "settings",
    label: "AI Settings",
    icon: Settings,
    color: "text-slate-600",
    bgColor: "bg-slate-100 dark:bg-slate-900/30",
    description: "Configure AI behavior"
  }
]

const cardBase = "border border-slate-200/60 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.02] rounded-xl shadow-sm"

export function InstructorAITutorContent({ embedInDashboard }: { embedInDashboard?: boolean } = {}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("overview")
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<AIStats>({
    totalQuestions: 0,
    activeStudents: 0,
    averageResponseTime: 0,
    satisfactionScore: 0,
    strugglingStudents: 0,
    weeklyGrowth: 0
  })

  useEffect(() => {
    const instructorSession = localStorage.getItem("instructorSession")
    if (!instructorSession) {
      router.push("/instructor/login")
      return
    }
    
    fetchStats()
  }, [router])

  const fetchStats = async () => {
    try {
      const response = await instructorApiFetch('/api/instructor/ai-tutor/stats')
      const data = await response.json()
      
      if (response.ok) {
        setStats(data.stats || stats)
      }
    } catch (error) {
      console.error('Failed to fetch AI stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${embedInDashboard ? "min-h-[300px]" : "min-h-[60vh]"}`}>
        <div className="text-center">
          <Loader2 className={`w-10 h-10 animate-spin mx-auto mb-4 ${embedInDashboard ? "text-teal-600 dark:text-teal-400" : "text-purple-600"}`} />
          <p className="text-slate-600 dark:text-slate-400">Loading AI Tutor...</p>
        </div>
      </div>
    )
  }

  const dashboardHref = embedInDashboard ? "/instructor/dashboard-v2" : "/instructor/dashboard"

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 sm:mb-8">
          {!embedInDashboard && (
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-800 shadow-lg">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className={`text-2xl font-bold ${embedInDashboard ? "text-slate-800 dark:text-slate-200" : "bg-gradient-to-r from-purple-600 to-indigo-800 bg-clip-text text-transparent"}`}>
                  AI Tutor Management
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">Monitor student interactions and configure AI</p>
              </div>
            </div>
          )}
          {!embedInDashboard && (
            <Button onClick={() => router.push(dashboardHref)} variant="outline" className="gap-2 rounded-lg h-9">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8"
        >
          {embedInDashboard ? (
            <>
              <DashboardKpiCard
                label="Questions asked"
                value={stats.totalQuestions}
                icon={MessageSquare}
                iconBg="bg-sky-500/10"
                iconColor="text-sky-600 dark:text-sky-400"
              />
              <DashboardKpiCard
                label="Active students"
                value={stats.activeStudents}
                icon={Users}
                iconBg="bg-emerald-500/10"
                iconColor="text-emerald-600 dark:text-emerald-400"
              />
              <DashboardKpiCard
                label="Need attention"
                value={stats.strugglingStudents}
                icon={AlertCircle}
                iconBg="bg-amber-500/10"
                iconColor="text-amber-600 dark:text-amber-400"
              />
              <DashboardKpiCard
                label="Satisfaction"
                value={stats.satisfactionScore.toFixed(1)}
                icon={TrendingUp}
                iconBg="bg-violet-500/10"
                iconColor="text-violet-600 dark:text-violet-400"
              />
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm p-5 hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] transition-all duration-300">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                    <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <Badge variant="secondary" className="text-xs">Total</Badge>
                </div>
                <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  {stats.totalQuestions}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Questions Asked</p>
              </div>

              <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm p-5 hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] transition-all duration-300">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/30">
                    <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <Badge variant="secondary" className="text-xs">Active</Badge>
                </div>
                <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  {stats.activeStudents}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Active Students</p>
              </div>

              <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm p-5 hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] transition-all duration-300">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <Badge variant="secondary" className="text-xs">Alerts</Badge>
                </div>
                <p className="text-3xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                  {stats.strugglingStudents}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Need Attention</p>
              </div>

              <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm p-5 hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] transition-all duration-300">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                    <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <Badge variant="secondary" className="text-xs">Rating</Badge>
                </div>
                <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {stats.satisfactionScore.toFixed(1)}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Satisfaction</p>
              </div>
            </>
          )}
        </motion.div>

        {/* Modern Sidebar Navigation + Content */}
        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          {/* Vertical Sidebar Navigation */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-2"
          >
            <div className={`rounded-xl border p-3 ${embedInDashboard ? "border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-white/[0.03]" : "border-slate-200/60 dark:border-slate-700/60 shadow-sm bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm"}`}>
              <div className="space-y-1">
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
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left",
                        isActive
                          ? embedInDashboard ? "bg-teal-500/15 dark:bg-teal-500/25 text-teal-700 dark:text-teal-300 font-medium" : "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md"
                          : "hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300"
                      )}
                    >
                      <div className={cn(
                        "p-2 rounded-lg transition-colors",
                        isActive ? "bg-white/20" : item.bgColor
                      )}>
                        <Icon className={cn("h-4 w-4", isActive ? "text-white" : item.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{item.label}</div>
                        {!isActive && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {item.description}
                          </div>
                        )}
                      </div>
                      {isActive && (
                        <motion.div layoutId="activeIndicator">
                          <ChevronRight className="h-4 w-4" />
                        </motion.div>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            </div>

            <div className={`rounded-xl border p-4 ${embedInDashboard ? "border-slate-200/60 dark:border-white/[0.06] bg-teal-500/5 dark:bg-teal-500/10" : "border-indigo-200/60 dark:border-indigo-700/60 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20"}`}>
              <div className="flex items-center gap-2 mb-2">
                <Eye className={`h-4 w-4 ${embedInDashboard ? "text-teal-600 dark:text-teal-400" : "text-indigo-600"}`} />
                <span className={`font-bold text-sm ${embedInDashboard ? "text-teal-700 dark:text-teal-300" : "text-indigo-900 dark:text-indigo-200"}`}>Live Monitor</span>
              </div>
              <p className={`text-xs mb-3 ${embedInDashboard ? "text-slate-600 dark:text-slate-400" : "text-indigo-700 dark:text-indigo-300"}`}>
                {stats.activeStudents} students using AI
              </p>
              <Button size="sm" className={`w-full rounded-lg text-xs ${embedInDashboard ? "bg-teal-600 hover:bg-teal-700" : "bg-indigo-600 hover:bg-indigo-700 rounded-full"}`}>
                <Activity className="h-3 w-3 mr-1" />
                View Live Activity
              </Button>
            </div>
          </motion.div>

          {/* Main Content Area */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="min-h-[600px]"
          >
            <AnimatePresence mode="wait">
              {activeTab === "overview" && <AITutorOverview stats={stats} />}
              {activeTab === "students" && <AITutorStudents />}
              {activeTab === "conversations" && <AITutorConversations />}
              {activeTab === "struggles" && <AITutorStruggles />}
              {activeTab === "heatmap" && <LectureConfusionHeatmap />}
              {activeTab === "learning-path" && <StudentLearningPath />}
              {activeTab === "analytics" && <AITutorAnalytics />}
              {activeTab === "settings" && <AITutorSettings />}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default function InstructorAITutorPage() {
  return <InstructorAITutorContent />
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}
