"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getStudentData } from "@/lib/auth"
import { StudentHeader } from "@/components/student-header"
import { StudentCalendar } from "@/components/student-calendar"
import { motion } from "framer-motion"
import { Calendar, Sparkles, Loader2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function StudentCalendarPage() {
  const router = useRouter()
  const [studentData, setStudentData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const student = getStudentData()
    if (!student) {
      router.push("/student/login")
      return
    }
    setStudentData(student)
    setLoading(false)
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950">
        <StudentHeader />
        <div className="flex items-center justify-center min-h-[60vh] px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center space-y-5 sm:space-y-6"
          >
            {/* Animated Icon */}
            <div className="relative mx-auto w-20 h-20 sm:w-24 sm:h-24">
              <motion.div
                animate={{ 
                  rotate: 360,
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                  scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                }}
                className="w-full h-full rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-600 dark:from-indigo-600 dark:via-purple-600 dark:to-pink-700 shadow-2xl shadow-indigo-500/30 dark:shadow-indigo-600/40 flex items-center justify-center"
              >
                <Calendar className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
              </motion.div>
              
              {/* Floating particles */}
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    y: [-20, -40, -20],
                    opacity: [0.3, 1, 0.3],
                    scale: [0.8, 1.2, 0.8]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut"
                  }}
                  className="absolute w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gradient-to-r from-indigo-400 to-purple-400 dark:from-indigo-500 dark:to-purple-500 rounded-full"
                  style={{
                    left: `${20 + (i * 12)}%`,
                    top: `${30 + (i % 2) * 20}%`
                  }}
                />
              ))}
            </div>

            {/* Loading Text */}
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent break-words"
            >
              <span className="sm:hidden">Loading...</span>
              <span className="hidden sm:inline">Loading Your Calendar</span>
            </motion.h2>
            
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="flex items-center justify-center gap-1"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -10, 0] }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: i * 0.2
                  }}
                  className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-indigo-600 dark:bg-indigo-400 rounded-full"
                />
              ))}
            </motion.div>

            <div className="flex items-center justify-center gap-1.5 sm:gap-2 text-slate-600 dark:text-slate-400 mt-3 sm:mt-4">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
              <span className="text-xs sm:text-sm break-words">
                <span className="sm:hidden">Preparing schedule...</span>
                <span className="hidden sm:inline">Preparing your personalized schedule...</span>
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950">
      <StudentHeader />
      
      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-10 max-w-7xl">
        {/* Page Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4 mb-6 sm:mb-8 md:mb-10 relative">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
            <div className="p-2 sm:p-2.5 md:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-800 dark:from-indigo-700 dark:to-purple-900 shadow-lg shrink-0">
              <Calendar className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-purple-800 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent break-words">
                <span className="sm:hidden">Calendar</span>
                <span className="hidden sm:inline">My Calendar</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5 sm:mt-1 break-words">
                {studentData?.name ? (
                  <>
                    <span className="sm:hidden">Stay organized • AI planning</span>
                    <span className="hidden sm:inline md:hidden">Stay organized, <span className="font-semibold text-slate-800 dark:text-slate-200">{studentData.name}</span> • AI planning</span>
                    <span className="hidden md:inline">Stay organized, <span className="font-semibold text-slate-800 dark:text-slate-200">{studentData.name}</span> • AI-powered study planning</span>
                  </>
                ) : (
                  <>
                    <span className="sm:hidden">AI study schedule</span>
                    <span className="hidden sm:inline">Manage your study schedule with AI assistance</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <Button 
            onClick={() => router.push("/student/dashboard")} 
            variant="outline" 
            size="sm"
            className="gap-1.5 sm:gap-2 rounded-lg sm:rounded-full bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 text-xs sm:text-sm h-8 sm:h-9 md:h-10 px-2 sm:px-3 md:px-4 shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="sm:hidden">Back</span>
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Button>
        </div>

        {studentData?.databaseId && <StudentCalendar studentId={studentData.databaseId} />}
      </main>
    </div>
  )
}

