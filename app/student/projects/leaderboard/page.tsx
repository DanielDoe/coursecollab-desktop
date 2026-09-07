"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Trophy, Medal, TrendingUp, Users, MessageSquare, Heart, ThumbsUp, ThumbsDown, Calendar, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { logoutStudent, getStudentData } from "@/lib/auth"
import { ProjectLeaderboard } from "@/components/project-leaderboard"
import { StudentHeader } from "@/components/student-header"
import { motion } from "framer-motion"

export default function StudentProjectLeaderboardPage() {
  const router = useRouter()
  const [studentId, setStudentId] = useState<string | null>(null)
  const [studentName, setStudentName] = useState("")
  const [studentSection, setStudentSection] = useState("")
  const [studentDatabaseId, setStudentDatabaseId] = useState<number | null>(null)

  useEffect(() => {
    const dbId = sessionStorage.getItem("studentDatabaseId")
    const id = sessionStorage.getItem("studentId")
    const name = sessionStorage.getItem("studentName")
    const section = sessionStorage.getItem("studentSection")

    if (!id || !dbId) {
      router.push("/student/login")
      return
    }

    setStudentDatabaseId(Number.parseInt(dbId))
    setStudentId(id)
    setStudentName(name || "")
    setStudentSection(section || "")
  }, [router])

  const handleLogout = () => {
    logoutStudent()
  }

  if (!studentId || !studentDatabaseId) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <StudentHeader />

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-10 max-w-7xl">
        {/* Page Header */}
        <div className="mb-8 sm:mb-10 md:mb-12 relative">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            <div className="relative shrink-0">
              <div className="p-2.5 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-yellow-500 via-amber-500 to-orange-500 dark:from-yellow-600 dark:via-amber-600 dark:to-orange-600 shadow-[0_8px_32px_rgba(251,191,36,0.3)] dark:shadow-[0_8px_32px_rgba(251,191,36,0.5)]">
                <Trophy className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-r from-red-400 to-pink-500 rounded-full animate-pulse"></div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-yellow-600 via-amber-600 to-orange-600 dark:from-yellow-400 dark:via-amber-400 dark:to-orange-400">
                <span className="sm:hidden">Leaderboard</span>
                <span className="hidden sm:inline md:hidden">Project Board</span>
                <span className="hidden md:inline">Project Leaderboard</span>
              </h2>
              <p className="text-xs sm:text-sm md:text-base lg:text-lg text-slate-600 dark:text-slate-400 mt-1 sm:mt-2 break-words">
                <span className="sm:hidden">{studentName}</span>
                <span className="hidden sm:inline">{studentName} • Section {studentSection}</span>
              </p>
            </div>
          </div>
          
          {/* Back Button - Floating to the right on mobile, full button on desktop */}
          <Button 
            onClick={() => router.push("/student/projects")} 
            variant="outline" 
            size="sm"
            className="absolute top-0 right-0 sm:hidden h-9 px-3 rounded-lg border-2 border-yellow-200/60 dark:border-yellow-700/60 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:bg-gradient-to-r hover:from-yellow-50 hover:to-amber-50 dark:hover:from-yellow-900/30 dark:hover:to-amber-900/30 hover:border-yellow-400 dark:hover:border-yellow-500 text-yellow-700 dark:text-yellow-300 shadow-md hover:shadow-lg transition-all duration-200 gap-1.5"
            title="Back to Projects"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-medium">Back</span>
          </Button>
          
          <Button 
            onClick={() => router.push("/student/projects")} 
            variant="outline" 
            size="lg"
            className="hidden sm:flex absolute top-0 right-0 rounded-xl border-2 border-yellow-200/60 dark:border-yellow-700/60 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:bg-gradient-to-r hover:from-yellow-50 hover:to-amber-50 dark:hover:from-yellow-900/30 dark:hover:to-amber-900/30 hover:border-yellow-400 dark:hover:border-yellow-500 text-yellow-700 dark:text-yellow-300 transition-all duration-200 shadow-lg hover:shadow-xl text-sm md:text-base px-3 md:px-4 shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </div>

        {/* Gamification Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-8 sm:mb-10 md:mb-12"
        >
          <div className="bg-gradient-to-br from-yellow-50/80 to-amber-50/60 dark:from-yellow-900/30 dark:to-amber-900/20 border border-yellow-200/60 dark:border-yellow-700/60 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-yellow-100 to-amber-100 dark:from-yellow-900/50 dark:to-amber-900/50 shrink-0">
                <Trophy className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-800 dark:text-yellow-300">Leaderboard</p>
                <p className="text-xs sm:text-sm text-yellow-600 dark:text-yellow-400">
                  <span className="sm:hidden">Top</span>
                  <span className="hidden sm:inline">Top Projects</span>
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-green-50/80 to-emerald-50/60 dark:from-green-900/30 dark:to-emerald-900/20 border border-green-200/60 dark:border-green-700/60 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 shrink-0">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-green-800 dark:text-green-300">Trending</p>
                <p className="text-xs sm:text-sm text-green-600 dark:text-green-400">
                  <span className="sm:hidden">Hot</span>
                  <span className="hidden sm:inline">Hot Projects</span>
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/60 dark:from-blue-900/30 dark:to-indigo-900/20 border border-blue-200/60 dark:border-blue-700/60 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 shrink-0">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-blue-800 dark:text-blue-300">Sessions</p>
                <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400">
                  <span className="sm:hidden">Compare</span>
                  <span className="hidden sm:inline">Compare Sections</span>
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50/80 to-pink-50/60 dark:from-purple-900/30 dark:to-pink-900/20 border border-purple-200/60 dark:border-purple-700/60 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/50 dark:to-pink-900/50 shrink-0">
                <Zap className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-purple-800 dark:text-purple-300">Engagement</p>
                <p className="text-xs sm:text-sm text-purple-600 dark:text-purple-400">
                  <span className="sm:hidden">Vote</span>
                  <span className="hidden sm:inline">Vote & Comment</span>
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Leaderboard Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="rounded-xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm p-4 sm:p-6 md:p-8 hover:shadow-[0_12px_40px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition-all duration-300"
        >
          <ProjectLeaderboard 
            currentSession={studentSection}
            onProjectClick={(projectId) => {
              // Navigate to project details or open voting modal
              router.push(`/student/projects?highlight=${projectId}`)
            }}
          />
        </motion.div>
      </main>
    </div>
  )
}







