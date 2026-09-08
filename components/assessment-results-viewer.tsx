"use client"

import { useState, useEffect } from "react"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Download, 
  Users, 
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react"
import { GrantExtensionModal } from "@/components/grant-extension-modal"
import { dbTimeToCDT } from "@/lib/timezone"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { AM_PANEL, AM_PANEL_FILL, AM_PANEL_SCROLL, AM_PANEL_SECTION, PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/assessments/assessment-management-surface-classes"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { useToast } from "@/components/ui/use-toast"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { instructorQuizzesAssessmentTypeParam } from "@/lib/instructor-quizzes-api-params"
import { instructorResultDetailPath } from "@/lib/instructor-results-navigation"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"

interface Result {
  attemptId: number
  studentId: number
  studentName: string
  studentNumber: string
  studentEmail: string
  section: string
  quizId?: number
  examId?: number
  quizTitle?: string
  examTitle?: string
  totalPoints: number
  score: number
  percentage: number
  startedAt: string
  completedAt: string
  timeTakenSeconds: number
  isFlagged: boolean
  tabSwitchCount: number
  copyPasteAttempts: number
  mouseLeaveCount: number
}

interface Props {
  assessmentType: 'quiz' | 'mid_semester' | 'final' | 'homework' | 'practice' | 'playground'
  embedInDashboard?: boolean
  /** When true, show only flagged attempts (score_pending, evaluation_failed, submission_stalled, anti-cheat) */
  showFlaggedOnly?: boolean
}

function IncompleteSubmitButton({
  studentName,
  studentId,
  quizId,
  answersCount,
  onSuccess,
}: {
  studentName: string
  studentId: number
  quizId: string
  answersCount: number
  onSuccess: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const res = await instructorApiFetch("/api/instructor/submit-on-behalf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildInstructorAuthorizedApiHeaders(),
        },
        body: JSON.stringify({ studentId, quizId: parseInt(quizId, 10) }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || "Failed", variant: "destructive" })
        return
      }
      toast({ title: "Submitted", description: data.message })
      onSuccess()
    } catch {
      toast({ title: "Failed to submit", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleSubmit}
      disabled={submitting}
      className="text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40"
    >
      {submitting ? "Submitting..." : `${studentName} (${answersCount} answers) — Submit`}
    </Button>
  )
}

