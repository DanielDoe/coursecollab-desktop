"use client"


import { studentApiFetch } from "@/lib/auth"
import { useCallback, useMemo, useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { MessageSquare, CheckCircle, XCircle, Send } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { buildAdminAuthorizedApiHeaders } from "@/lib/admin-api-headers"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { cn } from "@/lib/utils"
import { AM_PANEL_FILL, AM_PANEL_SCROLL, AM_PANEL_SECTION } from "@/lib/assessments/assessment-management-surface-classes"
import type { PortalKind } from "@/lib/portal-config"

function resolveIssuesApiHeaders(portal: PortalKind): Record<string, string> {
  if (typeof localStorage === "undefined") return {}
  if (portal === "admin") return buildAdminAuthorizedApiHeaders()
  return buildInstructorAuthorizedApiHeaders()
}

function readSelectedCourseCode(): string {
  if (typeof localStorage === "undefined") return ""
  try {
    const raw = localStorage.getItem("instructorSession")
    if (!raw) return ""
    const session = JSON.parse(raw) as {
      selectedCourseCode?: string
      courseScopeSkipped?: boolean
    }
    if (session.courseScopeSkipped) return ""
    return String(session.selectedCourseCode ?? "").trim()
  } catch {
    return ""
  }
}

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
  assessment_type?: string
}

interface Comment {
  id: number
  commenter_name: string
  commenter_role: string
  comment_text: string
  created_at: string
}

interface InstructorQuizIssuesProps {
  assessmentId?: number
  assessmentType?: string
  /** Course code for headings (falls back to selected course in instructor session). */
  courseCode?: string
  /** Fill dashboard panel height when embedded in FacultyModuleSplitLayout. */
  panelLayout?: boolean
}

