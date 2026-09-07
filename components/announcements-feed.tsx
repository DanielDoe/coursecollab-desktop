"use client"


import { studentApiFetch } from "@/lib/auth"
import { useState, useEffect } from "react"
import { AnnouncementCard } from "./announcement-card"
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Megaphone, Sparkles, Zap } from "lucide-react"
import { motion } from "framer-motion"

interface Announcement {
  id: number
  title: string
  content: string
  author_name?: string
  pinned: boolean
  views_count: number
  reactions_count: number
  reactions_breakdown?: Record<string, number>
  created_at: string
  updated_at: string
  attachments?: Array<{ name: string; url: string; type: string }>
  viewed_by_me?: boolean
  my_reaction?: string | null
}

interface AnnouncementsFeedProps {
  studentId: string
  onViewDetails?: (announcementId: number) => void
}

export function AnnouncementsFeed({ studentId, onViewDetails }: AnnouncementsFeedProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAnnouncements()
  }, [studentId])

  const fetchAnnouncements = async (retryCount = 0): Promise<void> => {
    try {
      setLoading(true)
      const response = await studentApiFetch(`/api/announcements?studentId=${studentId}`)
      const data = await response.json()

      if (!response.ok) {
        // If it's a 500 error and we haven't retried yet, try again
        if (response.status === 500 && retryCount < 2) {
          console.log(`[Announcements] Retrying fetch (attempt ${retryCount + 1}/2)...`)
          await new Promise(resolve => setTimeout(resolve, 1500))
          return fetchAnnouncements(retryCount + 1)
        }
        throw new Error(data.error || 'Failed to fetch announcements')
      }

      setAnnouncements(data.announcements)
      setError(null)
    } catch (error) {
      console.error('Error fetching announcements:', error)
      
      // Only set error after all retries fail
      if (retryCount >= 2) {
        setError(error instanceof Error ? error.message : 'Failed to load announcements')
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="overflow-hidden">
              <CardHeader className="space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
                <div className="flex gap-2 mt-4">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-8 w-24" />
              </CardFooter>
            </Card>
          </motion.div>
        ))}
        
        {/* Loading indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center justify-center gap-3 py-8"
        >
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 1, 0.3]
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2
                }}
                className="w-2 h-2 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full"
              />
            ))}
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">
            Loading announcements...
          </span>
        </motion.div>
      </div>
    )
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <Alert variant="destructive" className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <Megaphone className="size-4" />
          <AlertTitle className="text-red-800 dark:text-red-200">Connection Error</AlertTitle>
          <AlertDescription className="text-red-700 dark:text-red-300">
            {error}
          </AlertDescription>
        </Alert>
      </motion.div>
    )
  }

  if (announcements.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <Card className="border-2 border-dashed border-slate-300 dark:border-slate-700 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
          <CardContent className="text-center py-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-950 dark:to-pink-950 flex items-center justify-center">
                <Megaphone className="w-10 h-10 text-rose-500" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                  No Announcements Yet
                </h3>
                <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                  There are no announcements at the moment. Check back later for updates!
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-500">
                <Sparkles className="w-4 h-4 animate-pulse" />
                <span className="text-sm">New announcements will appear here</span>
                <Zap className="w-4 h-4 animate-pulse" />
              </div>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // Separate pinned and regular announcements
  const pinnedAnnouncements = announcements.filter(a => a.pinned)
  const regularAnnouncements = announcements.filter(a => !a.pinned)

  return (
    <div className="space-y-6">
      {/* Pinned Announcements */}
      {pinnedAnnouncements.map((announcement, index) => (
        <motion.div
          key={announcement.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <AnnouncementCard
            announcement={announcement}
            variant="student"
            onView={() => onViewDetails?.(announcement.id)}
          />
        </motion.div>
      ))}

      {/* Divider */}
      {pinnedAnnouncements.length > 0 && regularAnnouncements.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="relative"
        >
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-200 dark:border-slate-700" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white dark:bg-slate-800 px-4 text-slate-500 dark:text-slate-400 font-medium">
              Earlier Announcements
            </span>
          </div>
        </motion.div>
      )}

      {/* Regular Announcements */}
      {regularAnnouncements.map((announcement, index) => (
        <motion.div
          key={announcement.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: (pinnedAnnouncements.length + index) * 0.1 }}
        >
          <AnnouncementCard
            announcement={announcement}
            variant="student"
            onView={() => onViewDetails?.(announcement.id)}
          />
        </motion.div>
      ))}
    </div>
  )
}

