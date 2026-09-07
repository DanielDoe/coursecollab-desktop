"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Eye, Pin, Calendar, User, Download, FileText, Image, Video } from "lucide-react"
import { ReactionBar } from "./reaction-bar"
import { AnnouncementComments } from "./announcement-comments"
import { Separator } from "@/components/ui/separator"
import { motion } from "framer-motion"
import { AnnouncementContent } from "@/components/announcements/AnnouncementContent"
import { AnnouncementAttachmentActions } from "@/components/announcements/AnnouncementAttachmentActions"

interface Announcement {
  id: number
  title: string
  content: string
  author_name?: string
  author_email?: string
  pinned: boolean
  allow_reactions: boolean
  allow_comments: boolean
  views_count: number
  reactions_count: number
  reactions_breakdown?: Record<string, number>
  my_reaction?: string | null
  created_at: string
  updated_at: string
  attachments?: Array<{ name: string; url: string; type: string }>
}

interface AnnouncementDetailViewProps {
  announcement: Announcement
  studentId: string
  onReactionChange?: (reaction: string | null) => void
}

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return Image
  if (type.startsWith('video/')) return Video
  return FileText
}

export function AnnouncementDetailView({ 
  announcement, 
  studentId,
  onReactionChange 
}: AnnouncementDetailViewProps) {
  const [viewsCount, setViewsCount] = useState(Number(announcement.views_count ?? 0))

  useEffect(() => {
    setViewsCount(Number(announcement.views_count ?? 0))
  }, [announcement.id, announcement.views_count])
  
  // Record view when component mounts
  useEffect(() => {
    const recordView = async () => {
      try {
        const response = await studentApiFetch(`/api/announcements/${announcement.id}/view`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ studentId })
        })
        const data = await response.json()
        if (response.ok && typeof data.totalViews === "number") {
          setViewsCount(data.totalViews)
        }
      } catch (error) {
        console.error('Error recording view:', error)
      }
    }

    recordView()
  }, [announcement.id, studentId])

  // Enhanced content formatting with markdown-like rendering
  const formatContent = (content: string) => {
    return content.split('\n\n').map((paragraph, pIndex) => {
      // Handle bold text (**text**)
      let formatted = paragraph.split(/(\*\*.*?\*\*)/).map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index}>{part.slice(2, -2)}</strong>
        }
        return part
      })

      // Check if it's a list item
      if (paragraph.trim().startsWith('-')) {
        const lines = paragraph.split('\n')
        return (
          <ul key={pIndex} className="list-disc list-inside space-y-2 mb-4">
            {lines.map((line, lIndex) => (
              <li key={lIndex} className="text-slate-700 dark:text-slate-300">
                {line.trim().substring(1).trim()}
              </li>
            ))}
          </ul>
        )
      }

      return (
        <p key={pIndex} className="mb-4 last:mb-0 text-slate-700 dark:text-slate-300 leading-relaxed">
          {formatted}
        </p>
      )
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-4xl mx-auto px-4 sm:px-6"
    >
      <Card className={`overflow-hidden border-0 shadow-2xl ${
        announcement.pinned 
          ? 'bg-sky-50/50 dark:bg-sky-950/20' 
          : 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'
      }`}>
        {/* Pinned Banner */}
        {announcement.pinned && (
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            className="bg-sky-600 dark:bg-sky-600 px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 flex items-center gap-1.5 sm:gap-2 text-white text-xs sm:text-sm"
          >
            <Pin className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 shrink-0" />
            <span className="font-semibold break-words">
              <span className="sm:hidden">Pinned</span>
              <span className="hidden sm:inline">Pinned Announcement</span>
            </span>
          </motion.div>
        )}

        <CardHeader className="space-y-4 sm:space-y-5 md:space-y-6 p-4 sm:p-6 md:p-8">
          {/* Author & Date Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4 text-xs sm:text-sm"
          >
            {announcement.author_name && (
              <>
                <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-slate-100 dark:bg-slate-700 shrink-0">
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600 dark:text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-700 dark:text-slate-300 break-words">
                    {announcement.author_name}
                  </span>
                </div>
              </>
            )}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-slate-100 dark:bg-slate-700 shrink-0">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600 dark:text-slate-400 shrink-0" />
              <span className="text-slate-700 dark:text-slate-300 break-words">
                {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
              </span>
            </div>
            {announcement.updated_at !== announcement.created_at && (
              <Badge variant="outline" className="text-[10px] sm:text-xs px-2 py-0.5 shrink-0">
                Edited
              </Badge>
            )}
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <CardTitle className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 leading-tight break-words">
              {announcement.title}
            </CardTitle>
          </motion.div>

          {/* Stats Bar */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-4 sm:gap-5 md:gap-6 pt-3 sm:pt-4 border-t border-slate-200 dark:border-slate-700 flex-wrap"
          >
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 dark:text-blue-400 shrink-0" />
              <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 break-words">
                {viewsCount} <span className="hidden sm:inline">{viewsCount === 1 ? 'view' : 'views'}</span>
              </span>
            </div>
            {announcement.reactions_count > 0 && (
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <span className="text-xl sm:text-2xl">❤️</span>
                <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 break-words">
                  {announcement.reactions_count} <span className="hidden sm:inline">{announcement.reactions_count === 1 ? 'reaction' : 'reactions'}</span>
                </span>
              </div>
            )}
          </motion.div>
        </CardHeader>

        <CardContent className="space-y-6 sm:space-y-7 md:space-y-8 px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8">
          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="prose prose-sm sm:prose-base md:prose-lg max-w-none dark:prose-invert"
          >
            <AnnouncementContent content={announcement.content} />
          </motion.div>

          {/* Attachments */}
          {announcement.attachments && announcement.attachments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-3 sm:space-y-4"
            >
              <Separator />
              
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-400 shrink-0" />
                  <h4 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-200 break-words">
                    Attachments ({announcement.attachments.length})
                  </h4>
                </div>
                
                <div className="grid gap-2 sm:gap-3">
                  {announcement.attachments.map((attachment, index) => {
                    const Icon = getFileIcon(attachment.type)
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 + index * 0.1 }}
                        className="group flex items-center justify-between p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-sky-50 dark:hover:bg-sky-950/20 hover:border-sky-300 dark:hover:border-sky-700 transition-all duration-200"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
                          <div className="p-2 sm:p-3 rounded-lg bg-white dark:bg-slate-700 shadow-sm group-hover:shadow-md transition-shadow duration-200 shrink-0">
                            <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600 dark:text-slate-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors duration-200 break-words">
                              {attachment.name}
                            </p>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-500 break-words">
                              {attachment.type}
                            </p>
                          </div>
                        </div>
                        <AnnouncementAttachmentActions attachment={attachment} />
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}

          <Separator />

          {/* Reaction Section */}
          {announcement.allow_reactions && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="space-y-3 sm:space-y-4"
            >
              <h4 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-200 break-words">
                <span className="sm:hidden">How do you feel?</span>
                <span className="hidden sm:inline">How do you feel about this announcement?</span>
              </h4>
              <ReactionBar
                announcementId={announcement.id}
                studentId={studentId}
                currentReaction={announcement.my_reaction}
                reactionsBreakdown={announcement.reactions_breakdown}
                onReactionChange={onReactionChange}
              />
            </motion.div>
          )}

          {/* Separator between reactions and comments */}
          {announcement.allow_reactions && announcement.allow_comments && <Separator />}

          {/* Comments Section */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <AnnouncementComments
              announcementId={announcement.id}
              studentId={studentId}
              allowComments={announcement.allow_comments}
            />
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
