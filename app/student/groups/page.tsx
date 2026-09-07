"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Users, Zap, Crown, Search, Plus, UserPlus, MessageSquare, Globe, Shield, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { logoutStudent } from "@/lib/auth"
import { GroupsManager } from "@/components/groups-manager"
import { GroupRequestsPanel } from "@/components/group-requests-panel"
import { StudentHeader } from "@/components/student-header"
import { motion } from "framer-motion"

export default function StudentGroupsPage() {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <StudentHeader />

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-10 max-w-7xl">
        {/* Futuristic Page Header */}
        <div className="mb-8 sm:mb-10 md:mb-12 relative">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            <div className="relative shrink-0">
              <div className="p-2.5 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-700 dark:via-indigo-700 dark:to-purple-700 shadow-[0_8px_32px_rgba(59,130,246,0.3)] dark:shadow-[0_8px_32px_rgba(59,130,246,0.5)]">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full animate-pulse"></div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-800 via-indigo-600 to-purple-600 dark:from-blue-300 dark:via-indigo-400 dark:to-purple-400">
                <span className="sm:hidden">Groups</span>
                <span className="hidden sm:inline md:hidden">Groups Hub</span>
                <span className="hidden md:inline">Group Collaboration Hub</span>
              </h2>
              <p className="text-xs sm:text-sm md:text-base lg:text-lg text-slate-600 dark:text-slate-400 mt-1 sm:mt-2 break-words">
                <span className="sm:hidden">{studentName}</span>
                <span className="hidden sm:inline">{studentName} • Section {studentSection}</span>
              </p>
            </div>
          </div>
          
          {/* Back Button - Floating to the right on mobile, full button on desktop */}
          <Button 
            onClick={() => router.push("/student/dashboard")} 
            variant="outline" 
            size="sm"
            className="absolute top-0 right-0 sm:hidden h-9 px-3 rounded-lg border-2 border-blue-200/60 dark:border-blue-700/60 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 hover:border-blue-400 dark:hover:border-blue-500 text-blue-700 dark:text-blue-300 shadow-md hover:shadow-lg transition-all duration-200 gap-1.5"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-medium">Back</span>
          </Button>
          
          <Button 
            onClick={() => router.push("/student/dashboard")} 
            variant="outline" 
            size="lg"
            className="hidden sm:flex absolute top-0 right-0 rounded-xl border-2 border-blue-200/60 dark:border-blue-700/60 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 hover:border-blue-400 dark:hover:border-blue-500 text-blue-700 dark:text-blue-300 transition-all duration-200 shadow-lg hover:shadow-xl text-sm md:text-base px-3 md:px-4 shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        {/* Quick Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-8 sm:mb-10 md:mb-12"
        >
          <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/60 dark:from-blue-900/30 dark:to-indigo-900/20 border border-blue-200/60 dark:border-blue-700/60 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 shrink-0">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-blue-800 dark:text-blue-300">Groups</p>
                <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400">
                  <span className="sm:hidden">Manage</span>
                  <span className="hidden sm:inline">Create & Manage</span>
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/60 dark:from-emerald-900/30 dark:to-teal-900/20 border border-emerald-200/60 dark:border-emerald-700/60 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/50 dark:to-teal-900/50 shrink-0">
                <Search className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-emerald-800 dark:text-emerald-300">Discover</p>
                <p className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                  <span className="sm:hidden">Find</span>
                  <span className="hidden sm:inline">Find & Join</span>
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50/80 to-pink-50/60 dark:from-purple-900/30 dark:to-pink-900/20 border border-purple-200/60 dark:border-purple-700/60 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/50 dark:to-pink-900/50 shrink-0">
                <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-purple-800 dark:text-purple-300">Requests</p>
                <p className="text-xs sm:text-sm text-purple-600 dark:text-purple-400">
                  <span className="sm:hidden">Respond</span>
                  <span className="hidden sm:inline">Manage & Respond</span>
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-amber-50/80 to-orange-50/60 dark:from-amber-900/30 dark:to-orange-900/20 border border-amber-200/60 dark:border-amber-700/60 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/50 dark:to-orange-900/50 shrink-0">
                <Crown className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-amber-800 dark:text-amber-300">Leadership</p>
                <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-400">
                  <span className="sm:hidden">Lead</span>
                  <span className="hidden sm:inline">Lead & Inspire</span>
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main Content Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="rounded-xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm p-4 sm:p-6 md:p-8 hover:shadow-[0_12px_40px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition-all duration-300"
        >
          <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            <div className="lg:col-span-2 min-w-0">
              <GroupsManager studentDatabaseId={studentDatabaseId} studentSection={studentSection} />
            </div>
            <div className="min-w-0">
              <GroupRequestsPanel studentDatabaseId={studentDatabaseId} studentSection={studentSection} />
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
