"use client"

import { useState, useEffect } from "react"
import { ThumbsUp, ThumbsDown, Heart, MessageCircle, Reply, Edit2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { toast } from "@/lib/app-toast"
import { motion, AnimatePresence } from "framer-motion"
import { initialsFromName } from "@/lib/initials-from-name"
interface ProjectVotingProps {
  projectId: number
  studentId: number
  onEngagementUpdate?: () => void
}

interface VoteData {
  upvotes: number
  downvotes: number
  totalVotes: number
  userVote: string | null
}

interface LikeData {
  likeCount: number
  userLiked: boolean
}

interface Comment {
  id: number
  commentText: string
  parentCommentId: number | null
  likesCount: number
  createdAt: string
  updatedAt: string
  commenterName: string
  commenterStudentId: string
}

export function ProjectVoting({ projectId, studentId, onEngagementUpdate }: ProjectVotingProps) {
  const [voteData, setVoteData] = useState<VoteData>({ upvotes: 0, downvotes: 0, totalVotes: 0, userVote: null })
  const [likeData, setLikeData] = useState<LikeData>({ likeCount: 0, userLiked: false })
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [replyingTo, setReplyingTo] = useState<number | null>(null)
  const [replyText, setReplyText] = useState("")
  const [loading, setLoading] = useState(false)
  const [showComments, setShowComments] = useState(false)

  useEffect(() => {
    fetchVoteData()
    fetchLikeData()
    fetchComments()
  }, [projectId, studentId])

  const fetchVoteData = async () => {
    try {
      const response = await fetch(`/api/projects/vote?projectId=${projectId}&voterId=${studentId}`)
      if (response.ok) {
        const data = await response.json()
        setVoteData(data)
      }
    } catch (error) {
      console.error("Error fetching vote data:", error)
    }
  }

  const fetchLikeData = async () => {
    try {
      const response = await fetch(`/api/projects/like?projectId=${projectId}&likerId=${studentId}`)
      if (response.ok) {
        const data = await response.json()
        setLikeData(data)
      }
    } catch (error) {
      console.error("Error fetching like data:", error)
    }
  }

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/projects/comment?projectId=${projectId}&limit=50`)
      if (response.ok) {
        const data = await response.json()
        setComments(data.comments)
      }
    } catch (error) {
      console.error("Error fetching comments:", error)
    }
  }

  const handleVote = async (voteType: 'upvote' | 'downvote') => {
    if (loading) return
    
    setLoading(true)
    try {
      const response = await fetch('/api/projects/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, voterId: studentId, voteType })
      })

      if (response.ok) {
        await fetchVoteData()
        onEngagementUpdate?.()
        toast.success(voteType === 'upvote' ? 'Upvoted!' : 'Downvoted!')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to vote')
      }
    } catch (error) {
      console.error("Error voting:", error)
      toast.error('Failed to vote')
    } finally {
      setLoading(false)
    }
  }

  const handleLike = async () => {
    if (loading) return
    
    setLoading(true)
    try {
      const response = await fetch('/api/projects/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, likerId: studentId })
      })

      if (response.ok) {
        const data = await response.json()
        setLikeData(prev => ({ 
          likeCount: prev.likeCount + (data.liked ? 1 : -1), 
          userLiked: data.liked 
        }))
        onEngagementUpdate?.()
        toast.success(data.liked ? 'Liked!' : 'Unliked!')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to like')
      }
    } catch (error) {
      console.error("Error liking:", error)
      toast.error('Failed to like')
    } finally {
      setLoading(false)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || loading) return
    
    setLoading(true)
    try {
      const response = await fetch('/api/projects/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId, 
          commenterId: studentId, 
          commentText: newComment.trim() 
        })
      })

      if (response.ok) {
        setNewComment("")
        await fetchComments()
        onEngagementUpdate?.()
        toast.success('Comment added!')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add comment')
      }
    } catch (error) {
      console.error("Error adding comment:", error)
      toast.error('Failed to add comment')
    } finally {
      setLoading(false)
    }
  }

  const handleAddReply = async (parentCommentId: number) => {
    if (!replyText.trim() || loading) return
    
    setLoading(true)
    try {
      const response = await fetch('/api/projects/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId, 
          commenterId: studentId, 
          commentText: replyText.trim(),
          parentCommentId 
        })
      })

      if (response.ok) {
        setReplyText("")
        setReplyingTo(null)
        await fetchComments()
        onEngagementUpdate?.()
        toast.success('Reply added!')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add reply')
      }
    } catch (error) {
      console.error("Error adding reply:", error)
      toast.error('Failed to add reply')
    } finally {
      setLoading(false)
    }
  }

  const voteRatio = voteData.upvotes - voteData.downvotes

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Project Engagement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Voting Section */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant={voteData.userVote === 'upvote' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleVote('upvote')}
              disabled={loading}
              className="flex items-center gap-1"
            >
              <ThumbsUp className="h-4 w-4" />
              {voteData.upvotes}
            </Button>
            <Button
              variant={voteData.userVote === 'downvote' ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => handleVote('downvote')}
              disabled={loading}
              className="flex items-center gap-1"
            >
              <ThumbsDown className="h-4 w-4" />
              {voteData.downvotes}
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={likeData.userLiked ? 'default' : 'outline'}
              size="sm"
              onClick={handleLike}
              disabled={loading}
              className="flex items-center gap-1"
            >
              <Heart className={`h-4 w-4 ${likeData.userLiked ? 'fill-current' : ''}`} />
              {likeData.likeCount}
            </Button>
          </div>

          <Badge variant={voteRatio >= 0 ? 'default' : 'destructive'} className="ml-auto">
            Score: {voteRatio > 0 ? '+' : ''}{voteRatio}
          </Badge>
        </div>

        {/* Comments Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Comments ({comments.length})</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowComments(!showComments)}
            >
              {showComments ? 'Hide' : 'Show'} Comments
            </Button>
          </div>

          {/* Add Comment */}
          <div className="space-y-2">
            <Textarea
              placeholder="Share your thoughts about this project..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[80px]"
            />
            <div className="flex justify-end">
              <Button
                onClick={handleAddComment}
                disabled={!newComment.trim() || loading}
                size="sm"
              >
                Add Comment
              </Button>
            </div>
          </div>

          {/* Comments List */}
          <AnimatePresence>
            {showComments && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                {comments.map((comment) => (
                  <motion.div
                    key={comment.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-800"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {initialsFromName(comment.commenterName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{comment.commenterName}</span>
                          <Badge variant="outline" className="text-xs">
                            {comment.commenterStudentId}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm">{comment.commentText}</p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setReplyingTo(comment.id)}
                            className="text-xs"
                          >
                            <Reply className="h-3 w-3 mr-1" />
                            Reply
                          </Button>
                          {comment.likesCount > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {comment.likesCount} likes
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Reply Form */}
                    {replyingTo === comment.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-3 ml-11 space-y-2"
                      >
                        <Textarea
                          placeholder="Write a reply..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="min-h-[60px]"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleAddReply(comment.id)}
                            disabled={!replyText.trim() || loading}
                          >
                            Reply
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setReplyingTo(null)
                              setReplyText("")
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  )
}







