"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StudentHeader } from "@/components/student-header"
import { QuizList } from "@/components/quiz-list"
import { QuizIssuesPanel } from "@/components/quiz-issues-panel"
import { motion } from "framer-motion"
import { AssessmentTypeProvider } from "@/context/assessment-type-context"

export default function StudentHomeworkPage() {
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
    <AssessmentTypeProvider assessmentType="homework">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 overflow-x-hidden">
        <StudentHeader />

        {/* Main Content */}
        <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-10 max-w-7xl overflow-x-hidden">
          {/* Page Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 sm:mb-8 md:mb-10 relative"
          >
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              <div className="relative shrink-0">
                <div className="p-2 sm:p-2.5 md:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-600 dark:from-teal-700 dark:to-cyan-700 shadow-lg">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-teal-600 to-cyan-600 dark:from-teal-400 dark:to-cyan-400 bg-clip-text text-transparent">
                  <span className="sm:hidden">Homework</span>
                  <span className="hidden sm:inline md:hidden">Homework</span>
                  <span className="hidden md:inline">Homework Assignments</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5 sm:mt-1 break-words">
                  {studentName ? (
                    <>
                      <span className="sm:hidden">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{studentName}</span>
                      </span>
                      <span className="hidden sm:inline">
                        Stay on track, <span className="font-semibold text-slate-800 dark:text-slate-200">{studentName}</span> • Section {studentSection}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="sm:hidden">Complete assignments</span>
                      <span className="hidden sm:inline">Complete your homework assignments and track your progress</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Back Button - Floating to the right on mobile, full button on desktop */}
            <Button 
              onClick={() => router.push("/student/dashboard")} 
              variant="outline" 
              size="sm"
              className="absolute top-0 right-0 sm:hidden h-9 px-3 rounded-lg border-2 border-teal-200/60 dark:border-teal-700/60 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:bg-gradient-to-r hover:from-teal-50 hover:to-cyan-50 dark:hover:from-teal-900/30 dark:hover:to-cyan-900/30 hover:border-teal-400 dark:hover:border-teal-500 text-teal-700 dark:text-teal-300 shadow-md hover:shadow-lg transition-all duration-200 gap-1.5"
              title="Back to Dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-xs font-medium">Back</span>
            </Button>
            
            <Button 
              onClick={() => router.push("/student/dashboard")} 
              variant="outline" 
              size="lg"
              className="hidden sm:flex absolute top-0 right-0 rounded-xl border-2 border-teal-200/60 dark:border-teal-700/60 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:bg-gradient-to-r hover:from-teal-50 hover:to-cyan-50 dark:hover:from-teal-900/30 dark:hover:to-cyan-900/30 hover:border-teal-400 dark:hover:border-teal-500 text-teal-700 dark:text-teal-300 transition-all duration-200 shadow-lg hover:shadow-xl text-sm md:text-base px-3 md:px-4 shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 sm:gap-6 md:gap-8">
            {/* Homework List */}
            <div className="lg:col-span-7 order-2 lg:order-1">
              <div className="rounded-xl sm:rounded-2xl border border-teal-200/60 dark:border-teal-700/60 shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm p-4 sm:p-6 md:p-8 hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] transition-all duration-300">
                <QuizList assessmentType="homework" />
              </div>
            </div>

            {/* Issues Panel */}
            <div className="lg:col-span-3 order-1 lg:order-2">
              <QuizIssuesPanel assessmentType="homework" />
            </div>
          </div>
        </main>
      </div>
    </AssessmentTypeProvider>
  )
}
