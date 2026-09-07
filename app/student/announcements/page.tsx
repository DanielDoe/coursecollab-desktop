"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Megaphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StudentHeader } from "@/components/student-header"
import { AnnouncementsFeedRedesign } from "@/components/announcements-feed-redesign"
import { motion } from "framer-motion"

export default function StudentAnnouncementsPage() {
  const router = useRouter()
  const [studentId, setStudentId] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const studentSession = localStorage.getItem("studentSession")
    if (!studentSession) {
      router.push("/student/login")
      return
    }

    try {
      const session = JSON.parse(studentSession)
      // Get the database ID from sessionStorage (set during login)
      const databaseId = sessionStorage.getItem("studentDatabaseId")
      
      if (databaseId) {
        setStudentId(databaseId)
      } else {
        // Fallback: try to get from session object
        setStudentId(session.databaseId?.toString() || session.id?.toString() || "")
      }
      setLoading(false)
    } catch (error) {
      console.error("Failed to parse student session:", error)
      router.push("/student/login")
    }
  }, [router])

  const handleViewDetails = (announcementId: number) => {
    // Modal is handled by AnnouncementsFeedRedesign component
    // This callback is kept for compatibility but no longer needed
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50 dark:from-slate-900 dark:via-slate-800 dark:to-rose-950">
        <StudentHeader />
        <div className="flex items-center justify-center min-h-[60vh] px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-6 sm:space-y-8"
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
              className="w-full h-full rounded-full bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600 dark:from-rose-600 dark:via-pink-600 dark:to-purple-700 shadow-2xl shadow-rose-500/30 dark:shadow-rose-600/40 flex items-center justify-center"
            >
              <Megaphone className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
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
                className="absolute w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gradient-to-r from-rose-400 to-pink-400 dark:from-rose-500 dark:to-pink-500 rounded-full"
                style={{
                  left: `${20 + (i * 12)}%`,
                  top: `${30 + (i % 2) * 20}%`
                }}
              />
            ))}
          </div>

          {/* Loading Text */}
          <div className="space-y-2 sm:space-y-3">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 dark:from-rose-400 dark:via-pink-400 dark:to-purple-400 bg-clip-text text-transparent break-words"
            >
              <span className="sm:hidden">Loading...</span>
              <span className="hidden sm:inline">Loading Announcements</span>
            </motion.h2>
            
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words">
              <span className="sm:hidden">Preparing...</span>
              <span className="hidden sm:inline">Preparing your updates...</span>
            </p>

            {/* Progress dots */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="flex justify-center gap-1.5 sm:gap-2"
            >
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.3, 1, 0.3]
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2
                  }}
                  className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gradient-to-r from-rose-500 to-pink-500 dark:from-rose-400 dark:to-pink-400 rounded-full"
                />
              ))}
            </motion.div>
          </div>
        </motion.div>
        </div>
      </div>
    )
  }

  if (!studentId) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <StudentHeader />
      
      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-10 max-w-7xl">
        {/* Page Header - Matching CourseCollab Style */}
        <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4 mb-6 sm:mb-8 md:mb-10 relative">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
            <div className="p-2 sm:p-2.5 md:p-3 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-600 via-pink-600 to-purple-700 dark:from-purple-700 dark:via-pink-700 dark:to-purple-800 shadow-lg shrink-0">
              <Megaphone className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-600 via-pink-600 to-purple-700 dark:from-purple-400 dark:via-pink-400 dark:to-purple-500 bg-clip-text text-transparent break-words">
                <span className="sm:hidden">Announce</span>
                <span className="hidden sm:inline">Announcements</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5 sm:mt-1 break-words">
                <span className="sm:hidden">Course updates</span>
                <span className="hidden sm:inline md:hidden">Course info & updates</span>
                <span className="hidden md:inline">Stay updated with important course information and updates</span>
              </p>
            </div>
          </div>

          <Button 
            onClick={() => router.push("/student/dashboard")} 
            variant="outline" 
            size="sm"
            className="gap-1.5 sm:gap-2 rounded-lg sm:rounded-full bg-white/80 dark:bg-slate-800/80 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 hover:border-purple-400 dark:hover:border-purple-600 hover:text-purple-800 dark:hover:text-purple-200 transition-all text-xs sm:text-sm h-8 sm:h-9 md:h-10 px-2 sm:px-3 md:px-4 shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="sm:hidden">Back</span>
            <span className="hidden sm:inline">Back to Dashboard</span>
          </Button>
        </div>

        {/* Announcements Feed */}
        <AnnouncementsFeedRedesign 
          studentId={studentId} 
          onViewDetails={handleViewDetails}
        />
      </main>
    </div>
  )
}

