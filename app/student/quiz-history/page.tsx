"use client"

import { useEffect, useState } from "react"
import { QuizHistory } from "@/components/quiz-history"
import { History, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { StudentHeader } from "@/components/student-header"
import { ViewToggle } from "@/components/ui/view-toggle"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { motion } from "framer-motion"

export default function QuizHistoryPage() {
  const router = useRouter()
  const [studentName, setStudentName] = useState("")
  const [studentSection, setStudentSection] = useState("")
  const [view, setView] = usePersistedState<"grid" | "list">("quiz-history-view", "list")

  useEffect(() => {
    const name = sessionStorage.getItem("studentName")
    const section = sessionStorage.getItem("studentSection")

    setStudentName(name || "")
    setStudentSection(section || "")
  }, [])
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <StudentHeader />

      {/* Main Content */}
      <main className="container mx-auto px-6 py-10 max-w-7xl">
        {/* Page Header - Unified Design */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between flex-wrap gap-4 mb-10"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-800 shadow-lg">
              <History className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-indigo-800 bg-clip-text text-transparent">
                History
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
                {studentName ? (
                  <>
                    Track your progress, <span className="font-semibold text-slate-800 dark:text-slate-200">{studentName}</span> • Section {studentSection}
                  </>
                ) : (
                  "Quizzes, homework, mid-semester, finals — your attempts and updated grades"
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ViewToggle view={view} onViewChange={setView} />
            <Button 
              onClick={() => router.push("/student/dashboard")} 
              variant="outline" 
              className="gap-2 rounded-full bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-700/80"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Button>
          </div>
        </motion.div>

        {/* History Component */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <QuizHistory view={view} />
        </motion.div>
      </main>
    </div>
  )
}
