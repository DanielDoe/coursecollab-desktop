"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { AdminHeader } from "@/components/admin-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MessageSquare, AlertTriangle, ArrowLeft, Send, CheckCircle2 } from "lucide-react"
import { motion } from "framer-motion"

export default function AdminExamDetailPage() {
  const params = useParams()
  const router = useRouter()
  const examId = params.id as string
  const assessmentType = params.assessmentType as string

  const [comments, setComments] = useState<any[]>([])
  const [issues, setIssues] = useState<any[]>([])
  const [replyTexts, setReplyTexts] = useState<Record<number, string>>({})
  const [activeIssue, setActiveIssue] = useState<any>(null)
  const [issueReply, setIssueReply] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchComments()
    fetchIssues()
  }, [examId])

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/admin/midsemester/comments?examId=${examId}`)
      const data = await res.json()
      setComments(data.comments || [])
    } catch (error) {
      console.error("[v0] Error fetching comments:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchIssues = async () => {
    try {
      const res = await fetch(`/api/admin/midsemester/issues?examId=${examId}`)
      const data = await res.json()
      setIssues(data.issues || [])
    } catch (error) {
      console.error("[v0] Error fetching issues:", error)
    }
  }

  const handleReply = async (commentId: number) => {
    const text = replyTexts[commentId]
    if (!text?.trim()) return

    try {
      const res = await fetch("/api/admin/midsemester/comments/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId, commentId, text }),
      })

      if (res.ok) {
        setReplyTexts({ ...replyTexts, [commentId]: "" })
        fetchComments()
      }
    } catch (error) {
      console.error("[v0] Error posting reply:", error)
    }
  }

  const handleReplyToIssue = async () => {
    if (!issueReply.trim() || !activeIssue) return

    try {
      const res = await fetch("/api/admin/midsemester/issues/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId: activeIssue.id, text: issueReply }),
      })

      if (res.ok) {
        setIssueReply("")
        fetchIssues()
        // Update active issue with new comment
        const updatedIssues = await fetch(`/api/admin/midsemester/issues?examId=${examId}`)
        const data = await updatedIssues.json()
        const updated = data.issues.find((i: any) => i.id === activeIssue.id)
        setActiveIssue(updated)
      }
    } catch (error) {
      console.error("[v0] Error replying to issue:", error)
    }
  }

  const handleCloseIssue = async (issueId: number) => {
    try {
      const res = await fetch("/api/admin/midsemester/issues/close", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueId, resolutionComment: issueReply }),
      })

      if (res.ok) {
        setActiveIssue(null)
        setIssueReply("")
        fetchIssues()
      }
    } catch (error) {
      console.error("[v0] Error closing issue:", error)
    }
  }

  const openIssues = issues.filter((i) => i.status === "open")
  const closedIssues = issues.filter((i) => i.status === "closed")

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      <AdminHeader />

      <main className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => router.push(`/admin/${assessmentType}`)}
          className="mb-6 text-purple-700 hover:text-purple-900"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to {assessmentType === "mid_semester" ? "Mid-Semester Exams" : "Assessments"}
        </Button>

        {/* Tabs */}
        <Tabs defaultValue="comments" className="space-y-6">
          <TabsList className="bg-white/60 backdrop-blur-md rounded-full p-1 grid grid-cols-2 w-full md:w-auto shadow-sm">
            <TabsTrigger value="comments" className="rounded-full">
              <MessageSquare className="h-4 w-4 mr-2" />
              Comments
            </TabsTrigger>
            <TabsTrigger value="issues" className="rounded-full">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Issues
            </TabsTrigger>
          </TabsList>

          {/* Comments Tab */}
          <TabsContent value="comments">
            <Card className="bg-white/80 backdrop-blur-md border-purple-100 shadow-lg rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-700">
                  <MessageSquare className="h-5 w-5" /> Student Comments
                </CardTitle>
                <CardDescription>View and respond to student feedback</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                {loading ? (
                  <p className="text-center text-muted-foreground py-6">Loading comments...</p>
                ) : comments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">No comments yet</p>
                ) : (
                  comments.map((comment) => (
                    <motion.div
                      key={comment.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border-b border-muted/30 pb-4 last:border-0"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-purple-100 text-purple-700">
                            {comment.author?.charAt(0) || "S"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex justify-between items-center">
                            <p className="font-medium text-sm">{comment.author}</p>
                            <span className="text-xs text-muted-foreground">
                              {new Date(comment.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{comment.text}</p>

                          {/* Admin Replies */}
                          {comment.replies?.length > 0 && (
                            <div className="mt-3 ml-8 space-y-2">
                              {comment.replies.map((reply: any) => (
                                <div
                                  key={reply.id}
                                  className="bg-gradient-to-r from-purple-50 to-indigo-50 p-3 rounded-xl shadow-sm border border-purple-100"
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="secondary" className="text-xs bg-purple-600 text-white">
                                      Instructor
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(reply.created_at).toLocaleString()}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-700">{reply.text}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Reply Input */}
                          <div className="mt-3 ml-8">
                            <Textarea
                              placeholder="Reply to this comment..."
                              className="w-full resize-none border-purple-200 bg-white/60 text-sm focus:border-purple-400"
                              rows={2}
                              value={replyTexts[comment.id] || ""}
                              onChange={(e) => setReplyTexts({ ...replyTexts, [comment.id]: e.target.value })}
                            />
                            <div className="flex justify-end mt-2">
                              <Button
                                size="sm"
                                className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-full hover:from-purple-700 hover:to-indigo-800"
                                onClick={() => handleReply(comment.id)}
                                disabled={!replyTexts[comment.id]?.trim()}
                              >
                                <Send className="h-3 w-3 mr-1" />
                                Reply
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Issues Tab */}
          <TabsContent value="issues">
            <Card className="bg-white/80 backdrop-blur-md border-purple-100 shadow-lg rounded-2xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-purple-700 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" /> Reported Issues
                  </CardTitle>
                  <Badge variant="outline" className="text-purple-600 border-purple-300">
                    {openIssues.length} Open / {closedIssues.length} Closed
                  </Badge>
                </div>
              </CardHeader>

              <CardContent>
                <Tabs defaultValue="open" className="space-y-4">
                  <TabsList className="bg-muted/30 rounded-full grid grid-cols-2 p-1">
                    <TabsTrigger value="open" className="rounded-full">
                      Open Issues ({openIssues.length})
                    </TabsTrigger>
                    <TabsTrigger value="closed" className="rounded-full">
                      Closed Issues ({closedIssues.length})
                    </TabsTrigger>
                  </TabsList>

                  {/* Open Issues */}
                  <TabsContent value="open" className="space-y-3">
                    {openIssues.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No open issues 🎉</p>
                    ) : (
                      openIssues.map((issue) => (
                        <motion.div
                          key={issue.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 border-l-4 border-purple-500 bg-purple-50/40 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => setActiveIssue(issue)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium text-purple-900">{issue.title}</p>
                              <p className="text-xs text-muted-foreground mt-1">{issue.description}</p>
                              <p className="text-xs text-muted-foreground mt-2">
                                Reported by: <span className="font-medium">{issue.student_name}</span>
                              </p>
                            </div>
                            <Button variant="outline" size="sm" className="text-xs text-purple-700 bg-transparent">
                              View
                            </Button>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </TabsContent>

                  {/* Closed Issues */}
                  <TabsContent value="closed" className="space-y-3">
                    {closedIssues.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No closed issues</p>
                    ) : (
                      closedIssues.map((issue) => (
                        <motion.div
                          key={issue.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 border-l-4 border-green-500 bg-green-50/40 rounded-xl shadow-sm"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-green-900">{issue.title}</p>
                                <Badge variant="outline" className="text-green-600 border-green-300">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Closed
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{issue.description}</p>
                              {issue.resolution_comment && (
                                <p className="text-xs text-green-700 mt-2 italic">
                                  Resolution: {issue.resolution_comment}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2">
                                Closed by: <span className="font-medium">{issue.closed_by_username}</span>
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Issue Detail Modal */}
        <Dialog open={!!activeIssue} onOpenChange={() => setActiveIssue(null)}>
          <DialogContent className="sm:max-w-2xl bg-white/95 backdrop-blur-lg rounded-2xl shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-purple-700 text-xl">{activeIssue?.title}</DialogTitle>
              <DialogDescription className="text-base">{activeIssue?.description}</DialogDescription>
            </DialogHeader>

            {/* Discussion Thread */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 mt-4">
              {activeIssue?.comments?.map((c: any) => (
                <div
                  key={c.id}
                  className={`p-3 rounded-lg ${
                    c.author_type === "admin"
                      ? "bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100"
                      : "bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium">{c.author}</p>
                    {c.author_type === "admin" && (
                      <Badge variant="secondary" className="text-xs bg-purple-600 text-white">
                        Instructor
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(c.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{c.text}</p>
                </div>
              ))}
            </div>

            {/* Add Reply */}
            <div className="mt-4">
              <Textarea
                placeholder="Add a reply or resolution..."
                className="w-full resize-none border-purple-200 focus:border-purple-400"
                rows={3}
                value={issueReply}
                onChange={(e) => setIssueReply(e.target.value)}
              />
              <div className="flex justify-end mt-3 gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleCloseIssue(activeIssue?.id)}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  disabled={!issueReply.trim()}
                >
                  Close Issue
                </Button>
                <Button
                  className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white hover:from-purple-700 hover:to-indigo-800"
                  onClick={handleReplyToIssue}
                  disabled={!issueReply.trim()}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Reply
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
