"use client"

import { useState, useEffect } from "react"
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
  Flame,
  ChevronRight
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { StudentHeader } from "@/components/student-header"
import { EnhancedAIChat } from "@/components/enhanced-ai-chat"
import { TutorSettingsDrawer } from "@/components/ai-tutor/TutorSettingsDrawer"

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
    label: "Practice Hub",
    icon: Code,
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30"
  },
  {
    id: "progress",
    label: "My Progress",
    icon: TrendingUp,
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/30"
  },
  {
    id: "tools",
    label: "AI Tools",
    icon: Sparkles,
    color: "text-pink-600",
    bgColor: "bg-pink-100 dark:bg-pink-900/30"
  },
  {
    id: "preferences",
    label: "Preferences",
    icon: Settings,
    color: "text-slate-600",
    bgColor: "bg-slate-100 dark:bg-slate-700/50"
  },
]

export default function AITutorChatPage() {
  const router = useRouter()
  const [studentId, setStudentId] = useState<string>("")
  const [activeTab, setActiveTab] = useState("chat")
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

  useEffect(() => {
    const id = sessionStorage.getItem("studentDatabaseId")
    if (id) {
      setStudentId(id)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-purple-950">
      <StudentHeader />
      
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
                <span className="sm:hidden">C++ mentor • GPT-4</span>
                <span className="hidden sm:inline">Your personal C++ mentor • Powered by GPT-4</span>
              </p>
            </div>
          </div>

          {/* Back Button - Floating to the right on mobile, full button on desktop */}
          <Button 
            onClick={() => router.push("/student/dashboard")} 
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
                      onClick={() => {
                        setActiveTab(item.id)
                        if (item.id === "overview") {
                          router.push("/student/ai-tutor")
                        }
                      }}
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
          </motion.div>

          {/* Main Content Area - Chat */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="min-h-[400px] sm:min-h-[500px] md:min-h-[600px] order-1 lg:order-2"
          >
            <div className="rounded-xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm overflow-hidden h-[calc(100vh-250px)] sm:h-[calc(100vh-280px)] md:h-[calc(100vh-280px)]">
              <EnhancedAIChat 
                studentId={studentId} 
                hideHeader={true}
                hideFooter={false}
                className="bg-transparent h-full"
              />
            </div>
          </motion.div>
        </div>
      </main>

      {/* Settings Drawer */}
      <TutorSettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        learningMemory={learningMemory}
        onLearningMemoryChange={(id, value) => setLearningMemory((prev) => ({ ...prev, [id]: value }))}
      />
    </div>
  )
}
