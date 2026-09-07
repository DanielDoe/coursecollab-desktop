"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import {
  GraduationCap,
  MessageSquare,
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Send,
  User,
  Calendar,
  Clock,
  Eye,
  Share2,
  Bookmark,
  Flag,
  MoreHorizontal,
  Code,
  Copy,
  Check,
  Heart,
  Reply,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle,
  Star,
  Award,
  Crown,
  Zap,
  Flame,
  Target,
  Brain,
  Rocket,
} from "lucide-react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { StudentProfileDropdown } from "@/components/student-profile-dropdown"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useSmartHomeLink } from "@/hooks/useSmartHomeLink"
import { useToast } from "@/components/ui/use-toast"

type Thread = {
  id: number
  student_id: number
  title: string
  description: string
  code_snippet?: string
  tags: string[]
  upvotes: number
  downvotes: number
  reply_count: number
  is_anonymous: boolean
  created_at: string
  author_name: string
  author_reputation: number
  views: number
}

type Reply = {
  id: number
  thread_id: number
  student_id: number
  content: string
  upvotes: number
  downvotes: number
  created_at: string
  author_name: string
  author_reputation: number
  is_solution: boolean
  parent_reply_id?: number
}

export default function ThreadDetailPage() {
  const router = useRouter()
  const params = useParams()
  const homeLink = useSmartHomeLink()
  const { toast } = useToast()
  const threadId = params.id as string

  const [studentId, setStudentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [thread, setThread] = useState<Thread | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [newReply, setNewReply] = useState("")
  const [submittingReply, setSubmittingReply] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  useEffect(() => {
    const id = sessionStorage.getItem("studentDatabaseId")
    if (!id) {
      router.push("/student/login")
      return
    }
    setStudentId(id)
    fetchThreadData()
  }, [threadId])

  const fetchThreadData = async () => {
    try {
      const [threadRes, repliesRes] = await Promise.all([
        fetch(`/api/forum/threads/${threadId}`),
        fetch(`/api/forum/replies?threadId=${threadId}`),
      ])

      if (threadRes.ok) {
        const threadData = await threadRes.json()
        setThread(threadData.thread)
      }

      if (repliesRes.ok) {
        const repliesData = await repliesRes.json()
        setReplies(repliesData.replies || [])
      }
    } catch (error) {
      console.error("Failed to fetch thread data:", error)
      toast({
        title: "Error",
        description: "Failed to load thread data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleVote = async (type: "thread" | "reply", id: number, voteType: "up" | "down") => {
    if (!studentId) return

    try {
      const response = await fetch("/api/forum/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: parseInt(studentId),
          type,
          itemId: id,
          voteType,
        }),
      })

      if (response.ok) {
        fetchThreadData()
      }
    } catch (error) {
      console.error("Failed to vote:", error)
    }
  }

  const handleReply = async () => {
    if (!studentId || !newReply.trim()) {
      toast({
        title: "Error",
        description: "Please enter a reply",
        variant: "destructive",
      })
      return
    }

    setSubmittingReply(true)
    try {
      const response = await fetch("/api/forum/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: parseInt(studentId),
          threadId: parseInt(threadId),
          content: newReply,
        }),
      })

      if (response.ok) {
        toast({ title: "Success", description: "Reply posted successfully!" })
        setNewReply("")
        fetchThreadData()
      } else {
        throw new Error("Failed to post reply")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to post reply",
        variant: "destructive",
      })
    } finally {
      setSubmittingReply(false)
    }
  }

  const copyCodeToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(true)
      toast({ title: "Copied!", description: "Code copied to clipboard" })
      setTimeout(() => setCopiedCode(false), 2000)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy code",
        variant: "destructive",
      })
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return "Just now"
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center mx-auto">
            <MessageSquare className="h-8 w-8 text-white animate-pulse" />
          </div>
          <p className="text-lg font-medium text-slate-600 dark:text-slate-300">Loading thread...</p>
        </div>
      </div>
    )
  }

  if (!thread) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Thread Not Found</h1>
          <p className="text-slate-600 dark:text-slate-300">The thread you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => router.push("/student/forum")} className="bg-gradient-to-r from-indigo-500 to-purple-600">
            Back to Forum
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/20 dark:border-gray-800/50 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={homeLink} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">CourseCollab</h1>
          </Link>
          <StudentProfileDropdown />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => router.push("/student/forum")} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Forum
        </Button>

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Thread Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-8">
                <div className="flex items-start justify-between">
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                        <MessageSquare className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">
                          {thread.title}
                        </h1>
                        <div className="flex items-center gap-4 text-slate-600 dark:text-slate-300">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span className="text-sm">
                              {thread.is_anonymous ? "Anonymous" : thread.author_name}
                            </span>
                            {thread.author_reputation > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {thread.author_reputation} reputation
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span className="text-sm">{formatDate(thread.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            <span className="text-sm">{thread.views} views</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVote("thread", thread.id, "up")}
                      className="text-slate-500 hover:text-green-600 rounded-xl"
                    >
                      <ThumbsUp className="h-4 w-4" />
                      <span className="ml-1">{thread.upvotes}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVote("thread", thread.id, "down")}
                      className="text-slate-500 hover:text-red-600 rounded-xl"
                    >
                      <ThumbsDown className="h-4 w-4" />
                      <span className="ml-1">{thread.downvotes}</span>
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-xl">
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-xl">
                      <Bookmark className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-8">
                <div className="prose prose-slate dark:prose-invert max-w-none">
                  <p className="text-lg text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {thread.description}
                  </p>
                </div>

                {thread.code_snippet && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                        <Code className="h-5 w-5" />
                        Code Snippet
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyCodeToClipboard(thread.code_snippet!)}
                        className="rounded-xl"
                      >
                        {copiedCode ? (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                      <pre className="text-slate-100 text-sm font-mono">
                        <code>{thread.code_snippet}</code>
                      </pre>
                    </div>
                  </div>
                )}

                {thread.tags.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-3">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {thread.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="rounded-xl px-3 py-1">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Replies Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card className="border-0 shadow-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm">
              <CardHeader className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                      <MessageCircle className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold">Replies ({replies.length})</CardTitle>
                      <p className="text-slate-600 dark:text-slate-300">Share your thoughts and help others</p>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                {/* Add Reply */}
                <div className="mb-8">
                  <div className="space-y-4">
                    <Label htmlFor="reply" className="text-lg font-semibold">Your Reply</Label>
                    <Textarea
                      id="reply"
                      value={newReply}
                      onChange={(e) => setNewReply(e.target.value)}
                      placeholder="Share your thoughts, provide solutions, or ask clarifying questions..."
                      className="rounded-xl min-h-[120px] text-base"
                    />
                    <div className="flex justify-end">
                      <Button
                        onClick={handleReply}
                        disabled={submittingReply || !newReply.trim()}
                        className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl px-6"
                      >
                        {submittingReply ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Posting...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Post Reply
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Replies List */}
                <div className="space-y-6">
                  <AnimatePresence>
                    {replies.map((reply, index) => (
                      <motion.div
                        key={reply.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                        className={`p-6 rounded-xl border-2 transition-all duration-300 ${
                          reply.is_solution
                            ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/20"
                            : "border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            reply.is_solution
                              ? "bg-gradient-to-r from-green-500 to-emerald-600"
                              : "bg-gradient-to-r from-blue-500 to-indigo-600"
                          }`}>
                            {reply.is_solution ? (
                              <CheckCircle className="h-5 w-5 text-white" />
                            ) : (
                              <User className="h-5 w-5 text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <h4 className="font-semibold text-slate-800 dark:text-white">
                                  {reply.author_name}
                                </h4>
                                {reply.author_reputation > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    {reply.author_reputation} reputation
                                  </Badge>
                                )}
                                {reply.is_solution && (
                                  <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Solution
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-500">{formatDate(reply.created_at)}</span>
                                <Button variant="ghost" size="sm" className="rounded-xl">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="prose prose-slate dark:prose-invert max-w-none mb-4">
                              <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                {reply.content}
                              </p>
                            </div>
                            <div className="flex items-center gap-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleVote("reply", reply.id, "up")}
                                className="text-slate-500 hover:text-green-600 rounded-xl"
                              >
                                <ThumbsUp className="h-4 w-4" />
                                <span className="ml-1">{reply.upvotes}</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleVote("reply", reply.id, "down")}
                                className="text-slate-500 hover:text-red-600 rounded-xl"
                              >
                                <ThumbsDown className="h-4 w-4" />
                                <span className="ml-1">{reply.downvotes}</span>
                              </Button>
                              <Button variant="ghost" size="sm" className="text-slate-500 hover:text-blue-600 rounded-xl">
                                <Reply className="h-4 w-4 mr-1" />
                                Reply
                              </Button>
                              {!reply.is_solution && (
                                <Button variant="ghost" size="sm" className="text-slate-500 hover:text-green-600 rounded-xl">
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Mark as Solution
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {replies.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-12"
                    >
                      <MessageCircle className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300 mb-2">
                        No replies yet
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400">
                        Be the first to share your thoughts and help others!
                      </p>
                    </motion.div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>
    </div>
  )
}

