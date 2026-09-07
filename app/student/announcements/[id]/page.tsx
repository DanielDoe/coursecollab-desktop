"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, Megaphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnnouncementDetailView } from "@/components/announcement-detail-view"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { motion } from "framer-motion"

interface Announcement {
  id: number
  title: string
  content: string
  author_name?: string
  author_email?: string
  pinned: boolean
  views_count: number
  reactions_count: number
  reactions_breakdown?: Record<string, number>
  my_reaction?: string | null
  created_at: string
  updated_at: string
  attachments?: Array<{ name: string; url: string; type: string }>
}

export default function AnnouncementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [studentId, setStudentId] = useState<string>("")
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [announcementId, setAnnouncementId] = useState<string>("")

  useEffect(() => {
    params.then(({ id }) => {
      setAnnouncementId(id)
    })
  }, [params])

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
        const id = session.databaseId?.toString() || session.id?.toString() || ""
        setStudentId(id)
      }
    } catch (error) {
      console.error("Failed to parse student session:", error)
      router.push("/student/login")
    }
  }, [router])

  useEffect(() => {
    if (studentId && announcementId) {
      fetchAnnouncement()
    }
  }, [studentId, announcementId])

  const fetchAnnouncement = async (retryCount = 0): Promise<void> => {
    try {
      setLoading(true)
      const response = await studentApiFetch(`/api/announcements/${announcementId}?studentId=${studentId}`)
      const data = await response.json()

      if (!response.ok) {
        // If it's a 500 error and we haven't retried yet, try again
        if (response.status === 500 && retryCount < 2) {
          console.log(`[Announcement Detail] Retrying fetch (attempt ${retryCount + 1}/2)...`)
          await new Promise(resolve => setTimeout(resolve, 1500))
          return fetchAnnouncement(retryCount + 1)
        }
        throw new Error(data.error || 'Failed to fetch announcement')
      }

      setAnnouncement(data.announcement)
      setError(null)
    } catch (error) {
      console.error("Error fetching announcement:", error)
      
      // Only set error after all retries fail
      if (retryCount >= 2) {
        setError(error instanceof Error ? error.message : 'Failed to load announcement')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleReactionChange = (reaction: string | null) => {
    // Optimistically update the UI
    if (announcement) {
      setAnnouncement({
        ...announcement,
        my_reaction: reaction
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50 dark:from-slate-900 dark:via-slate-800 dark:to-rose-950 flex items-center justify-center px-4">
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
              <span className="hidden sm:inline">Loading Announcement</span>
            </motion.h2>
            
            {/* Progress dots */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
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
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50 dark:from-slate-900 dark:via-slate-800 dark:to-rose-950 flex items-center justify-center px-4 py-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full space-y-3 sm:space-y-4"
        >
          <Alert variant="destructive" className="p-3 sm:p-4">
            <AlertTitle className="text-sm sm:text-base break-words">Error</AlertTitle>
            <AlertDescription className="text-xs sm:text-sm break-words">{error}</AlertDescription>
          </Alert>
          <Button 
            variant="outline" 
            size="sm"
            className="w-full gap-1.5 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9 md:h-10"
            onClick={() => router.push("/student/announcements")}
          >
            <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="sm:hidden">Back</span>
            <span className="hidden sm:inline">Back to Announcements</span>
          </Button>
        </motion.div>
      </div>
    )
  }

  if (!announcement) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50 dark:from-slate-900 dark:via-slate-800 dark:to-rose-950 flex items-center justify-center px-4 py-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full space-y-3 sm:space-y-4"
        >
          <Alert className="p-3 sm:p-4">
            <AlertTitle className="text-sm sm:text-base break-words">Not Found</AlertTitle>
            <AlertDescription className="text-xs sm:text-sm break-words">
              <span className="sm:hidden">Announcement not found</span>
              <span className="hidden sm:inline">This announcement could not be found.</span>
            </AlertDescription>
          </Alert>
          <Button 
            variant="outline" 
            size="sm"
            className="w-full gap-1.5 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9 md:h-10"
            onClick={() => router.push("/student/announcements")}
          >
            <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="sm:hidden">Back</span>
            <span className="hidden sm:inline">Back to Announcements</span>
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50 dark:from-slate-900 dark:via-slate-800 dark:to-rose-950">
      <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-10 space-y-4 sm:space-y-6">
        {/* Back Button - Positioned on the Right */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex justify-end"
        >
          <Button 
            variant="outline"
            size="sm"
            onClick={() => router.push("/student/announcements")}
            className="gap-1.5 sm:gap-2 border-2 border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all duration-200 text-xs sm:text-sm h-8 sm:h-9 md:h-10 px-2 sm:px-3 md:px-4"
            title="Back to Announcements"
          >
            <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
            <span className="sm:hidden">Back</span>
            <span className="hidden sm:inline">Back to Announcements</span>
          </Button>
        </motion.div>

        {/* Announcement Detail */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <AnnouncementDetailView
            announcement={announcement}
            studentId={studentId}
            onReactionChange={handleReactionChange}
          />
        </motion.div>
      </div>
    </div>
  )
}

