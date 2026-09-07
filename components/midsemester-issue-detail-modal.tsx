"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageSquare, Send, Loader2, CheckCircle2 } from "lucide-react"

interface Issue {
  id: number
  exam_title: string
  question_number: number | null
  description: string
  status: "open" | "closed"
  reporter_name: string
  created_at: string
}

interface Comment {
  id: number
  commenter_name: string
  commenter_role: "student" | "admin"
  comment_text: string
  created_at: string
}

export function MidSemesterIssueDetailModal({
  issue,
  onClose,
  onUpdated,
}: {
  issue: Issue
  onClose: () => void
  onUpdated: () => void
}) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchComments()
  }, [issue.id])

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/midsemester/issues/${issue.id}/comments`)
      const data = await res.json()
      setComments(data.comments || [])
    } catch (error) {
      console.error("[v0] Failed to fetch comments:", error)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return
    setLoading(true)
    try {
      const commenterName = sessionStorage.getItem("studentName") || "Anonymous"
      const commenterId = sessionStorage.getItem("studentId") || ""

      await fetch(`/api/midsemester/issues/${issue.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commenterName,
          commenterId,
          commenterRole: "student",
          commentText: newComment,
        }),
      })

      setNewComment("")
      fetchComments()
      onUpdated()
    } catch (error) {
      console.error("[v0] Failed to add comment:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-50/95 to-white/90 dark:from-slate-800/95 dark:to-slate-900/95 border border-slate-200/60 dark:border-slate-700/60 shadow-xl backdrop-blur-md rounded-xl sm:rounded-2xl w-[calc(100%-2rem)] sm:w-full">
        <DialogHeader className="pb-3 border-b border-slate-200/40 dark:border-slate-700/60 px-4 sm:px-6 pt-4 sm:pt-6">
          <div className="flex items-start justify-between gap-2 sm:gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base sm:text-lg md:text-xl font-semibold text-slate-800 dark:text-slate-200 break-words">{issue.exam_title}</DialogTitle>
              {issue.question_number && (
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Question {issue.question_number}
                </p>
              )}
            </div>
            <Badge
              variant="outline"
              className={`rounded-full px-2 sm:px-3 py-0.5 text-[10px] sm:text-xs shrink-0 ${
                issue.status === "open"
                  ? "border-amber-400 dark:border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-50/80 dark:bg-amber-900/30"
                  : "border-emerald-400 dark:border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-900/30"
              }`}
            >
              {issue.status === "open" ? "Open" : "Closed"}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 py-3 sm:py-4 px-4 sm:px-6">
          {/* Description */}
          <div className="bg-slate-50/80 dark:bg-slate-800/50 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-slate-200/50 dark:border-slate-700/60">
            <p className="text-xs sm:text-sm font-medium mb-2 text-slate-800 dark:text-slate-200">
              <span className="sm:hidden">Description</span>
              <span className="hidden sm:inline">Issue Description</span>
            </p>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words">{issue.description}</p>
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-500 mt-2">
              <span className="sm:hidden">
                by {issue.reporter_name} • {new Date(issue.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
              <span className="hidden sm:inline">
                Reported by {issue.reporter_name} on{" "}
                {new Date(issue.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </p>
          </div>

          {/* Comments Section */}
          <div>
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                <span className="sm:hidden">Comments ({comments.length})</span>
                <span className="hidden sm:inline">Comments ({comments.length})</span>
              </p>
            </div>

            <ScrollArea className="h-[200px] sm:h-[240px] md:h-[280px] rounded-lg border border-slate-200/50 dark:border-slate-700/60 p-2 sm:p-3 bg-slate-50/60 dark:bg-slate-800/50 backdrop-blur-sm">
              {comments.length === 0 ? (
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 text-center py-4 sm:py-5">No comments yet</p>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      className={`p-2 sm:p-3 rounded-lg shadow-sm transition-all ${
                        comment.commenter_role === "admin"
                          ? "bg-blue-50/80 dark:bg-blue-900/30 border-l-4 border-blue-400 dark:border-blue-500"
                          : "bg-white/80 dark:bg-slate-700/50 border-l-4 border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-0 mb-1">
                        <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5 sm:gap-2">
                          {comment.commenter_name}
                          {comment.commenter_role === "admin" && (
                            <Badge
                              variant="outline"
                              className="text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700 bg-blue-50/80 dark:bg-blue-900/30 text-[10px] rounded-full px-1.5 sm:px-2"
                            >
                              Admin
                            </Badge>
                          )}
                        </p>
                        <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-500">
                          {new Date(comment.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </p>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed break-words">
                        {comment.comment_text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Add Comment */}
          {issue.status === "open" && (
            <div className="flex flex-col sm:flex-row gap-2 items-end pt-2">
              <Textarea
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={2}
                className="flex-1 bg-white/80 dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500 backdrop-blur-sm border-slate-200/50 dark:border-slate-700 text-xs sm:text-sm rounded-lg sm:rounded-xl"
              />
              <Button
                onClick={handleAddComment}
                disabled={loading || !newComment.trim()}
                size="icon"
                className="shrink-0 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 dark:from-blue-700 dark:to-indigo-700 dark:hover:from-blue-800 dark:hover:to-indigo-800 text-white rounded-full shadow-lg h-9 w-9 sm:h-10 sm:w-10"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> : <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              </Button>
            </div>
          )}
          {issue.status === "closed" && (
            <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Issue Closed
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
