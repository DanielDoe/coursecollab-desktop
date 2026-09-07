"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, Megaphone, Eye, Heart, MessageCircle, Calendar, User, Download, FileText, Image as ImageIcon, Video, Pin, Sparkles, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { motion } from "framer-motion"
import { formatDistanceToNow } from "date-fns"

interface Announcement {
  id: number
  title: string
  content: string
  author_name?: string
  pinned: boolean
  allow_reactions: boolean
  allow_comments: boolean
  views_count: number
  reactions_count: number
  reactions_breakdown?: Record<string, number>
  created_at: string
  updated_at: string
  attachments?: Array<{ name: string; url: string; type: string }>
}

interface Comment {
  id: number
  content: string
  student_id: number
  student_name: string
  created_at: string
  updated_at: string
}

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return ImageIcon
  if (type.startsWith('video/')) return Video
  return FileText
}

export default function InstructorAnnouncementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [instructorId, setInstructorId] = useState<string>("")
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [announcementId, setAnnouncementId] = useState<string>("")

  useEffect(() => {
    params.then(({ id }) => {
      setAnnouncementId(id)
    })
  }, [params])

  useEffect(() => {
    const instructorSession = localStorage.getItem("instructorSession")
    if (!instructorSession) {
      router.push("/instructor/login")
      return
    }

    try {
      const session = JSON.parse(instructorSession)
      const id = session.id?.toString() || ""
      setInstructorId(id)
    } catch (error) {
      console.error("Failed to parse instructor session:", error)
      router.push("/instructor/login")
    }
  }, [router])

  useEffect(() => {
    if (instructorId && announcementId) {
      fetchAnnouncement()
      fetchComments()
    }
  }, [instructorId, announcementId])

  const fetchAnnouncement = async () => {
    try {
      setLoading(true)
      const response = await instructorApiFetch(
        `/api/announcements/${announcementId}?instructorId=${encodeURIComponent(instructorId)}`,
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch announcement')
      }

      setAnnouncement(data.announcement)
      setError(null)
    } catch (error) {
      console.error("Error fetching announcement:", error)
      setError(error instanceof Error ? error.message : 'Failed to load announcement')
    } finally {
      setLoading(false)
    }
  }

  const fetchComments = async () => {
    try {
      const response = await instructorApiFetch(`/api/announcements/${announcementId}/comments`)
      const data = await response.json()

      if (response.ok) {
        setComments(data.comments || [])
      }
    } catch (error) {
      console.error("Error fetching comments:", error)
    }
  }

  const formatContent = (content: string) => {
    return content.split('\n\n').map((paragraph, pIndex) => {
      let formatted = paragraph.split(/(\*\*.*?\*\*)/).map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index}>{part.slice(2, -2)}</strong>
        }
        return part
      })

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50 dark:from-slate-900 dark:via-slate-800 dark:to-rose-950 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-8"
        >
          <div className="relative mx-auto w-24 h-24">
            <motion.div
              animate={{ 
                rotate: 360,
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
              }}
              className="w-full h-full rounded-full bg-gradient-to-br from-rose-500 via-pink-500 to-purple-600 shadow-2xl shadow-rose-500/30 flex items-center justify-center"
            >
              <Megaphone className="w-12 h-12 text-white" />
            </motion.div>
            
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
                className="absolute w-2 h-2 bg-gradient-to-r from-rose-400 to-pink-400 rounded-full"
                style={{
                  left: `${20 + (i * 12)}%`,
                  top: `${30 + (i % 2) * 20}%`
                }}
              />
            ))}
          </div>

          <div className="space-y-3">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 bg-clip-text text-transparent"
            >
              Loading Announcement
            </motion.h2>
            
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex justify-center gap-2"
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
                  className="w-2 h-2 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full"
                />
              ))}
            </motion.div>
          </div>
        </motion.div>
      </div>
    )
  }

  if (error || !announcement) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50 dark:from-slate-900 dark:via-slate-800 dark:to-rose-950 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center space-y-4"
        >
          <div className="text-6xl">😕</div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
            {error || "Announcement not found"}
          </h2>
          <Button 
            variant="outline" 
            className="w-full gap-2"
            onClick={() => router.push("/instructor/announcements-v2")}
          >
            <ArrowLeft className="size-4" />
            Back to Announcements
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-rose-50 dark:from-slate-900 dark:via-slate-800 dark:to-rose-950">
      <div className="container mx-auto px-6 py-10 space-y-6">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex justify-end"
        >
          <Button 
            variant="outline"
            onClick={() => router.push("/instructor/announcements-v2")}
            className="gap-2 border-2 border-slate-200 hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all duration-200"
          >
            <ArrowLeft className="size-4" />
            Back to Announcements
          </Button>
        </motion.div>

        {/* Announcement Detail */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-5xl mx-auto"
        >
          <Card className={`overflow-hidden border-0 shadow-2xl ${
            announcement.pinned 
              ? 'bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10' 
              : 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'
          }`}>
            {/* Pinned Banner */}
            {announcement.pinned && (
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 flex items-center gap-2 text-white"
              >
                <Pin className="w-5 h-5" />
                <span className="font-semibold">Pinned Announcement</span>
              </motion.div>
            )}

            <CardHeader className="space-y-6 p-8">
              {/* Meta Info */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="flex flex-wrap items-center gap-4 text-sm"
              >
                {announcement.author_name && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700">
                    <User className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {announcement.author_name}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700">
                  <Calendar className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <span className="text-slate-700 dark:text-slate-300">
                    {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
                  </span>
                </div>
                {announcement.updated_at !== announcement.created_at && (
                  <Badge variant="outline" className="text-xs">
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
                <h1 className="text-4xl font-bold bg-gradient-to-r from-rose-600 via-pink-600 to-purple-600 bg-clip-text text-transparent leading-tight">
                  {announcement.title}
                </h1>
              </motion.div>

              {/* Stats Grid */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700"
              >
                <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                  <Eye className="w-6 h-6 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{announcement.views_count}</p>
                    <p className="text-xs text-blue-600/70 dark:text-blue-400/70">Views</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20">
                  <Heart className="w-6 h-6 text-rose-500" />
                  <div>
                    <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{announcement.reactions_count}</p>
                    <p className="text-xs text-rose-600/70 dark:text-rose-400/70">Reactions</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20">
                  <MessageCircle className="w-6 h-6 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{comments.length}</p>
                    <p className="text-xs text-purple-600/70 dark:text-purple-400/70">Comments</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                  <Sparkles className="w-6 h-6 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {announcement.allow_reactions && announcement.allow_comments ? 'Full' : 
                       announcement.allow_reactions || announcement.allow_comments ? 'Partial' : 'None'}
                    </p>
                    <p className="text-xs text-green-600/70 dark:text-green-400/70">Engagement</p>
                  </div>
                </div>
              </motion.div>
            </CardHeader>

            <CardContent className="space-y-8 px-8 pb-8">
              {/* Content */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="prose prose-lg max-w-none dark:prose-invert"
              >
                <div className="text-base leading-relaxed">
                  {formatContent(announcement.content)}
                </div>
              </motion.div>

              {/* Attachments */}
              {announcement.attachments && announcement.attachments.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="space-y-4"
                >
                  <Separator />
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                      <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                        Attachments ({announcement.attachments.length})
                      </h4>
                    </div>
                    
                    <div className="grid gap-3">
                      {announcement.attachments.map((attachment, index) => {
                        const Icon = getFileIcon(attachment.type)
                        return (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.6 + index * 0.1 }}
                            className="group flex items-center justify-between p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-gradient-to-r hover:from-rose-50 hover:to-pink-50 dark:hover:from-rose-950/20 dark:hover:to-pink-950/20 hover:border-rose-300 dark:hover:border-rose-700 transition-all duration-200"
                          >
                            <div className="flex items-center gap-4">
                              <div className="p-3 rounded-lg bg-white dark:bg-slate-700 shadow-sm">
                                <Icon className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                              </div>
                              <div>
                                <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
                                  {attachment.name}
                                </p>
                                <p className="text-sm text-slate-500">
                                  {attachment.type}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                              onClick={() => window.open(attachment.url, '_blank')}
                            >
                              <Download className="w-5 h-5" />
                            </Button>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Settings Status */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="space-y-4"
              >
                <Separator />
                
                <div className="space-y-3">
                  <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                    Announcement Settings
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`p-4 rounded-lg border-2 ${
                      announcement.allow_reactions 
                        ? 'border-green-300 bg-green-50 dark:bg-green-950/20' 
                        : 'border-red-300 bg-red-50 dark:bg-red-950/20'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Heart className={`w-5 h-5 ${announcement.allow_reactions ? 'text-green-600' : 'text-red-600'}`} />
                        <span className={`font-medium ${announcement.allow_reactions ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                          Reactions {announcement.allow_reactions ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                    
                    <div className={`p-4 rounded-lg border-2 ${
                      announcement.allow_comments 
                        ? 'border-green-300 bg-green-50 dark:bg-green-950/20' 
                        : 'border-red-300 bg-red-50 dark:bg-red-950/20'
                    }`}>
                      <div className="flex items-center gap-2">
                        <MessageCircle className={`w-5 h-5 ${announcement.allow_comments ? 'text-green-600' : 'text-red-600'}`} />
                        <span className={`font-medium ${announcement.allow_comments ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                          Comments {announcement.allow_comments ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Comments Preview */}
              {comments.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="space-y-4"
                >
                  <Separator />
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-5 h-5 text-blue-500" />
                      <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                        Recent Comments ({comments.length})
                      </h4>
                    </div>
                    
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {comments.slice(0, 5).map((comment) => (
                        <div
                          key={comment.id}
                          className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500">
                              <User className="w-3 h-3 text-white" />
                            </div>
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {comment.student_name}
                            </span>
                            <span className="text-xs text-slate-500">
                              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 dark:text-slate-300">
                            {comment.content}
                          </p>
                        </div>
                      ))}
                    </div>
                    {comments.length > 5 && (
                      <p className="text-sm text-center text-slate-500 dark:text-slate-400">
                        And {comments.length - 5} more comment{comments.length - 5 !== 1 ? 's' : ''}...
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

