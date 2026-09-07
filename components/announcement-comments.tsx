"use client"


import { studentApiFetch } from "@/lib/auth"
import { useState, useEffect } from "react"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, MessageCircle, Send, Trash2, User } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Comment {
  id: number
  content: string
  student_id: number
  student_name: string
  created_at: string
  updated_at: string
}

interface AnnouncementCommentsProps {
  announcementId: number
  studentId: string
  allowComments: boolean
  readOnly?: boolean
}

export function AnnouncementComments({ 
  announcementId, 
  studentId,
  allowComments,
  readOnly = false,
}: AnnouncementCommentsProps) {
  const { toast } = useToast()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [commentToDelete, setCommentToDelete] = useState<number | null>(null)

  useEffect(() => {
    fetchComments()
  }, [announcementId])

  const fetchComments = async () => {
    try {
      setLoading(true)
      const response = await studentApiFetch(`/api/announcements/${announcementId}/comments`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch comments')
      }

      setComments(data.comments || [])
    } catch (error) {
      console.error("Error fetching comments:", error)
      toast({
        title: "Error",
        description: "Failed to load comments",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newComment.trim()) {
      toast({
        title: "Validation Error",
        description: "Comment cannot be empty",
        variant: "destructive"
      })
      return
    }

    setSubmitting(true)

    try {
      const response = await studentApiFetch(`/api/announcements/${announcementId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studentId,
          content: newComment
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to post comment')
      }

      // Add new comment to the list
      setComments([...comments, data.comment])
      setNewComment("")
      
      toast({
        title: "Success",
        description: "Comment posted successfully"
      })
    } catch (error) {
      console.error("Error posting comment:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to post comment",
        variant: "destructive"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteComment = async () => {
    if (!commentToDelete) return

    try {
      const response = await fetch(
        `/api/announcements/${announcementId}/comments/${commentToDelete}`,
        {
          method: 'DELETE',
          headers: {
            'x-student-id': studentId
          }
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete comment')
      }

      // Remove comment from the list
      setComments(comments.filter(c => c.id !== commentToDelete))
      
      toast({
        title: "Success",
        description: "Comment deleted successfully"
      })
    } catch (error) {
      console.error("Error deleting comment:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete comment",
        variant: "destructive"
      })
    } finally {
      setDeleteDialogOpen(false)
      setCommentToDelete(null)
    }
  }

  if (!allowComments) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-8"
      >
        <MessageCircle className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-600 mb-3" />
        <p className="text-slate-600 dark:text-slate-400">
          Comments are disabled for this announcement
        </p>
      </motion.div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Comments Header */}
      <div className="flex items-center justify-center sm:justify-start gap-2">
        <MessageCircle className="w-5 h-5 text-sky-500 dark:text-sky-400" />
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          Comments ({comments.length})
        </h3>
      </div>

      {/* Comment Input Form — students only */}
      {!readOnly && (
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmitComment}
        className="space-y-3"
      >
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Share your thoughts..."
          disabled={submitting}
          className="min-h-[100px] resize-none border-2 border-slate-200 focus:border-sky-400 dark:focus:border-sky-500 transition-colors duration-200"
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button 
            type="submit" 
            disabled={submitting || !newComment.trim()}
            className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-500 text-white shadow-md shadow-sky-600/20"
          >
            {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            <Send className="mr-2 size-4" />
            Post Comment
          </Button>
        </div>
      </motion.form>
      )}

      {/* Comments List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-sky-500 dark:text-sky-400" />
          <span className="ml-2 text-slate-600 dark:text-slate-400">Loading comments...</span>
        </div>
      ) : comments.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl"
        >
          <MessageCircle className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-600 mb-3" />
          <p className="text-slate-600 dark:text-slate-400">
            No comments yet. Be the first to share your thoughts!
          </p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {comments.map((comment, index) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="border-2 border-slate-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-700 transition-colors duration-200">
                  <CardContent className="p-4">
                    {/* Comment Header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <div className="p-2 rounded-full bg-sky-500 dark:bg-sky-600 shadow-md">
                          <User className="w-4 h-4 text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {comment.student_name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-500">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      
                      {/* Delete button (only show for comment author) */}
                      {comment.student_id === Number(studentId) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCommentToDelete(comment.id)
                            setDeleteDialogOpen(true)
                          }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {/* Comment Content */}
                    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {comment.content}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteComment}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

