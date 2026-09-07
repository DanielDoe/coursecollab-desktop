"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { QuizList } from "@/components/quiz-list"
import { QuizIssuesPanel } from "@/components/quiz-issues-panel"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StudentHeader } from "@/components/student-header"

export default function StudentQuizzesPage() {
  const router = useRouter()
  const [studentName, setStudentName] = useState("")
  const [studentSection, setStudentSection] = useState("")

  useEffect(() => {
    const name = sessionStorage.getItem("studentName")
    const section = sessionStorage.getItem("studentSection")

    setStudentName(name || "")
    setStudentSection(section || "")
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 overflow-x-hidden">
      <StudentHeader />

          {/* Main Content */}
          <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-10 max-w-7xl overflow-x-hidden">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6 sm:mb-8 md:mb-10 relative">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
            <div className="p-2 sm:p-2.5 md:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-800 shadow-lg shrink-0">
              <svg className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-indigo-800 bg-clip-text text-transparent break-words">
                <span className="sm:hidden">Quizzes</span>
                <span className="hidden sm:inline">Quizzes</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5 sm:mt-1 break-words">
                {studentName ? (
                  <>
                    <span className="sm:hidden">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{studentName}</span>
                    </span>
                    <span className="hidden sm:inline">
                      Welcome back, <span className="font-semibold text-slate-800 dark:text-slate-200">{studentName}</span> • Section {studentSection}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="sm:hidden">Explore quizzes</span>
                    <span className="hidden sm:inline">Explore available quizzes below</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <Button 
            onClick={() => router.push("/student/dashboard")} 
            variant="outline" 
            size="sm"
            className="gap-1.5 sm:gap-2 rounded-lg sm:rounded-full bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 text-xs sm:text-sm h-9 sm:h-10 w-full sm:w-auto shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="sm:hidden">Back</span>
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Button>
        </div>

            <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 sm:gap-6 md:gap-8">
              {/* Quiz List */}
              <div className="lg:col-span-7 order-2 lg:order-1">
                <div className="rounded-xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm p-4 sm:p-6 md:p-8 hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] transition-all duration-300">
                  <QuizList />
                </div>
              </div>

              {/* Issues Panel */}
              <div className="lg:col-span-3 order-1 lg:order-2">
                <QuizIssuesPanel />
              </div>
            </div>
      </main>
    </div>
  )
}
