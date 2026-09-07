"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Trophy } from "lucide-react"
import { ProjectLeaderboard } from "@/components/project-leaderboard"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { getStudentModuleTheme, studentModuleSpinnerClass } from "@/lib/student-module-themes"
import { cn } from "@/lib/utils"

const projectsTheme = getStudentModuleTheme("projects")

export default function DashboardV2ProjectsLeaderboardPage() {
  const router = useRouter()
  const [studentSection, setStudentSection] = useState("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const dbId = sessionStorage.getItem("studentDatabaseId")
    const id = sessionStorage.getItem("studentId")
    const section = sessionStorage.getItem("studentSection")

    if (!id || !dbId) {
      router.push("/student/login")
      return
    }

    setStudentSection(section || "")
    setMounted(true)
  }, [router])

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className={cn("animate-spin rounded-full h-10 w-10 border-2 border-slate-200 dark:border-slate-700", studentModuleSpinnerClass("projects"))} />
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
      <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] shadow-sm p-3 sm:p-4 md:p-5 lg:p-6 dark:shadow-elevation-1">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-xl shrink-0", projectsTheme.page.iconBg)}>
              <Trophy className={cn("h-5 w-5", projectsTheme.page.iconText)} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-200">
                Project Leaderboard
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Top projects by engagement and votes
              </p>
            </div>
          </div>
        </div>

        <ProjectLeaderboard
          currentSession={studentSection}
          onProjectClick={(projectId) => {
            router.push(`/student/dashboard-v2/projects?highlight=${projectId}`)
          }}
          embedInDashboard
        />
      </div>
    </motion.div>
  )
}