export function AssessmentResultsViewer({ assessmentType, embedInDashboard, showFlaggedOnly = false }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const { courseScopeVersion } = useInstructorDashboardV2()
  const scopedHeaders = buildInstructorAuthorizedApiHeaders()
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<any[]>([])
  const [assessments, setAssessments] = useState<any[]>([])
  const persistPrefix = `instructor-assessment-results-${assessmentType}-${embedInDashboard ? "dash" : "legacy"}`
  const [selectedSession, setSelectedSession] = usePersistedState<string>(`${persistPrefix}-session`, "all", "local")
  const [selectedAssessment, setSelectedAssessment] = usePersistedState<string>(
    `${persistPrefix}-assessment`,
    "all",
    "local"
  )
  // For homework, show all attempts by default since they typically don't have is_final_grade set
  const [showAllAttempts, setShowAllAttempts] = usePersistedState<boolean>(
    `${persistPrefix}-showAllAttempts`,
    assessmentType === "homework",
    "local"
  )

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = usePersistedState<number>(`${persistPrefix}-itemsPerPage`, 10, "local")
  const [grantExtensionOpen, setGrantExtensionOpen] = useState(false)
  const [incompleteAttempts, setIncompleteAttempts] = useState<any[]>([])
  const [incompleteLoading, setIncompleteLoading] = useState(false)
  
  // Calculate pagination
  const totalPages = Math.ceil(results.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedResults = results.slice(startIndex, endIndex)
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedSession, selectedAssessment, assessmentType, showAllAttempts])

  useEffect(() => {
    fetchSessions()
    fetchAssessments()
  }, [assessmentType, courseScopeVersion])

  useEffect(() => {
    if (!embedInDashboard || courseScopeVersion === 0) return
    setSelectedAssessment("all")
    try {
      const raw = localStorage.getItem("instructorSession")
      if (raw) {
        const parsed = JSON.parse(raw) as { selectedSessionId?: number }
        if (typeof parsed.selectedSessionId === "number" && Number.isFinite(parsed.selectedSessionId)) {
          setSelectedSession(String(parsed.selectedSessionId))
          return
        }
      }
    } catch {
      /* ignore */
    }
    setSelectedSession("all")
  }, [courseScopeVersion, embedInDashboard, setSelectedSession, setSelectedAssessment])

  useEffect(() => {
    fetchResults()
  }, [selectedSession, selectedAssessment, assessmentType, showAllAttempts, showFlaggedOnly, courseScopeVersion])

  useEffect(() => {
    if (selectedAssessment !== "all" && assessmentType !== "mid_semester" && assessmentType !== "final") {
      setIncompleteLoading(true)
      const params = new URLSearchParams({
        quizId: selectedAssessment,
        ...(selectedSession !== "all" && { sessionId: selectedSession }),
      })
      instructorApiFetch(`/api/instructor/incomplete-attempts?${params}`, {
        headers: scopedHeaders,
      })
        .then((r) => r.json())
        .then((res) => setIncompleteAttempts(res.incomplete || []))
        .catch(() => setIncompleteAttempts([]))
        .finally(() => setIncompleteLoading(false))
    } else {
      setIncompleteAttempts([])
    }
  }, [selectedAssessment, selectedSession, assessmentType, courseScopeVersion])

  // Refetch when re-evaluate completes so scores update in the UI
  useEffect(() => {
    const handler = () => fetchResults()
    window.addEventListener("instructor-re-evaluate-complete", handler)
    return () => window.removeEventListener("instructor-re-evaluate-complete", handler)
  }, [selectedSession, selectedAssessment, assessmentType, showAllAttempts, showFlaggedOnly, courseScopeVersion])

  const fetchSessions = async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/sessions", {
        headers: scopedHeaders,
      })
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions || [])
      }
    } catch (error) {
      console.error("Error fetching sessions:", error)
    }
  }

  const fetchAssessments = async () => {
    try {
      const typeParam = instructorQuizzesAssessmentTypeParam(assessmentType)
      const response = await instructorApiFetch(`/api/instructor/quizzes?assessmentType=${encodeURIComponent(typeParam)}`, {
        headers: scopedHeaders,
      })
      if (response.ok) {
        const data = await response.json()
        console.log(`[AssessmentResultsViewer] Fetched ${assessmentType} assessments:`, data.quizzes)
        // API already filters by assessment_type, no need to filter again
        const assessments = data.quizzes || []
        console.log(`[AssessmentResultsViewer] Setting ${assessmentType} assessments:`, assessments)
        setAssessments(assessments)
      }
    } catch (error) {
      console.error("Error fetching assessments:", error)
    }
  }

  const fetchResults = async () => {
    try {
      setLoading(true)
      
      console.log('[Assessment Results] Fetching for type:', assessmentType);
      
      const params = new URLSearchParams({
        ...(selectedSession !== "all" && { sessionId: selectedSession }),
        ...(selectedAssessment !== "all" && { 
          [assessmentType === 'mid_semester' || assessmentType === 'final' ? 'examId' : 'quizId']: selectedAssessment 
        }),
        ...(showAllAttempts && { showAll: 'true' }),
        assessmentType: assessmentType // Always pass the assessment type for filtering
      })

      // Map assessment types to API endpoints
      let endpoint;
      if (assessmentType === 'mid_semester') {
        endpoint = `/api/instructor/midsemester-results?${params}`;
      } else if (assessmentType === 'final') {
        endpoint = `/api/instructor/final-results?${params}`;
      } else {
        // Use quiz-results endpoint for quiz, homework, and other types
        endpoint = `/api/instructor/quiz-results?${params}`;
      }

      console.log('[Assessment Results] Assessment type:', assessmentType);
      console.log('[Assessment Results] Endpoint:', endpoint);

      const response = await fetch(endpoint, {
        headers: scopedHeaders,
      })

      if (response.ok) {
        const data = await response.json()
        let rawResults = data.results || []
        if (showFlaggedOnly) {
          rawResults = rawResults.filter((r: Result) => r.isFlagged === true)
        }
        setResults(rawResults)
      } else {
        // Try to parse error response, but handle empty or invalid JSON
        let errorData: any = {}
        const responseText = await response.text()
        if (responseText) {
          try {
            errorData = JSON.parse(responseText)
          } catch (e) {
            // Not JSON, use the text as error message
            errorData = { error: responseText || `Server error: ${response.status}` }
          }
        } else {
          errorData = { error: `Server error: ${response.status} ${response.statusText}` }
        }
        
        console.error('[Assessment Results] Error response:', errorData);
        toast({
          title: "Error",
          description: errorData.error || errorData.message || `Failed to fetch results (${response.status})`,
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("[Assessment Results] Error fetching results:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    if (results.length === 0) {
      toast({
        title: "No Data",
        description: "No results to export",
        variant: "destructive"
      })
      return
    }

    const headers = ["Student Name", "Student ID", "Section", assessmentType === 'quiz' ? "Quiz" : "Exam", "Score", "Percentage", "Completed At", "Time (min)", "Flagged"]
    const rows = results.map(r => [
      r.studentName,
      r.studentNumber,
      r.section,
      r.quizTitle || r.examTitle || '',
      `${r.score.toFixed(2)}/${r.totalPoints}`,
      `${r.percentage}%`,
      dbTimeToCDT(r.completedAt),
      Math.round(r.timeTakenSeconds / 60),
      r.isFlagged ? "Yes" : "No"
    ])

    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${assessmentType}-results-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)

    toast({
      title: "Success",
      description: "Results exported to CSV"
    })
  }

  const getGradeColor = (percentage: number) => {
    if (embedInDashboard) {
      if (percentage >= 90) {
        return "border border-emerald-400/50 bg-emerald-500/20 text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      }
      if (percentage >= 80) {
        return "border border-sky-400/50 bg-sky-500/20 text-sky-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      }
      if (percentage >= 70) {
        return "border border-amber-400/50 bg-amber-500/20 text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      }
      if (percentage >= 60) {
        return "border border-orange-400/50 bg-orange-500/20 text-orange-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      }
      return "border border-rose-400/50 bg-rose-500/20 text-rose-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
    }
    if (percentage >= 90) return "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20"
    if (percentage >= 80) return "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
    if (percentage >= 70) return "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20"
    if (percentage >= 60) return "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20"
    return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
  }

  const getLetterGradeBadgeClass = (percentage: number) => {
    if (embedInDashboard) {
      if (percentage >= 90) return "bg-emerald-500/30 text-emerald-100 ring-1 ring-emerald-400/40"
      if (percentage >= 80) return "bg-sky-500/30 text-sky-100 ring-1 ring-sky-400/40"
      if (percentage >= 70) return "bg-amber-500/30 text-amber-50 ring-1 ring-amber-400/40"
      if (percentage >= 60) return "bg-orange-500/30 text-orange-50 ring-1 ring-orange-400/40"
      return "bg-rose-500/30 text-rose-100 ring-1 ring-rose-400/40"
    }
    return getGradeColor(percentage)
  }

  const getLetterGradeColor = (percentage: number) => {
    if (percentage >= 90) return "text-emerald-600 dark:text-emerald-300"
    if (percentage >= 80) return "text-sky-600 dark:text-sky-300"
    if (percentage >= 70) return "text-amber-600 dark:text-amber-200"
    if (percentage >= 60) return "text-orange-600 dark:text-orange-200"
    return "text-rose-600 dark:text-rose-300"
  }

  const getLetterGrade = (percentage: number) => {
    if (percentage >= 90) return "A"
    if (percentage >= 80) return "B"
    if (percentage >= 70) return "C"
    if (percentage >= 60) return "D"
    return "F"
  }

  if (loading && results.length === 0) {
    return (
      <div className={cn("flex items-center justify-center", embedInDashboard ? cn(AM_PANEL_SECTION, AM_PANEL_FILL) : "min-h-[320px]")}>
        <div className="text-center space-y-3">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--cc-accent)] border-t-transparent" />
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Loading results…</p>
        </div>
      </div>
    )
  }

  const assessmentLabel = assessmentType === 'mid_semester' ? 'Mid-Semester Exam' : 
                           assessmentType === 'final' ? 'Final Exam' :
                           assessmentType === 'homework' ? 'Homework' : 'Quiz';
  const assessmentPluralLabel = assessmentType === 'mid_semester' ? 'Mid-Semester Exams' : 
                                 assessmentType === 'final' ? 'Final Exams' :
                                 assessmentType === 'homework' ? 'Homeworks' : 'Quizzes';
  const facultyModuleId =
    assessmentType === "homework"
      ? "homeworks"
      : assessmentType === "mid_semester"
        ? "mid-semester"
        : assessmentType === "final"
          ? "final-exams"
          : "quizzes"
  const chrome = embedInDashboard ? facultyEmbedChrome(facultyModuleId) : null
  const outlineBtn = embedInDashboard && chrome ? chrome.quiet : undefined
  const tableCard = embedInDashboard ? PORTAL_CARD : "min-w-0 max-w-full overflow-hidden border border-slate-200 dark:border-slate-800"
  const theadClass = embedInDashboard
    ? "border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_55%,var(--card))]"
    : "bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800"
  const thClass = embedInDashboard
    ? cn(
        "text-left px-4 sm:px-6 py-3 text-[11px] sm:text-xs font-semibold uppercase tracking-wide",
        "text-[color-mix(in_srgb,var(--cc-text)_78%,transparent)]",
      )
    : "text-left px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300"
  const tbodyClass = embedInDashboard ? "divide-y divide-[var(--border)] bg-[var(--card)]" : "bg-white dark:bg-slate-950 divide-y divide-slate-200 dark:divide-slate-800"
  const rowHover = embedInDashboard ? "hover:bg-[var(--cc-accent-soft)]/25 transition-colors" : "hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
  const rowStripe = embedInDashboard ? "bg-[color-mix(in_srgb,var(--muted)_22%,transparent)]" : "bg-slate-50/30 dark:bg-slate-900/30"
  const cellPrimary = embedInDashboard ? cn("text-xs sm:text-sm font-medium", PORTAL_TEXT) : "text-xs sm:text-sm text-slate-900 dark:text-slate-100"
  const cellSecondary = embedInDashboard
    ? "text-xs sm:text-sm text-[color-mix(in_srgb,var(--cc-text)_76%,transparent)]"
    : "text-xs sm:text-sm text-slate-600 dark:text-slate-400"
  const cellMuted = cellSecondary

  return (
    <div
      className={cn(
        "w-full min-w-0 max-w-full overflow-x-hidden",
        embedInDashboard && AM_PANEL_SECTION,
      )}
    >
      <div className={cn(AM_PANEL, "space-y-4 shrink-0")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className={cn("text-sm font-semibold", PORTAL_TEXT)}>
              {showFlaggedOnly ? `Flagged ${assessmentPluralLabel}` : `${assessmentLabel} Results`}
            </h2>
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
              {showFlaggedOnly ? "Review attempts needing attention" : "View and analyze performance"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              onClick={() => setGrantExtensionOpen(true)}
              variant="outline"
              size="sm"
              className={cn("h-9 gap-1.5", outlineBtn)}
            >
              <Clock className="h-4 w-4" />
              Grant Extension
            </Button>
            <Button onClick={fetchResults} variant="outline" size="sm" className={cn("h-9 gap-1.5", outlineBtn)}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              onClick={exportToCSV}
              size="sm"
              className={cn("h-9 gap-1.5", embedInDashboard && chrome ? chrome.solid : "bg-green-600 hover:bg-green-700")}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className={cn("border-t pt-4", embedInDashboard ? "border-[var(--border)]" : "border-slate-200/70 dark:border-white/[0.08]")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <div className="space-y-1.5 min-w-0">
              <Label className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>Session</Label>
              <Select value={selectedSession} onValueChange={setSelectedSession}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="All sessions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sessions</SelectItem>
                  {sessions.map((session) => (
                    <SelectItem key={session.id} value={session.id.toString()}>
                      {session.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 min-w-0">
              <Label className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>{assessmentLabel}</Label>
              <Select value={selectedAssessment} onValueChange={setSelectedAssessment}>
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder={`All ${assessmentPluralLabel.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {assessmentPluralLabel}</SelectItem>
                  {assessments.length === 0 && (
                    <SelectItem value="none" disabled>No {assessmentPluralLabel.toLowerCase()} found</SelectItem>
                  )}
                  {assessments.map((assessment) => {
                    const n = Number(assessment.total_attempts ?? 0)
                    const label = `${assessment.title} (${n} attempt${n !== 1 ? "s" : ""})`
                    return (
                      <SelectItem key={assessment.id} value={assessment.id.toString()}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 sm:justify-start lg:h-9 lg:py-0",
                embedInDashboard
                  ? "border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_35%,transparent)]"
                  : "border-slate-200/70 bg-slate-50/50 dark:border-white/[0.08] dark:bg-white/[0.02]",
              )}
            >
              <Label htmlFor="show-all-attempts" className={cn("text-xs font-medium cursor-pointer", PORTAL_TEXT)}>
                {assessmentType === "homework" ? "All attempts" : "Show all attempts"}
              </Label>
              <Switch
                id="show-all-attempts"
                checked={showAllAttempts}
                onCheckedChange={setShowAllAttempts}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Incomplete submissions - Submit on behalf */}
      {incompleteAttempts.length > 0 && (
        <Card className="min-w-0 max-w-full overflow-hidden border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Incomplete submissions ({incompleteAttempts.length})
            </h3>
            <p className="text-xs text-amber-800 dark:text-amber-300 mb-3">
              Students who worked but did not click Submit. Click &quot;Submit on behalf&quot; to finalize their attempt (answers preserved). Then manually grade each question in the results view.
            </p>
            <div className="flex flex-wrap gap-2">
              {incompleteAttempts.map((row: any) => (
                <IncompleteSubmitButton
                  key={row.attempt_id}
                  studentName={row.full_name}
                  studentId={row.student_id}
                  quizId={selectedAssessment}
                  answersCount={row.answers_with_content}
                  onSuccess={fetchResults}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Table - scrolls inside container, no page overflow */}
      <Card className={cn("min-w-0 max-w-full overflow-hidden mt-4", tableCard, embedInDashboard && "flex min-h-0 flex-1 flex-col")}>
        <CardContent className={cn("min-w-0 max-w-full p-0", embedInDashboard && "flex min-h-0 flex-1 flex-col")}>
          {results.length === 0 ? (
            <div className={cn("text-center py-16", embedInDashboard && AM_PANEL_FILL)}>
              <Users className={cn("h-12 w-12 mx-auto mb-4", embedInDashboard ? "text-[var(--cc-text-muted)] opacity-50" : "text-slate-300")} />
              <p className={cn("font-medium", embedInDashboard ? PORTAL_TEXT : "text-slate-600 dark:text-slate-400")}>No results found</p>
              <p className={cn("text-sm mt-1", embedInDashboard ? PORTAL_TEXT_MUTED : "text-slate-500 dark:text-slate-500")}>
                Try adjusting your filters
              </p>
            </div>
          ) : (
            <>
              <div className={cn("min-w-0 w-full max-w-full overflow-x-auto", embedInDashboard && AM_PANEL_SCROLL)}>
                <table className="w-full min-w-[760px] table-fixed">
                  <colgroup>
                    <col className="w-[26%]" />
                    <col className="w-[8%]" />
                    <col className="w-[8%]" />
                    <col className="w-[15%]" />
                    <col className="w-[9%]" />
                    <col className="w-[12%]" />
                    <col className="w-[10%]" />
                    <col className="w-[12%]" />
                  </colgroup>
                  <thead className={theadClass}>
                    <tr>
                      <th className={cn(thClass, "pr-2")}>
                        Student Name
                      </th>
                      <th className={thClass}>
                        ID
                      </th>
                      <th className={thClass}>
                        Section
                      </th>
                      <th className={thClass}>
                        {assessmentLabel}
                      </th>
                      <th className={thClass}>
                        Score
                      </th>
                      <th className={thClass}>
                        Grade
                      </th>
                      <th className={thClass}>
                        Completed
                      </th>
                      <th className={thClass}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className={tbodyClass}>
                    {paginatedResults.map((result, idx) => (
                      <tr 
                        key={result.attemptId} 
                        className={`${rowHover} ${
                          idx % 2 === 0 ? '' : rowStripe
                        }`}
                      >
                        <td className={cn("px-4 sm:px-6 py-3 sm:py-4 pr-2", cellPrimary)}>
                          <span className="block truncate font-semibold" title={result.studentName}>
                            {result.studentName}
                          </span>
                        </td>
                        <td className={cn("px-4 sm:px-6 py-3 sm:py-4 font-mono", cellMuted)}>
                          {result.studentNumber}
                        </td>
                        <td className="px-4 sm:px-6 py-3 sm:py-4">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs font-medium",
                              embedInDashboard
                                ? "border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_40%,transparent)] text-[color-mix(in_srgb,var(--cc-text)_88%,transparent)]"
                                : undefined,
                            )}
                          >
                            {result.section}
                          </Badge>
                        </td>
                        <td
                          className={cn(
                            "px-4 sm:px-6 py-3 sm:py-4 truncate",
                            embedInDashboard ? cellSecondary : cellPrimary,
                          )}
                          title={result.quizTitle || result.examTitle}
                        >
                          {result.quizTitle || result.examTitle}
                        </td>
                        <td className={cn("px-4 sm:px-6 py-3 sm:py-4 tabular-nums", cellPrimary)}>
                          <span>{result.score.toFixed(1)}</span>
                          <span className={cn("ml-1", cellSecondary)}>/ {result.totalPoints}</span>
                        </td>
                        <td className="px-4 sm:px-6 py-3 sm:py-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge className={cn(getGradeColor(result.percentage), "text-xs font-bold px-2.5 py-0.5 tabular-nums")}>
                              {result.percentage}%
                            </Badge>
                            <span
                              className={cn(
                                "inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md px-1.5 text-[11px] font-bold tabular-nums",
                                embedInDashboard ? getLetterGradeBadgeClass(result.percentage) : cn(getLetterGradeColor(result.percentage), "bg-muted/40"),
                              )}
                            >
                              {getLetterGrade(result.percentage)}
                            </span>
                            {result.isFlagged && (
                              <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500 shrink-0" />
                            )}
                          </div>
                        </td>
                        <td className={cn("px-4 sm:px-6 py-3 sm:py-4", cellMuted)}>
                          {result.completedAt ? dbTimeToCDT(result.completedAt).split(',')[0] : "In Progress"}
                        </td>
                        <td className="px-4 sm:px-6 py-3 sm:py-4">
                          <Button
                            size="sm"
                            variant="link"
                            onClick={() => router.push(instructorResultDetailPath(result.attemptId, embedInDashboard))}
                            className={cn(
                              "p-0 h-auto font-normal text-xs sm:text-sm whitespace-nowrap",
                              embedInDashboard ? "text-[var(--cc-accent)] hover:opacity-80" : "text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300",
                            )}
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t", embedInDashboard ? "border-[var(--border)] bg-[var(--card)]" : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950")}>
                <p className={cn("text-xs", embedInDashboard ? PORTAL_TEXT_MUTED : "text-slate-500 dark:text-slate-400")}>
                  {startIndex + 1}–{Math.min(endIndex, results.length)} of {results.length}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNumber;
                    if (totalPages <= 5) {
                      pageNumber = i + 1;
                    } else if (currentPage <= 3) {
                      pageNumber = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNumber = totalPages - 4 + i;
                    } else {
                      pageNumber = currentPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNumber}
                        variant={currentPage === pageNumber ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNumber)}
                        className={cn(
                          "h-8 w-8 p-0",
                          currentPage === pageNumber
                            ? embedInDashboard && chrome
                              ? chrome.solid
                              : "bg-blue-600 text-white hover:bg-blue-700"
                            : outlineBtn,
                        )}
                      >
                        {pageNumber}
                      </Button>
                    );
                  })}
                  
                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <>
                      <span className="text-slate-400">...</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        className="h-8 w-8 p-0"
                      >
                        {totalPages}
                      </Button>
                    </>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  
                  <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(Number(v))}>
                    <SelectTrigger className="h-8 w-[70px] sm:w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 / page</SelectItem>
                      <SelectItem value="10">10 / page</SelectItem>
                      <SelectItem value="20">20 / page</SelectItem>
                      <SelectItem value="50">50 / page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <GrantExtensionModal
        open={grantExtensionOpen}
        onClose={() => setGrantExtensionOpen(false)}
        onSuccess={fetchResults}
        preselectedQuizId={selectedAssessment !== "all" ? parseInt(selectedAssessment, 10) : null}
        preselectedSessionId={selectedSession !== "all" ? selectedSession : null}
        assessments={assessments}
        sessions={sessions}
      />

    </div>
  )
}

