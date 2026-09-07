"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Eye, Pin, Calendar, User, FileText, Image, Video, X, Maximize2, Minimize2, Lock, Sparkles } from "lucide-react"
import { ReactionBar } from "./reaction-bar"
import { AnnouncementComments } from "./announcement-comments"
import { Separator } from "@/components/ui/separator"
import { motion, AnimatePresence } from "framer-motion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AnnouncementContent } from "@/components/announcements/AnnouncementContent"
import { AnnouncementAttachmentActions } from "@/components/announcements/AnnouncementAttachmentActions"
import { ANNOUNCEMENT_STUDENT_LOCKED_MESSAGE } from "@/lib/announcement-student-lock"
import { cn } from "@/lib/utils"

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
  student_content_locked?: boolean
  attachment_count?: number
  ai_summary?: string | null
}

interface AnnouncementDetailModalProps {
  announcement: Announcement | null
  studentId?: string
  instructorId?: string
  viewerMode?: "student" | "instructor"
  isOpen: boolean
  onClose: () => void
  onReactionChange?: (reaction: string | null) => void
  onViewCountChange?: (announcementId: number, totalViews: number) => void
}

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return Image
  if (type.startsWith('video/')) return Video
  return FileText
}

export function AnnouncementDetailModal({ 
  announcement, 
  studentId,
  instructorId,
  viewerMode = studentId ? "student" : "instructor",
  isOpen,
  onClose,
  onReactionChange,
  onViewCountChange,
}: AnnouncementDetailModalProps) {
  const [localAnnouncement, setLocalAnnouncement] = useState<Announcement | null>(announcement)
  const [isLoading, setIsLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const isInstructorView = viewerMode === "instructor"
  const actorId = isInstructorView ? instructorId : studentId

  // Update local state when announcement prop changes
  useEffect(() => {
    setLocalAnnouncement(announcement)
  }, [announcement])

  // Fetch announcement details when modal opens
  useEffect(() => {
    if (isOpen && announcement && actorId) {
      fetchAnnouncementDetails()
    }
  }, [isOpen, announcement?.id, actorId, isInstructorView])

  useEffect(() => {
    if (!isOpen) {
      setIsExpanded(false)
    }
  }, [isOpen])

  const fetchAnnouncementDetails = async () => {
    if (!announcement || !actorId) return
    
    try {
      setIsLoading(true)
      const query = isInstructorView
        ? `instructorId=${encodeURIComponent(actorId)}`
        : `studentId=${encodeURIComponent(actorId)}`
      const response = await studentApiFetch(`/api/announcements/${announcement.id}?${query}`)
      const data = await response.json()

      if (response.ok && data.announcement) {
        setLocalAnnouncement({
          ...data.announcement,
          views_count: Number(data.announcement.views_count ?? 0),
          reactions_count: Number(data.announcement.reactions_count ?? 0),
        })
      }
    } catch (error) {
      console.error('Error fetching announcement details:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Record view when modal opens (students only)
  useEffect(() => {
    if (isOpen && localAnnouncement && studentId && !isInstructorView) {
      const recordView = async () => {
        try {
          const response = await studentApiFetch(`/api/announcements/${localAnnouncement.id}/view`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ studentId })
          })
          const data = await response.json()
          if (response.ok && typeof data.totalViews === "number") {
            setLocalAnnouncement((prev) =>
              prev ? { ...prev, views_count: data.totalViews } : prev,
            )
            onViewCountChange?.(localAnnouncement.id, data.totalViews)
          }
        } catch (error) {
          console.error('Error recording view:', error)
        }
      }

      recordView()
    }
  }, [isOpen, localAnnouncement?.id, studentId, isInstructorView, onViewCountChange])

  // Enhanced content formatting with markdown-like rendering
  const formatContent = (content: string) => {
    const lines = content.split('\n')
    const elements: JSX.Element[] = []
    let currentList: string[] = []
    let listType: 'ul' | 'ol' | null = null
    let keyCounter = 0

    const flushList = () => {
      if (currentList.length > 0) {
        const ListTag = listType === 'ol' ? 'ol' : 'ul'
        elements.push(
          <ListTag 
            key={`list-${keyCounter++}`} 
            className={listType === 'ol' 
              ? "list-decimal list-inside space-y-3 mb-6 ml-6 marker:text-sky-600 dark:marker:text-sky-400 marker:font-semibold"
              : "list-disc list-inside space-y-3 mb-6 ml-6 marker:text-sky-600 dark:marker:text-sky-400"
            }
          >
            {currentList.map((item, idx) => {
              const formattedItem = formatInlineText(item.trim())
              return (
                <li key={idx} className="text-slate-700 dark:text-slate-300 leading-relaxed pl-3">
                  {formattedItem}
                </li>
              )
            })}
          </ListTag>
        )
        currentList = []
        listType = null
      }
    }

    const formatInlineText = (text: string): (string | JSX.Element)[] => {
      // Use a recursive approach to handle nested formatting properly
      const result: (string | JSX.Element)[] = []
      let lastIndex = 0
      const matches: Array<{ start: number; end: number; type: string; content: string; url?: string }> = []

      // Find all matches in order of priority (most specific first)
      // Links [text](url)
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
      let match
      while ((match = linkRegex.exec(text)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          type: 'link',
          content: match[1],
          url: match[2]
        })
      }

      // Code `code`
      const codeRegex = /`([^`]+)`/g
      while ((match = codeRegex.exec(text)) !== null) {
        // Only add if not overlapping with a link
        if (!matches.some(m => m.start <= match.index && m.end >= match.index + match[0].length)) {
          matches.push({
            start: match.index,
            end: match.index + match[0].length,
            type: 'code',
            content: match[1]
          })
        }
      }

      // Bold **text**
      const boldRegex = /\*\*([^*]+)\*\*/g
      while ((match = boldRegex.exec(text)) !== null) {
        // Only add if not overlapping with code or link
        if (!matches.some(m => 
          (m.start <= match.index && m.end > match.index) ||
          (m.start < match.index + match[0].length && m.end >= match.index + match[0].length)
        )) {
          matches.push({
            start: match.index,
            end: match.index + match[0].length,
            type: 'bold',
            content: match[1]
          })
        }
      }

      // Italic *text* (not part of **)
      const italicRegex = /(?<!\*)\*([^*]+)\*(?!\*)/g
      while ((match = italicRegex.exec(text)) !== null) {
        // Only add if not overlapping with other matches
        if (!matches.some(m => 
          (m.start <= match.index && m.end > match.index) ||
          (m.start < match.index + match[0].length && m.end >= match.index + match[0].length)
        )) {
          matches.push({
            start: match.index,
            end: match.index + match[0].length,
            type: 'italic',
            content: match[1]
          })
        }
      }

      // Sort matches by start position
      matches.sort((a, b) => a.start - b.start)

      // Build result array
      matches.forEach((m, idx) => {
        // Add text before match
        if (m.start > lastIndex) {
          const beforeText = text.substring(lastIndex, m.start)
          if (beforeText) {
            result.push(beforeText)
          }
        }

        // Add formatted element
        switch (m.type) {
          case 'link':
            result.push(
              <a 
                key={`link-${keyCounter++}`} 
                href={m.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 underline font-semibold transition-colors decoration-2 underline-offset-2"
              >
                {m.content}
              </a>
            )
            break
          case 'code':
            result.push(
              <code key={`code-${keyCounter++}`} className="px-2 py-1 bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 rounded-md text-sm font-mono border border-sky-200 dark:border-sky-800">
                {m.content}
              </code>
            )
            break
          case 'bold':
            result.push(
              <strong key={`bold-${keyCounter++}`} className="font-bold text-slate-900 dark:text-slate-100">
                {m.content}
              </strong>
            )
            break
          case 'italic':
            result.push(
              <em key={`italic-${keyCounter++}`} className="italic text-slate-600 dark:text-slate-400">
                {m.content}
              </em>
            )
            break
        }

        lastIndex = m.end
      })

      // Add remaining text
      if (lastIndex < text.length) {
        result.push(text.substring(lastIndex))
      }

      return result.length > 0 ? result : [text]
    }

    lines.forEach((line, lineIndex) => {
      const trimmedLine = line.trim()

      // Empty line - flush list and add spacing
      if (!trimmedLine) {
        flushList()
        if (elements.length > 0 && elements[elements.length - 1].type !== 'br') {
          elements.push(<br key={`br-${keyCounter++}`} />)
        }
        return
      }

      // Headers
      if (trimmedLine.startsWith('###')) {
        flushList()
        const headerText = trimmedLine.substring(3).trim()
        elements.push(
          <h3 key={`h3-${keyCounter++}`} className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-8 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
            {formatInlineText(headerText)}
          </h3>
        )
        return
      }
      if (trimmedLine.startsWith('##')) {
        flushList()
        const headerText = trimmedLine.substring(2).trim()
        elements.push(
          <h2 key={`h2-${keyCounter++}`} className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-10 mb-5 pb-3 border-b-2 border-sky-200 dark:border-sky-800">
            {formatInlineText(headerText)}
          </h2>
        )
        return
      }
      if (trimmedLine.startsWith('#')) {
        flushList()
        const headerText = trimmedLine.substring(1).trim()
        elements.push(
          <h1 key={`h1-${keyCounter++}`} className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-10 mb-6 pb-4 border-b-2 border-sky-300 dark:border-sky-700">
            {formatInlineText(headerText)}
          </h1>
        )
        return
      }

      // Horizontal rule
      if (trimmedLine.match(/^[-*_]{3,}$/)) {
        flushList()
        elements.push(
          <hr key={`hr-${keyCounter++}`} className="my-8 border-0 h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-600 to-transparent" />
        )
        return
      }

      // Blockquote
      if (trimmedLine.startsWith('>')) {
        flushList()
        const quoteText = trimmedLine.substring(1).trim()
        elements.push(
          <blockquote 
            key={`quote-${keyCounter++}`} 
            className="border-l-4 border-sky-500 dark:border-sky-400 pl-6 py-4 my-6 bg-sky-50/80 dark:bg-sky-950/30 rounded-r-xl italic text-slate-700 dark:text-slate-300 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl text-sky-500 dark:text-sky-400 leading-none">"</span>
              <div className="flex-1">{formatInlineText(quoteText)}</div>
            </div>
          </blockquote>
        )
        return
      }

      // Unordered list
      if (trimmedLine.match(/^[-*]\s/)) {
        if (listType !== 'ul') {
          flushList()
          listType = 'ul'
        }
        currentList.push(trimmedLine.substring(2))
        return
      }

      // Ordered list
      if (trimmedLine.match(/^\d+\.\s/)) {
        if (listType !== 'ol') {
          flushList()
          listType = 'ol'
        }
        currentList.push(trimmedLine.replace(/^\d+\.\s/, ''))
        return
      }

      // Regular paragraph
      flushList()
      const formattedText = formatInlineText(trimmedLine)
      elements.push(
        <p key={`p-${keyCounter++}`} className="mb-5 text-slate-700 dark:text-slate-300 leading-relaxed text-base">
          {formattedText}
        </p>
      )
    })

    // Flush any remaining list
    flushList()

    return elements
  }

  if (!localAnnouncement) return null

  const isLockedForStudents =
    !isInstructorView && localAnnouncement.student_content_locked === true
  const lockedAttachmentCount = Number(
    localAnnouncement.attachment_count ??
      localAnnouncement.attachments?.length ??
      0,
  )

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        className={cn(
          "p-0 overflow-hidden flex flex-col gap-0",
          "w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)]",
          "h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)]",
          "sm:w-[min(60rem,calc(100vw-2rem))] sm:max-w-[min(60rem,calc(100vw-2rem))]",
          "sm:h-[90vh] sm:max-h-[90vh]",
          isExpanded &&
            "!max-w-[calc(100vw-0.5rem)] !w-[calc(100vw-0.5rem)] h-[calc(100dvh-0.5rem)] max-h-[calc(100dvh-0.5rem)] sm:!max-w-[98vw] sm:!w-[98vw] sm:h-[96vh] sm:max-h-[96vh]",
          "transition-all duration-200",
        )}
        showCloseButton={false}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="flex flex-col h-full min-h-0">
          {/* Header */}
          <DialogHeader className="px-4 sm:px-4 md:px-6 pt-4 sm:pt-4 md:pt-6 pb-3 sm:pb-3 md:pb-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0 text-center sm:text-left">
            <div className="flex items-start justify-between gap-2 sm:gap-3 md:gap-4">
              <div className="flex-1 min-w-0 mx-auto sm:mx-0">
                {/* Pinned Badge */}
                {localAnnouncement.pinned && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-2 sm:mb-3 flex justify-center sm:justify-start"
                  >
                    <Badge className="bg-sky-600 dark:bg-sky-600 text-white text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1 border-0 shadow-sm shadow-sky-600/20">
                      <Pin className="w-3 h-3 mr-1 shrink-0" />
                      Pinned
                    </Badge>
                  </motion.div>
                )}
                {isInstructorView && localAnnouncement.student_content_locked && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-2 sm:mb-3 flex justify-center sm:justify-start"
                  >
                    <Badge className="bg-amber-500/15 text-amber-900 ring-1 ring-inset ring-amber-500/30 dark:bg-amber-500/15 dark:text-amber-100 text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1">
                      <Lock className="w-3 h-3 mr-1 shrink-0" />
                      Locked for students
                    </Badge>
                  </motion.div>
                )}
                {isLockedForStudents && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-2 sm:mb-3 flex justify-center sm:justify-start"
                  >
                    <Badge className="bg-amber-500/15 text-amber-900 ring-1 ring-inset ring-amber-500/30 dark:bg-amber-500/15 dark:text-amber-100 text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1">
                      <Lock className="w-3 h-3 mr-1 shrink-0" />
                      Locked
                    </Badge>
                  </motion.div>
                )}

                {/* Title */}
                <DialogTitle className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight mb-2 sm:mb-3 break-words">
                  {localAnnouncement.title}
                </DialogTitle>

                {/* Metadata */}
                <div className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 md:gap-3 text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex-wrap">
                  {localAnnouncement.author_name && (
                    <>
                      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                        <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                        <span className="font-medium break-words">{localAnnouncement.author_name}</span>
                      </div>
                      <span className="shrink-0">•</span>
                    </>
                  )}
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                    <span className="break-words">{formatDistanceToNow(new Date(localAnnouncement.created_at), { addSuffix: true })}</span>
                  </div>
                  {localAnnouncement.updated_at !== localAnnouncement.created_at && (
                    <>
                      <span className="shrink-0">•</span>
                      <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0 shrink-0">Edited</Badge>
                    </>
                  )}
                  <span className="shrink-0">•</span>
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                    <span className="break-words">{Number(localAnnouncement.views_count)} <span className="hidden sm:inline">views</span></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsExpanded((prev) => !prev)}
                  className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 h-7 w-7 sm:h-8 sm:w-8 md:h-10 md:w-10"
                  title={isExpanded ? "Exit expanded view" : "Expand for wider view"}
                >
                  {isExpanded ? (
                    <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 h-7 w-7 sm:h-8 sm:w-8 md:h-10 md:w-10"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable Content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full w-full">
              <div
                className={cn(
                  "mx-auto w-full px-4 sm:px-5 md:px-6 py-4 sm:py-5 md:py-6 space-y-5 sm:space-y-6",
                  isExpanded ? "max-w-5xl" : "max-w-2xl",
                )}
              >
            {localAnnouncement.ai_summary?.trim() ? (
              <div className="rounded-xl border border-sky-200/70 bg-sky-50/60 px-4 py-3 dark:border-sky-500/25 dark:bg-sky-950/25">
                <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  AI Summary
                </div>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                  {localAnnouncement.ai_summary}
                </p>
              </div>
            ) : null}

            {/* Main Content */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="w-full"
            >
              {isLockedForStudents ? (
                <div className="relative overflow-hidden rounded-xl border border-amber-200/60 bg-amber-50/50 p-6 dark:border-amber-500/20 dark:bg-amber-950/20">
                  <p className="select-none text-sm sm:text-base leading-relaxed text-slate-600 blur-[8px] dark:text-slate-400">
                    {localAnnouncement.content || ANNOUNCEMENT_STUDENT_LOCKED_MESSAGE}
                  </p>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/50 px-4 text-center dark:bg-slate-950/50">
                    <div className="space-y-2">
                      <Lock className="mx-auto h-8 w-8 text-amber-600 dark:text-amber-400" />
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                        Content hidden until your instructor unlocks this announcement
                      </p>
                      <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                        {ANNOUNCEMENT_STUDENT_LOCKED_MESSAGE}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <AnnouncementContent
                  content={localAnnouncement.content}
                  className="text-sm sm:text-base leading-relaxed break-words overflow-x-auto max-w-full text-left"
                />
              )}
            </motion.div>

            {/* Attachments */}
            {isLockedForStudents && lockedAttachmentCount > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-3 sm:space-y-4"
              >
                <Separator />
                <div className="rounded-xl border border-amber-200/60 bg-amber-50/40 p-4 text-center dark:border-amber-500/20 dark:bg-amber-950/20 sm:text-left">
                  <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start">
                    <Lock className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                        {lockedAttachmentCount} attachment{lockedAttachmentCount === 1 ? "" : "s"} locked
                      </p>
                      <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                        Files will be available after your instructor unlocks this announcement.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : localAnnouncement.attachments && localAnnouncement.attachments.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-3 sm:space-y-4"
              >
                <Separator />
                
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600 dark:text-slate-400 shrink-0" />
                    <h4 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-200 break-words">
                      Attachments ({localAnnouncement.attachments.length})
                    </h4>
                  </div>
                  
                  <div className="grid gap-2 sm:gap-3">
                    {localAnnouncement.attachments.map((attachment, index) => {
                      const Icon = getFileIcon(attachment.type)
                      return (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + index * 0.1 }}
                          className="group flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-sky-50 dark:hover:bg-sky-950/20 hover:border-sky-300 dark:hover:border-sky-700 transition-all duration-200"
                        >
                          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1 w-full">
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
                          <div className="flex shrink-0 items-center justify-center gap-2 w-full sm:w-auto sm:self-auto">
                            <AnnouncementAttachmentActions attachment={attachment} compact />
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              </motion.div>
            ) : null}

            {!isLockedForStudents && <Separator />}

            {/* Reaction Section — students only */}
            {!isInstructorView && !isLockedForStudents && localAnnouncement.allow_reactions && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-3 sm:space-y-4 text-center sm:text-left"
              >
                <h4 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-200 break-words">
                  <span className="sm:hidden">How do you feel?</span>
                  <span className="hidden sm:inline">How do you feel about this announcement?</span>
                </h4>
                <div className="flex justify-center sm:justify-start">
                <ReactionBar
                  announcementId={localAnnouncement.id}
                  studentId={studentId!}
                  currentReaction={localAnnouncement.my_reaction}
                  reactionsBreakdown={localAnnouncement.reactions_breakdown}
                  onReactionChange={(reaction) => {
                    if (localAnnouncement) {
                      setLocalAnnouncement({
                        ...localAnnouncement,
                        my_reaction: reaction
                      })
                    }
                    onReactionChange?.(reaction)
                  }}
                />
                </div>
              </motion.div>
            )}

            {/* Separator between reactions and comments */}
            {!isInstructorView && !isLockedForStudents && localAnnouncement.allow_reactions && localAnnouncement.allow_comments && <Separator />}

            {/* Comments Section */}
            {!isLockedForStudents && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-center sm:text-left"
            >
              <AnnouncementComments
                announcementId={localAnnouncement.id}
                studentId={studentId || ""}
                allowComments={localAnnouncement.allow_comments}
                readOnly={isInstructorView}
              />
            </motion.div>
            )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