export function InstructorQuizIssues({
  assessmentId,
  assessmentType,
  courseCode: courseCodeProp,
  panelLayout = false,
}: InstructorQuizIssuesProps) {
  const { toast } = useToast()
  const { portal } = useInstructorDashboardV2()
  const [activeTab, setActiveTab] = useState<"open" | "closed">("open")
  const [issues, setIssues] = useState<Issue[]>([])
  const [openCount, setOpenCount] = useState(0)
  const [closedCount, setClosedCount] = useState(0)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [loading, setLoading] = useState(false)
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [issueToClose, setIssueToClose] = useState<Issue | null>(null)
  const [resolutionComment, setResolutionComment] = useState("")
  const [scopeVersion, setScopeVersion] = useState(0)
  const [courseCodeState, setCourseCodeState] = useState("")

  useEffect(() => {
    const refreshScope = () => {
      setScopeVersion((v) => v + 1)
      setCourseCodeState(readSelectedCourseCode())
    }
    refreshScope()
    window.addEventListener("instructor-session-updated", refreshScope)
    window.addEventListener("admin-session-updated", refreshScope)
    return () => {
      window.removeEventListener("instructor-session-updated", refreshScope)
      window.removeEventListener("admin-session-updated", refreshScope)
    }
  }, [])

  const courseCode = (courseCodeProp || courseCodeState).trim()
  const issuesApiHeaders = useMemo(() => resolveIssuesApiHeaders(portal), [scopeVersion, portal])

  const issuesTitle = useMemo(() => {
    const scope = courseCode ? `${courseCode} ` : assessmentId ? "Assessment " : "All "
    return `${scope}Issues & Comments`
  }, [courseCode, assessmentId])

  const issuesDescription = useMemo(() => {
    if (assessmentId) {
      return courseCode
        ? `Student-reported issues for this assessment in ${courseCode}`
        : "Manage student-reported issues for this assessment"
    }
    if (courseCode) {
      return `Manage student-reported issues for ${courseCode} assessments in this category`
    }
    return "Manage all student-reported assessment issues and concerns"
  }, [assessmentId, courseCode])

  const fetchIssues = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.append("status", activeTab)
      if (assessmentId) params.append("assessmentId", assessmentId.toString())
      if (assessmentType) params.append("assessmentType", assessmentType)

      const response = await instructorApiFetch(`/api/instructor/issues?${params.toString()}`, {
        headers: issuesApiHeaders,
      })
      if (response.ok) {
        const data = await response.json()
        setIssues(data.issues || [])
      }
    } catch (error) {
      console.error("Failed to fetch issues:", error)
    }
  }, [activeTab, assessmentId, assessmentType, issuesApiHeaders])

  const fetchCounts = useCallback(async () => {
    try {
      const openParams = new URLSearchParams()
      openParams.append("status", "open")
      if (assessmentId) openParams.append("assessmentId", assessmentId.toString())
      if (assessmentType) openParams.append("assessmentType", assessmentType)

      const openResponse = await instructorApiFetch(`/api/instructor/issues?${openParams.toString()}`, {
        headers: issuesApiHeaders,
      })
      if (openResponse.ok) {
        const openData = await openResponse.json()
        setOpenCount(openData.issues?.length || 0)
      }

      const closedParams = new URLSearchParams()
      closedParams.append("status", "closed")
      if (assessmentId) closedParams.append("assessmentId", assessmentId.toString())
      if (assessmentType) closedParams.append("assessmentType", assessmentType)

      const closedResponse = await instructorApiFetch(`/api/instructor/issues?${closedParams.toString()}`, {
        headers: issuesApiHeaders,
      })
      if (closedResponse.ok) {
        const closedData = await closedResponse.json()
        setClosedCount(closedData.issues?.length || 0)
      }
    } catch (error) {
      console.error("Failed to fetch counts:", error)
    }
  }, [assessmentId, assessmentType, issuesApiHeaders])

  useEffect(() => {
    void fetchIssues()
    void fetchCounts()
  }, [fetchIssues, fetchCounts, scopeVersion])

  const fetchComments = async (issueId: number) => {
    try {
      const instructorSession = localStorage.getItem("instructorSession")
      const response = await studentApiFetch(`/api/student/issues/${issueId}/comments`, {
        headers: instructorSession ? { Authorization: instructorSession } : {},
      })
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
      const instructorSession = localStorage.getItem("instructorSession")
      if (!instructorSession) {
        toast({
          title: "Error",
          description: "Instructor session not found",
          variant: "destructive",
        })
        return
      }

      const session = JSON.parse(instructorSession)
      
      const commentPayload = {
        commenterName: session.full_name || session.username || "Instructor",
        commenterId: session.id || session.instructor_id || session.username || "instructor",
        commenterRole: "instructor",
        commentText: newComment,
      }
      
      console.log("[Instructor Issues] Adding comment with payload:", commentPayload)
      console.log("[Instructor Issues] Issue ID:", selectedIssue.id)
      
      const response = await studentApiFetch(`/api/student/issues/${selectedIssue.id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-instructor-username": session.username || "instructor",
        },
        body: JSON.stringify(commentPayload),
      })
      
      console.log("[Instructor Issues] Comment response status:", response.status)

      if (response.ok) {
        toast({
          title: "Success",
          description: "Comment added successfully",
        })
        setNewComment("")
        fetchComments(selectedIssue.id)
      } else {
        console.error("[Instructor Issues] Comment failed with status:", response.status)
        let errorMessage = "Failed to add comment"
        try {
          const errorData = await response.json()
          console.error("[Instructor Issues] Error data:", errorData)
          errorMessage = errorData.error || errorMessage
        } catch (parseError) {
          const errorText = await response.text()
          console.error("[Instructor Issues] Error response (text):", errorText)
          errorMessage = errorText || errorMessage
        }
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[Instructor Issues] Failed to add comment:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add comment",
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
      const response = await instructorApiFetch(`/api/instructor/issues/${issueId}/close`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...issuesApiHeaders,
        },
        body: JSON.stringify({ status: newStatus, resolution_comment: resolutionComment }),
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: "Success",
          description: data.message || `Issue ${newStatus === "closed" ? "closed" : "reopened"} successfully`,
        })
        fetchIssues()
        fetchCounts() // Refresh counts after closing/reopening
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
    <div className={cn(panelLayout ? AM_PANEL_SECTION : "space-y-6")}>
      <Card className={cn(panelLayout && "flex min-h-0 flex-1 flex-col overflow-hidden")}>
        <CardHeader className="shrink-0">
          <CardTitle>{issuesTitle}</CardTitle>
          <CardDescription>{issuesDescription}</CardDescription>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">
            Do not dismiss concerns—some may indicate critical errors. Investigate before closing. Use Reopen if a fix didn&apos;t work.
          </p>
        </CardHeader>
        <CardContent className={cn(panelLayout && "flex min-h-0 flex-1 flex-col overflow-hidden")}>
          {/* Tabs */}
          <div className="flex gap-2 mb-6 shrink-0">
            <Button
              variant={activeTab === "open" ? "default" : "outline"}
              onClick={() => setActiveTab("open")}
              className="gap-2"
            >
              <XCircle className="h-4 w-4" />
              Open Issues ({openCount})
            </Button>
            <Button
              variant={activeTab === "closed" ? "default" : "outline"}
              onClick={() => setActiveTab("closed")}
              className="gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Closed Issues ({closedCount})
            </Button>
          </div>

          {/* Issues List */}
          <div className={cn("space-y-4", panelLayout && cn(AM_PANEL_SECTION, AM_PANEL_SCROLL))}>
            {issues.length === 0 ? (
              <div className={cn("text-center py-12 text-muted-foreground", panelLayout && AM_PANEL_FILL)}>
                No {activeTab} issues found
              </div>
            ) : (
              issues.map((issue) => (
                <Card key={issue.id} className="border border-border/50">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base">{issue.quiz_title}</CardTitle>
                          <Badge variant={issue.status === "open" ? "destructive" : "secondary"}>{issue.status}</Badge>
                          {issue.assessment_type && (
                            <Badge variant="outline" className="text-xs">
                              {issue.assessment_type.replace('_', ' ')}
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="space-y-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium">Question #{issue.question_number}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-semibold text-blue-600 dark:text-blue-400">{issue.student_name}</span>
                            {issue.student_email && (
                              <>
                                <span>•</span>
                                <span className="text-muted-foreground">{issue.student_email}</span>
                              </>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Reported on {new Date(issue.created_at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </div>
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-4 text-slate-700 dark:text-slate-300">{issue.description}</p>
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
              <h4 className="font-semibold text-sm">Comments ({comments.length})</h4>
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet</p>
              ) : (
                comments.map((comment) => (
                  <Card key={comment.id} className={`border ${
                    comment.commenter_role === 'instructor' || comment.commenter_role === 'admin' 
                      ? 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30' 
                      : 'border-border/50'
                  }`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-semibold text-sm ${
                              comment.commenter_role === 'instructor' || comment.commenter_role === 'admin'
                                ? 'text-blue-700 dark:text-blue-400'
                                : 'text-slate-700 dark:text-slate-300'
                            }`}>
                              {comment.commenter_name}
                            </span>
                            <Badge 
                              variant={comment.commenter_role === 'instructor' || comment.commenter_role === 'admin' ? 'default' : 'outline'} 
                              className="text-xs"
                            >
                              {comment.commenter_role}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(comment.created_at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </div>
                          <p className="text-sm text-slate-700 dark:text-slate-300">{comment.comment_text}</p>
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

