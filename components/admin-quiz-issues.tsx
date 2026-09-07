"use client"


import { studentApiFetch } from "@/lib/auth"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { MessageSquare, CheckCircle, XCircle, Send } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface Issue {
  id: number
  quiz_id: number
  quiz_title: string
  question_number: number
  description: string
  status: "open" | "closed"
  student_name: string
  student_email: string
  created_at: string
  comment_count: number
}

interface Comment {
  id: number
  commenter_name: string
  commenter_role: string
  comment_text: string
  created_at: string
}

interface AdminQuizIssuesProps {
  assessmentType?: string
}

export function AdminQuizIssues({ assessmentType }: AdminQuizIssuesProps) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<"open" | "closed">("open")
  const [issues, setIssues] = useState<Issue[]>([])
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [loading, setLoading] = useState(false)
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [issueToClose, setIssueToClose] = useState<Issue | null>(null)
  const [resolutionComment, setResolutionComment] = useState("")

  useEffect(() => {
    fetchIssues()
  }, [activeTab, assessmentType])

  const fetchIssues = async () => {
    try {
      const params = new URLSearchParams()
      params.append("status", activeTab)
      if (assessmentType) {
        params.append("assessment_type", assessmentType)
      }

      const response = await fetch(`/api/admin/issues?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setIssues(data.issues || [])
        console.log(`[AdminQuizIssues] Fetched ${data.issues?.length || 0} issues for assessment_type: ${assessmentType}`)
      }
    } catch (error) {
      console.error("Failed to fetch issues:", error)
    }
  }

  const fetchComments = async (issueId: number) => {
    try {
      const response = await studentApiFetch(`/api/student/issues/${issueId}/comments`)
      if (response.ok) {
        const data = await response.json()
        setComments(data.comments || [])
      }
    } catch (error) {
      console.error("Failed to fetch comments:", error)
    }
  }

  const handleViewIssue = (issue: Issue) => {
    setSelectedIssue(issue)
    fetchComments(issue.id)
  }

  const handleAddComment = async () => {
    if (!selectedIssue || !newComment.trim()) return

    setLoading(true)
    try {
      const response = await studentApiFetch(`/api/student/issues/${selectedIssue.id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-username": "admin",
        },
        body: JSON.stringify({
          commenterName: "Admin",
          commenterRole: "admin",
          commentText: newComment,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Comment added successfully",
        })
        setNewComment("")
        fetchComments(selectedIssue.id)
      }
    } catch (error) {
      console.error("Failed to add comment:", error)
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCloseIssue = async (issueId: number, newStatus: "open" | "closed") => {
    if (newStatus === "closed") {
      // Show dialog for resolution comment
      const issue = issues.find(i => i.id === issueId)
      if (issue) {
        setIssueToClose(issue)
        setShowCloseDialog(true)
      }
      return
    }

    // For reopening, call API directly
    await performCloseIssue(issueId, newStatus, "")
  }

  const performCloseIssue = async (issueId: number, newStatus: "open" | "closed", resolutionComment: string) => {
    try {
      const response = await fetch(`/api/admin/issues/${issueId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, resolution_comment: resolutionComment }),
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: "Success",
          description: data.message || `Issue ${newStatus === "closed" ? "closed" : "reopened"} successfully`,
        })
        fetchIssues()
        setSelectedIssue(null)
        setShowCloseDialog(false)
        setIssueToClose(null)
        setResolutionComment("")
      } else {
        const errorData = await response.json()
        toast({
          title: "Error",
          description: errorData.error || "Failed to update issue",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to update issue:", error)
      toast({
        title: "Error",
        description: "Failed to update issue",
        variant: "destructive",
      })
    }
  }

  const handleConfirmClose = () => {
    if (issueToClose) {
      performCloseIssue(issueToClose.id, "closed", resolutionComment)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quiz Issues & Comments</CardTitle>
          <CardDescription>Manage student-reported quiz issues and concerns</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={activeTab === "open" ? "default" : "outline"}
              onClick={() => setActiveTab("open")}
              className="gap-2"
            >
              <XCircle className="h-4 w-4" />
              Open Issues ({issues.filter((i) => i.status === "open").length})
            </Button>
            <Button
              variant={activeTab === "closed" ? "default" : "outline"}
              onClick={() => setActiveTab("closed")}
              className="gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Closed Issues ({issues.filter((i) => i.status === "closed").length})
            </Button>
          </div>

          {/* Issues List */}
          <div className="space-y-4">
            {issues.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No {activeTab} issues found</div>
            ) : (
              issues.map((issue) => (
                <Card key={issue.id} className="border border-border/50">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">{issue.quiz_title}</CardTitle>
                          <Badge variant={issue.status === "open" ? "destructive" : "secondary"}>{issue.status}</Badge>
                        </div>
                        <CardDescription>
                          Question #{issue.question_number} • Reported by {issue.student_name}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-4">{issue.description}</p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleViewIssue(issue)}>
                        <MessageSquare className="h-4 w-4 mr-1" />
                        View ({issue.comment_count})
                      </Button>
                      {issue.status === "open" ? (
                        <Button variant="outline" size="sm" onClick={() => handleCloseIssue(issue.id, "closed")}>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Close Issue
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => handleCloseIssue(issue.id, "open")}>
                          <XCircle className="h-4 w-4 mr-1" />
                          Reopen Issue
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Issue Detail Dialog */}
      <Dialog open={!!selectedIssue} onOpenChange={() => setSelectedIssue(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedIssue?.quiz_title} - Question #{selectedIssue?.question_number}
            </DialogTitle>
            <DialogDescription>
              Reported by {selectedIssue?.student_name} on{" "}
              {selectedIssue && new Date(selectedIssue.created_at).toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Original Issue */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Issue Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{selectedIssue?.description}</p>
              </CardContent>
            </Card>

            {/* Comments Thread */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Comments</h4>
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet</p>
              ) : (
                comments.map((comment) => (
                  <Card key={comment.id} className="border border-border/50">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">{comment.commenter_name}</span>
                            <Badge variant="outline" className="text-xs">
                              {comment.commenter_role}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(comment.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm">{comment.comment_text}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Add Comment */}
            <div className="space-y-2">
              <Textarea
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={3}
              />
              <Button onClick={handleAddComment} disabled={loading || !newComment.trim()} className="gap-2">
                <Send className="h-4 w-4" />
                Add Comment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close Issue Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Close Issue</DialogTitle>
            <DialogDescription>
              {issueToClose && (
                <>
                  Close issue for <strong>{issueToClose.quiz_title}</strong> reported by {issueToClose.student_name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Resolution Comment (Optional)</label>
              <Textarea
                placeholder="Add a comment explaining how the issue was resolved..."
                value={resolutionComment}
                onChange={(e) => setResolutionComment(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                This comment will be included in the notification sent to the student.
              </p>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCloseDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmClose} className="gap-2">
                <CheckCircle className="h-4 w-4" />
                Close Issue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
