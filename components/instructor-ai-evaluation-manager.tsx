"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import {
  AlertTriangle,
  Bot,
  CheckCircle,
  CheckCircle2,
  Clock,
  FileCode,
  Loader2,
  RefreshCw,
  Send,
  TrendingUp,
  XCircle,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InstructorHeader } from "@/components/instructor-header"
import type { AssessmentType } from "@/context/assessment-context"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { cn } from "@/lib/utils"
import {
  AM_PANEL,
  AM_PANEL_FILL,
  AM_PANEL_SCROLL,
  AM_PANEL_SECTION,
  PORTAL_CTA,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/assessments/assessment-management-surface-classes"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"

interface FailedEvaluation {
  id: number
  attempt_id: number
  question_id: number
  student_id: number
  student_number: string | null
  student_name: string
  question_type: string
  assessment_type: string | null
  question_text: string
  student_answer: string
  correct_answer: string | null
  rubric: string | null
  max_points: number
  error_type: string
  error_message: string | null
  status: string
  created_at: string
  retry_count: number
  quiz_title: string
}

interface InstructorAiEvaluationManagerProps {
  assessmentTypeFilter?: AssessmentType
  assessmentLabel?: string
  variant?: "standalone" | "embedded"
  panelLayout?: boolean
}

const QUEUE_TAB_TRIGGER = cn(
  "group flex flex-1 items-center justify-center gap-1.5 rounded-lg border-0 px-2 py-1.5 text-xs font-medium shadow-none transition-colors sm:gap-2 sm:px-3 sm:text-sm",
  "text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]",
  "data-[state=active]:bg-[var(--card)] data-[state=active]:text-[var(--cc-text)] data-[state=active]:shadow-sm",
)

const QUEUE_TAB_BADGE = cn(
  "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
  "bg-[var(--muted)] text-[var(--cc-text-muted)]",
  "group-data-[state=active]:bg-[var(--cc-accent)]/12 group-data-[state=active]:text-[var(--cc-accent-dark)] dark:group-data-[state=active]:text-[var(--cc-accent)]",
)

function facultyModuleIdFromAssessment(type?: AssessmentType): string {
  switch (type) {
    case "homework":
      return "homeworks"
    case "mid_semester":
      return "mid-semester"
    case "final":
      return "final-exams"
    default:
      return "quizzes"
  }
}

export function InstructorAiEvaluationManager({
  assessmentTypeFilter,
  assessmentLabel,
  variant = "standalone",
  panelLayout = false,
}: InstructorAiEvaluationManagerProps) {
  const { toast } = useToast()
  const [failedEvaluations, setFailedEvaluations] = useState<FailedEvaluation[]>([])
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState<number | null>(null)
  const [bulkRetrying, setBulkRetrying] = useState(false)
  const [manualGradeDialog, setManualGradeDialog] = useState(false)
  const [selectedEvaluation, setSelectedEvaluation] = useState<FailedEvaluation | null>(null)
  const [manualScore, setManualScore] = useState("")
  const [manualFeedback, setManualFeedback] = useState("")
  const [submittingManual, setSubmittingManual] = useState(false)

  const isStandalone = variant === "standalone"
  const isPanel = panelLayout && !isStandalone
  const embedChrome = isPanel ? facultyEmbedChrome(facultyModuleIdFromAssessment(assessmentTypeFilter)) : null
  const tabContentClass = isPanel ? cn(AM_PANEL_SECTION, AM_PANEL_SCROLL, "mt-0 gap-3 p-4 sm:p-5") : "space-y-4"

  useEffect(() => {
    void fetchFailedEvaluations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentTypeFilter])

  const fetchFailedEvaluations = async () => {
    setLoading(true)
    try {
      const instructorSession = localStorage.getItem("instructorSession")
      if (!instructorSession) {
        toast({
          title: "Authentication Required",
          description: "Please log in to continue",
          variant: "destructive",
        })
        return
      }

      const params = assessmentTypeFilter ? `?assessment_type=${assessmentTypeFilter}` : ""
      const response = await instructorApiFetch(`/api/instructor/ai-evaluation/queue${params}`, {
        headers: buildInstructorAuthorizedApiHeaders(),
      })
      if (response.ok) {
        const data = await response.json()
        setFailedEvaluations(data.evaluations || [])
      } else {
        throw new Error("Failed to fetch AI queue")
      }
    } catch (error) {
      console.error("Failed to fetch failed evaluations:", error)
      toast({
        title: "Error Loading Data",
        description: "Could not load AI evaluation queue",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRetryAI = async (evaluationId: number) => {
    setRetrying(evaluationId)
    try {
      const response = await instructorApiFetch("/api/instructor/ai-evaluation/retry", {
        method: "POST",
        headers: buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ evaluationId }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: "✅ AI Re-evaluation Successful",
          description: `Score: ${data.score}% - Feedback provided to student`,
        })
        await fetchFailedEvaluations()
      } else {
        toast({
          title: "⚠️ AI Re-evaluation Failed",
          description: data.message || "The AI service is still unavailable. Try manual grading instead.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Retry failed:", error)
      toast({
        title: "Error",
        description: "Failed to retry AI evaluation",
        variant: "destructive",
      })
    } finally {
      setRetrying(null)
    }
  }

  const handleBulkRetry = async () => {
    setBulkRetrying(true)
    try {
      const response = await instructorApiFetch("/api/instructor/ai-evaluation/bulk-retry", {
        method: "POST",
        headers: buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ 
          assessmentType: assessmentTypeFilter,
          maxRetries: 50 // Limit to prevent overwhelming
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to perform bulk retry")
      }

      const result = await response.json()
      
      if (result.success) {
        toast({
          title: "🚀 Bulk Retry Completed",
          description: `Processed ${result.processed} evaluations: ${result.successful} successful, ${result.failed} still need manual review`,
          duration: 6000,
        })
        
        // Refresh the list
        await fetchFailedEvaluations()
      } else {
        throw new Error(result.error || "Bulk retry failed")
      }
    } catch (error) {
      console.error("Error performing bulk retry:", error)
      toast({
        title: "❌ Bulk Retry Failed",
        description: error instanceof Error ? error.message : "Failed to perform bulk retry",
        variant: "destructive",
      })
    } finally {
      setBulkRetrying(false)
    }
  }

  const handleManualGrade = (evaluation: FailedEvaluation) => {
    setSelectedEvaluation(evaluation)
    setManualScore("")
    setManualFeedback("")
    setManualGradeDialog(true)
  }

  const submitManualGrade = async () => {
    if (!selectedEvaluation) return

    const score = Number.parseFloat(manualScore)
    if (Number.isNaN(score) || score < 0 || score > selectedEvaluation.max_points) {
      toast({
        title: "Invalid Score",
        description: `Score must be between 0 and ${selectedEvaluation.max_points}`,
        variant: "destructive",
      })
      return
    }

    if (!manualFeedback.trim()) {
      toast({
        title: "Feedback Required",
        description: "Please provide feedback for the student",
        variant: "destructive",
      })
      return
    }

    setSubmittingManual(true)
    try {
      const response = await instructorApiFetch("/api/instructor/ai-evaluation/manual-grade", {
        method: "POST",
        headers: buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          evaluationId: selectedEvaluation.id,
          score,
          feedback: manualFeedback,
          maxPoints: selectedEvaluation.max_points,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast({
          title: "✅ Manual Grade Submitted",
          description: "Score and feedback have been sent to the student",
        })
        setManualGradeDialog(false)
        await fetchFailedEvaluations()
      } else {
        throw new Error(data.message || "Failed to submit manual grade")
      }
    } catch (error) {
      console.error("Manual grade failed:", error)
      toast({
        title: "Error",
        description: "Failed to submit manual grade",
        variant: "destructive",
      })
    } finally {
      setSubmittingManual(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />Pending
          </Badge>
        )
      case "retried":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            <RefreshCw className="h-3 w-3 mr-1" />Retried
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />Failed
          </Badge>
        )
      case "resolved":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />Resolved
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getErrorTypeBadge = (errorType: string) => {
    switch (errorType) {
      case "timeout":
        return (
          <Badge variant="outline" className="bg-orange-50 text-orange-700">
            <Clock className="h-3 w-3 mr-1" />Timeout
          </Badge>
        )
      case "connection":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700">
            <AlertTriangle className="h-3 w-3 mr-1" />Connection
          </Badge>
        )
      case "config":
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700">
            <Bot className="h-3 w-3 mr-1" />Config
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700">
            {errorType || "Unknown"}
          </Badge>
        )
    }
  }

  const pendingEvaluations = useMemo(
    () => failedEvaluations.filter((evaluation) => evaluation.status === "pending"),
    [failedEvaluations],
  )
  const retriedEvaluations = useMemo(
    () => failedEvaluations.filter((evaluation) => evaluation.status === "retried"),
    [failedEvaluations],
  )
  const failedPermanently = useMemo(
    () => failedEvaluations.filter((evaluation) => evaluation.status === "failed"),
    [failedEvaluations],
  )

  const headingTitle = isStandalone
    ? "AI Evaluation Management"
    : `${assessmentLabel ?? "Assessment"} AI Evaluation Queue`
  const headingDescription = isStandalone
    ? "Review, retry, and manually grade failed AI evaluations for your students"
    : `Review AI grading fallbacks for ${assessmentLabel?.toLowerCase() ?? "this assessment type"}.`

  const containerClass = isStandalone
    ? "min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900"
    : isPanel
      ? AM_PANEL_SECTION
      : "space-y-6"

  const contentWrapperClass = isStandalone
    ? "container mx-auto px-4 py-8"
    : isPanel
      ? "flex min-h-0 flex-1 flex-col overflow-hidden"
      : "space-y-6"

  const renderEmptyState = (icon: ReactNode, title: string, description: string) => {
    if (isPanel) {
      return (
        <div className={cn(AM_PANEL, "flex min-h-0 flex-1 flex-col overflow-hidden")}>
          <div className={cn(AM_PANEL_FILL, "gap-3 px-4 py-16 text-center")}>
            {icon}
            <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>{title}</p>
            <p className={cn("max-w-sm text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>{description}</p>
          </div>
        </div>
      )
    }

    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            {icon}
            <p className="text-slate-600 dark:text-slate-300 font-medium">{title}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{description}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderLoadingState = () => {
    if (isPanel) {
      return (
        <div className={cn(AM_PANEL, "flex min-h-0 flex-1 flex-col overflow-hidden")}>
          <div className={cn(AM_PANEL_FILL, "gap-3 px-4 py-16")}>
            <Loader2 className="h-8 w-8 animate-spin text-[var(--cc-accent)]" />
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Loading AI evaluation queue…</p>
          </div>
        </div>
      )
    }

    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-slate-600 dark:text-slate-300">Loading AI evaluation queue...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderQueueTabs = (compactHeader: boolean) => (
    <Tabs defaultValue="pending" className={cn(isPanel ? AM_PANEL_SECTION : "space-y-6")}>
      <div
        className={cn(
          "shrink-0 border-b border-[var(--border)]",
          compactHeader ? "space-y-3 px-4 py-3 sm:px-5" : "space-y-4",
        )}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2
              className={cn(
                isStandalone
                  ? "text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"
                  : cn("text-sm font-semibold", PORTAL_TEXT),
              )}
            >
              {headingTitle}
            </h2>
            <p
              className={cn(
                "text-xs sm:text-sm",
                isStandalone ? "text-slate-600 dark:text-slate-400" : PORTAL_TEXT_MUTED,
              )}
            >
              {headingDescription}
              {assessmentTypeFilter ? (
                <>
                  {" "}
                  Filtering by{" "}
                  <span className="font-medium text-[var(--cc-text)]">
                    {assessmentLabel ?? assessmentTypeFilter}
                  </span>
                  .
                </>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              onClick={() => fetchFailedEvaluations()}
              variant="outline"
              size="sm"
              className={cn(
                "h-9 gap-2",
                isPanel && embedChrome ? embedChrome.quiet : undefined,
              )}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            {failedEvaluations.length > 0 && (
              <Button
                onClick={handleBulkRetry}
                disabled={bulkRetrying}
                size="sm"
                className={cn(
                  "gap-2 h-9",
                  isStandalone
                    ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                    : PORTAL_CTA,
                )}
              >
                {bulkRetrying ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Bot className="h-4 w-4" />
                    Bulk Retry ({failedEvaluations.length})
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <TabsList
          className={cn(
            "h-auto w-full gap-1 p-1 shadow-none",
            isPanel
              ? "inline-flex rounded-xl border border-[var(--border)] bg-[var(--muted)]/35"
              : "grid max-w-3xl grid-cols-3 rounded-xl border border-[var(--border)] bg-white dark:bg-slate-800",
          )}
        >
          <TabsTrigger value="pending" className={isPanel ? QUEUE_TAB_TRIGGER : "gap-2"}>
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {isPanel ? (
              <>
                <span>Pending</span>
                <span className={QUEUE_TAB_BADGE}>{pendingEvaluations.length}</span>
              </>
            ) : (
              <>Pending ({pendingEvaluations.length})</>
            )}
          </TabsTrigger>
          <TabsTrigger value="retried" className={isPanel ? QUEUE_TAB_TRIGGER : "gap-2"}>
            <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {isPanel ? (
              <>
                <span>Retried</span>
                <span className={QUEUE_TAB_BADGE}>{retriedEvaluations.length}</span>
              </>
            ) : (
              <>Retried ({retriedEvaluations.length})</>
            )}
          </TabsTrigger>
          <TabsTrigger value="failed" className={isPanel ? QUEUE_TAB_TRIGGER : "gap-2"}>
            <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {isPanel ? (
              <>
                <span>Failed</span>
                <span className={QUEUE_TAB_BADGE}>{failedPermanently.length}</span>
              </>
            ) : (
              <>Failed ({failedPermanently.length})</>
            )}
          </TabsTrigger>
        </TabsList>
      </div>

      {loading ? (
        renderLoadingState()
      ) : (
        <>
          <TabsContent value="pending" className={tabContentClass}>
            {pendingEvaluations.length === 0
              ? renderEmptyState(
                  <CheckCircle className="h-10 w-10 text-[var(--cc-sem-success)]" />,
                  "No pending evaluations",
                  "All AI evaluations are up to date!",
                )
              : pendingEvaluations.map((evaluation) => renderEvaluationCard(evaluation))}
          </TabsContent>

          <TabsContent value="retried" className={tabContentClass}>
            {retriedEvaluations.length === 0
              ? renderEmptyState(
                  <TrendingUp className="h-10 w-10 text-[var(--cc-accent)]" />,
                  "No retried evaluations",
                  "Everything here has either succeeded or awaits processing.",
                )
              : retriedEvaluations.map((evaluation) => renderEvaluationCard(evaluation))}
          </TabsContent>

          <TabsContent value="failed" className={tabContentClass}>
            {failedPermanently.length === 0
              ? renderEmptyState(
                  <CheckCircle2 className="h-10 w-10 text-[var(--cc-sem-success)]" />,
                  "No permanent failures",
                  "The AI has not encountered unrecoverable issues.",
                )
              : failedPermanently.map((evaluation) => renderEvaluationCard(evaluation))}
          </TabsContent>
        </>
      )}
    </Tabs>
  )

  const renderContent = () => {
    if (isPanel) {
      return renderQueueTabs(true)
    }

    return (
      <div className="space-y-4 sm:space-y-6">
        {renderQueueTabs(false)}
      </div>
    )
  }

  const renderEvaluationCard = (evaluation: FailedEvaluation) => (
    <Card key={evaluation.id} className="border-l-4 border-l-yellow-500">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{evaluation.quiz_title}</CardTitle>
            <CardDescription>
              Student: {evaluation.student_name}
              {evaluation.student_number ? ` (${evaluation.student_number})` : ""} • Question #{evaluation.question_id}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {getStatusBadge(evaluation.status)}
            {getErrorTypeBadge(evaluation.error_type)}
            {evaluation.assessment_type && (
              <Badge variant="outline" className="bg-slate-50 text-slate-700">
                {evaluation.assessment_type.replace("_", " ")}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-600 font-medium">Question Type:</p>
            <Badge variant="outline" className="mt-1">
              <FileCode className="h-3 w-3 mr-1" />
              {evaluation.question_type}
            </Badge>
          </div>
          <div>
            <p className="text-slate-600 font-medium">Max Points:</p>
            <p className="font-bold text-lg">{evaluation.max_points}</p>
          </div>
          <div>
            <p className="text-slate-600 font-medium">Retry Count:</p>
            <p className="font-semibold">{evaluation.retry_count}</p>
          </div>
          <div>
            <p className="text-slate-600 font-medium">Captured at:</p>
            <p className="text-slate-500 text-xs">{new Date(evaluation.created_at).toLocaleString()}</p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <p className="text-slate-600 font-medium mb-1">Question Prompt</p>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 whitespace-pre-wrap">
              {evaluation.question_text}
            </div>
          </div>
          <div>
            <p className="text-slate-600 font-medium mb-1">Student Answer</p>
            <div className="rounded-lg bg-slate-900 text-slate-100 border border-slate-800 p-3 overflow-x-auto text-xs">
              <pre>{evaluation.student_answer}</pre>
            </div>
          </div>
          {evaluation.error_message && (
            <div>
              <p className="text-slate-600 font-medium mb-1">Error Details</p>
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-700">
                {evaluation.error_message}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => handleRetryAI(evaluation.id)}
            disabled={retrying === evaluation.id}
            variant="outline"
            className="gap-2"
          >
            {retrying === evaluation.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Retry AI Evaluation
          </Button>
          <Button onClick={() => handleManualGrade(evaluation)} className="gap-2">
            <Send className="h-4 w-4" />
            Submit Manual Grade
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className={containerClass}>
      {isStandalone && <InstructorHeader />}
      <div className={contentWrapperClass}>{renderContent()}</div>

      <Dialog open={manualGradeDialog} onOpenChange={setManualGradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Manual Grade</DialogTitle>
            <DialogDescription>
              Provide a score and feedback for the student. This will override the AI evaluation result.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="manual-score">Score (0 - {selectedEvaluation?.max_points ?? 0})</Label>
              <Input
                id="manual-score"
                type="number"
                min={0}
                max={selectedEvaluation?.max_points ?? 0}
                step="0.1"
                value={manualScore}
                onChange={(event) => setManualScore(event.target.value)}
                placeholder="Enter score"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manual-feedback">Instructor Feedback</Label>
              <Textarea
                id="manual-feedback"
                rows={4}
                value={manualFeedback}
                onChange={(event) => setManualFeedback(event.target.value)}
                placeholder="Explain your grading decision so the student understands the outcome"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualGradeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => submitManualGrade()} disabled={submittingManual} className="gap-2">
              {submittingManual ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Submit Grade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
