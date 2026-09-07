"use client"

import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react"
import dynamic from "next/dynamic"
import { createPortal } from "react-dom"
import { useRouter, usePathname } from "next/navigation"
import {
  isInstructorResultDetailPath,
  instructorResultDetailPath,
  instructorResultsListPath,
} from "@/lib/instructor-results-navigation"
import { InstructorStudentAttemptPicker } from "@/components/instructor/InstructorStudentAttemptPicker"
import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { FeedbackTextRenderer, QuestionTextRenderer } from "@/components/question-text-renderer"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import {
  RefreshCw,
  Trophy,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TriangleAlert,
  List,
  Printer,
  ArrowLeft,
  Eye,
  Lock,
  Check,
  Sparkles,
  Loader2,
  X,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Play,
  Mail,
  FileSearch,
  Info,
  Clock,
  RotateCcw,
  Target,
  TrendingUp,
  ShieldCheck,
} from "lucide-react"
import { motion } from "framer-motion"
import { buildResultsPdfFilename } from "@/lib/results-pdf-filename"
import { MultiPartResultsDisplay } from "@/components/multi-part-results-display"
import { QuestionMediaDisplay } from "@/components/question-media-display"
import { hasActiveQuestionMedia, resolveQuestionMedia } from "@/lib/question-media"
import { getDualCodeComparison, resolveCodeDisplayWithTypingReplay } from "@/lib/code-typing-consistency"
import { toast } from "@/lib/app-toast"
import confetti from "canvas-confetti"
// Custom modal - no Dialog import needed
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatToCDT } from "@/lib/timezone"
import {
  getBackPathForAssessmentV2,
  DASHBOARD_V2_BASE,
} from "@/lib/student-dashboard-paths"
import { logEvent, logError } from "@/lib/observability"
import { groupQuestionsBySections, getSectionForQuestionIndex, assessmentUsesSectionWeightedGrade, parseAssessmentSectionConfig } from "@/lib/assessment-sections"
import { capQuestionPoints, computeSectionWeightedScore } from "@/lib/section-weighted-attempt-score"
import { RetakeUpgradeModal } from "@/components/retake-upgrade-modal"
import { RetakeForfeitAlert } from "@/components/retake-forfeit-alert"
import { CodeReplayViewer } from "@/components/code-replay-viewer"
import { getDocumentAtTime, type TypingReplay } from "@/lib/typing-replay"
import { isCodeAnswerCorrupt } from "@/lib/code-answer-validation"
import { hasCodeDataButZeroPoints, hasStudentAnswerContent } from "@/lib/student-answer-presence"
import { canVerifyLocally } from "@/lib/local-answer-verification"
import { isPendingManualReview } from "@/lib/question-pending-review"
import { InstructorScoreOverrideButton } from "@/components/instructor-score-override-dialog"
import { AttemptScoreHistoryPanel } from "@/components/attempt-score-history-panel"
import {
  isMidSemesterOverrideType,
  normalizeAssessmentKindForOverride,
  usesWeightedPercentageDisplay,
} from "@/lib/instructor-score-override"
import { runStudentBulkReevaluateBatch } from "@/lib/instructor-bulk-reevaluate-client"
import {
  StudentIntegrityBehaviorRecord,
  hasIntegritySignals,
} from "@/components/student-integrity-behavior-record"
import { cn } from "@/lib/utils"
import { studentResultsPdfGateSatisfied } from "@/lib/student-results-pdf-gate"
import { getCanonicalAiFeedbackPercent } from "@/lib/ai-points-consistency"
import { flattenStoredAiFeedback } from "@/lib/flatten-stored-ai-feedback"
import { MultiPartInstructorGradePanel } from "@/components/multi-part-instructor-grade-panel"
import { CircuitSubmissionInstructorGradePanel } from "@/components/circuit-submission-instructor-grade-panel"
import { CircuitSubmissionResultsDisplay } from "@/components/circuit-submission-results-display"
import { CircuitWorkspaceExportAttemptButton } from "@/components/circuit-workspace-export-actions"
import { CircuitProvisionalStudentNotice } from "@/components/circuit-provisional-student-notice"
import { isMultiPartUploadPendingReview } from "@/lib/multi-part-pnd"
import { isCircuitSubmissionPendingReview, isCircuitSubmissionProvisional, resolveCircuitSubmissionProvisionalScore } from "@/lib/circuit-submission"
import { ClassroomProvisionalScoreBadge } from "@/components/classroom-provisional-score-badge"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { getFacultyResultsDetailTheme, type FacultyResultsDetailTheme } from "@/lib/results/faculty-results-detail-ui"
import {
  RESULTS_ACCENT_ATTEMPT_SELECTED,
  RESULTS_ACCENT_CTA,
  RESULTS_ACCENT_PTS_BADGE,
  RESULTS_ACCENT_PTS_ICON,
  RESULTS_ACCENT_PTS_SUB,
  RESULTS_ACCENT_PTS_TEXT,
  RESULTS_ACCENT_QUESTION_HIGHLIGHT,
  RESULTS_ACCENT_SECTION_HEADER,
  RESULTS_ACCENT_SECTION_HEADER_ACTIVE,
  RESULTS_ACCENT_SECTION_META,
  RESULTS_ACCENT_SECTION_TEXT,
  RESULTS_ACCENT_SOFT_PILL,
  RESULTS_ACCENT_TITLE,
  RESULTS_ACTION_BTN,
  RESULTS_JEANS_CARD_STATIC,
  RESULTS_JEANS_HOVER_WASH,
  RESULTS_SECTION_INTERACTIVE,
  resultsDarkElevatedStyle,
  resultsKpiAccent,
  resultsPanelClass,
  resultsSectionTone,
} from "@/lib/results/student-results-interactive-ui"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { chromeSwatchFromTokens } from "@/lib/appearance/module-chrome"
import {
  materialSurfaceClass,
  useMaterialRipple,
} from "@/components/ui/material-interactive-surface"

const FacultySubmitAnswerOnBehalfPanel = dynamic(
  () =>
    import("@/components/faculty-submit-answer-on-behalf-panel").then((m) => ({
      default: m.FacultySubmitAnswerOnBehalfPanel,
    })),
  { ssr: false, loading: () => null },
)

/** AI % shown in UI — matches points_earned / max when feedback has scoreBreakdown.finalScore */
function canonicalAiPercentForUi(feedback: any): number | undefined {
  const c = getCanonicalAiFeedbackPercent(feedback)
  if (c != null) return c
  if (feedback && typeof feedback === "object" && feedback.score != null && Number.isFinite(Number(feedback.score))) {
    return Number(feedback.score)
  }
  return undefined
}

function formatCanonicalAiPercent(p: number): string {
  return `${Number.isInteger(p) ? p : Math.round(p * 10) / 10}%`
}

/** True if any code question has real student data but 0 points (evaluation may have failed) */
function anyQuestionHasDataButZeroPoints(questions: any[]): boolean {
  return (questions || []).some((q: any) => hasCodeDataButZeroPoints(q))
}

/** Aligns with server "failed" mode in re-evaluate-attempt: zero/failed AI/stuck, skipping empty answers */
function countFailedModeQuestions(questions: any[]): number {
  return (questions || []).filter((q: any) => {
    const pts = Number(q.points_earned)
    const hasZeroScore = isNaN(pts) || pts === 0
    const hasFailedAI =
      q.ai_feedback &&
      ((typeof q.ai_feedback === "string" && q.ai_feedback.includes("failed")) ||
        (typeof q.ai_feedback === "object" &&
          (q.ai_feedback.errorType ||
            q.ai_feedback.score === 0 ||
            (!q.ai_feedback.aiGraded && q.requires_review))))
    const isStuck =
      q.ai_feedback &&
      ((typeof q.ai_feedback === "string" && q.ai_feedback.includes("Processing")) ||
        (typeof q.ai_feedback === "object" &&
          (q.ai_feedback.status === "Processing..." || q.ai_feedback.statusMessage === "Processing...")))
    if (hasZeroScore && !hasStudentAnswerContent(q) && !hasFailedAI && !isStuck) return false
    return hasZeroScore || hasFailedAI || isStuck
  }).length
}

function computeHasAnyFlagOrError(results: any): boolean {
  if (!results) return false
  const questions = results.questions || []
  const pendingCount = questions.filter((q: any) => isPendingManualReview(q)).length
  const multiPartUploadPending = questions.some((q: any) => isMultiPartUploadPendingReview(q))
  // Provisional circuit previews are not headline PND — only unresolved instructor_review counts.
  const circuitSubmissionPending = questions.some((q: any) => isCircuitSubmissionPendingReview(q))
  const allPendingManualReview = pendingCount > 0 && pendingCount === questions.length
  const hasDataButZeroPts = anyQuestionHasDataButZeroPoints(questions)
  const apiPnd = (results as any)?.should_show_pnd as boolean | undefined
  const hasViolationPending =
    results.violation_log &&
    Array.isArray(results.violation_log) &&
    results.violation_log.some(
      (e: any) => e?.type === "score_pending" || e?.type === "evaluation_failed",
    )
  if (typeof apiPnd === "boolean") {
    if (!apiPnd) return !!(results.auto_submitted || results.violation_reason)
    return true
  }
  return (
    apiPnd === true ||
    allPendingManualReview ||
    multiPartUploadPending ||
    circuitSubmissionPending ||
    hasDataButZeroPts ||
    (apiPnd !== false && hasViolationPending) ||
    !!results.auto_submitted ||
    !!results.violation_reason
  )
}

function formatQuestionTypeLabel(raw: string | undefined): string {
  if (!raw || raw === "other") return "Other"
  const cleaned = raw.replace(/_/g, " ").trim()
  if (!cleaned) return "Other"
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

function parseIsoToMs(value: string | null | undefined): number | null {
  if (value == null || value === "") return null
  const ms = Date.parse(String(value))
  return Number.isNaN(ms) ? null : ms
}

/** Coerce API / JSON values to a finite number (handles string numerics). */
function toFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v) && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v)
    if (!Number.isNaN(n) && Number.isFinite(n)) return n
  }
  return null
}

/** Full credit on a question (binary correct or all points earned). */
function isQuestionFullyCorrect(q: any): boolean {
  if (q?.is_correct === true) return true
  const max = Number(q?.max_points ?? q?.points ?? 1)
  const pe = Number(q?.points_earned ?? 0)
  if (!(max > 0) || Number.isNaN(max)) return pe > 0
  return pe >= max - 1e-4
}

/** Aggregates API + per-question rows for student KPIs (same data as the rest of the report). */
function buildStudentReportInsights(results: any): {
  questionCount: number
  correctCount: number
  accuracyPct: number
  pointsEarned: number
  pointsPossible: number
  timeMinutes: number | null
  timeDetail: string
  strongest: Array<{ label: string; pct: number; n: number }>
  growth: Array<{ label: string; pct: number; n: number }>
  sectionRows: Array<{ title: string; pct: number; earned: number; max: number }>
} | null {
  const qs = results?.questions
  if (!Array.isArray(qs) || qs.length === 0) return null

  let timeSeconds = 0
  const byType = new Map<string, { n: number; earned: number; max: number; correct: number }>()

  let sumEarnedFromQs = 0
  let sumMaxFromQs = 0
  let fullyCorrectCount = 0

  for (const q of qs) {
    const max = Number((q as any).max_points ?? (q as any).points ?? 1)
    const pe = Number((q as any).points_earned ?? 0)
    sumEarnedFromQs += pe
    sumMaxFromQs += max
    if (isQuestionFullyCorrect(q)) fullyCorrectCount += 1

    const t = String((q as any).question_type || "other").toLowerCase()
    const cur = byType.get(t) || { n: 0, earned: 0, max: 0, correct: 0 }
    cur.n += 1
    cur.earned += pe
    cur.max += max
    if (isQuestionFullyCorrect(q)) cur.correct += 1
    byType.set(t, cur)

    const ts = (q as any).time_spent_seconds
    if (typeof ts === "number" && ts > 0) {
      timeSeconds += ts
    }
  }

  const serverCorrectRaw = toFiniteNumber(results.correct_answers)
  const correctCount =
    serverCorrectRaw != null
      ? Math.min(qs.length, Math.max(0, Math.round(serverCorrectRaw)))
      : fullyCorrectCount

  const pointsEarned =
    typeof results.score === "number" && !Number.isNaN(results.score) ? results.score : sumEarnedFromQs
  const pointsPossible =
    typeof results.total_points === "number" && results.total_points > 0
      ? results.total_points
      : typeof results.total_questions === "number" && results.total_questions > 0
        ? results.total_questions
        : sumMaxFromQs

  // Accuracy % must match the report headline: points-based (API percentage), not binary Q/N.
  const apiPct = toFiniteNumber(results.percentage)
  const pointsRatioPct =
    pointsPossible > 0 && Number.isFinite(pointsEarned)
      ? Math.min(100, Math.max(0, (pointsEarned / pointsPossible) * 100))
      : null
  const accuracyPct =
    apiPct != null
      ? Math.min(100, Math.max(0, apiPct))
      : pointsRatioPct != null
        ? pointsRatioPct
        : qs.length > 0
          ? (correctCount / qs.length) * 100
          : 0

  let timeMinutes: number | null = null
  let timeDetail = "Add-on timers weren’t recorded for this attempt."
  if (timeSeconds >= 60) {
    timeMinutes = Math.max(1, Math.round(timeSeconds / 60))
    timeDetail = "Sum of per-question timers (where recorded)."
  } else if (timeSeconds > 0) {
    timeMinutes = 1
    timeDetail = "Under a minute total on timed items (per-question timers)."
  } else {
    const startMs = parseIsoToMs(results.started_at)
    const endMs = parseIsoToMs(results.completed_at)
    if (startMs != null && endMs != null && endMs > startMs) {
      const sessionMin = Math.max(1, Math.round((endMs - startMs) / 60000))
      timeMinutes = sessionMin
      timeDetail = "Session length (start → submit)."
    }
  }

  const typeRows = [...byType.entries()].map(([type, v]) => ({
    label: formatQuestionTypeLabel(type),
    pct: v.max > 0 ? (v.earned / v.max) * 100 : 0,
    n: v.n,
  }))
  typeRows.sort((a, b) => b.pct - a.pct)
  const strongest = typeRows.slice(0, 2).filter((r) => r.pct > 0)
  const strongestLabels = new Set(strongest.map((s) => s.label))
  const growth = [...typeRows]
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 2)
    .filter((r) => r.pct < 99.5 && r.n > 0)
    .filter((r) => !strongestLabels.has(r.label))

  const sectionRows: Array<{ title: string; pct: number; earned: number; max: number }> = []
  const sb = results.section_breakdown
  if (Array.isArray(sb) && sb.length > 0) {
    for (const s of sb) {
      const earned = Number(s.earned ?? 0)
      const max = Number(s.max ?? 0)
      const pct =
        typeof s.sectionPercentage === "number"
          ? s.sectionPercentage
          : max > 0
            ? (earned / max) * 100
            : 0
      sectionRows.push({
        title: String(s.title || "Section"),
        pct: Math.min(100, Math.max(0, pct)),
        earned,
        max,
      })
    }
  }

  return {
    questionCount: qs.length,
    correctCount,
    accuracyPct,
    pointsEarned,
    pointsPossible,
    timeMinutes,
    timeDetail,
    strongest,
    growth,
    sectionRows,
  }
}

// Bulk Re-evaluation Panel Component for Instructors
const BulkReEvaluatePanel = ({
  attemptId,
  questions,
  onReEvaluated,
  onQuestionEvaluated,
  portalTheme = null,
}: {
  attemptId: string
  questions: any[]
  onReEvaluated: () => void
  onQuestionEvaluated?: (detail: { answerId: number; questionId: number; newPoints: number; score: number; isCorrect?: boolean; aiFeedback?: any }, questionIndex: number) => void
  portalTheme?: FacultyResultsDetailTheme | null
}) => {
  const [isReEvaluating, setIsReEvaluating] = useState(false)
  const [evaluationMode, setEvaluationMode] = useState<"failed" | "stuck" | "all">("failed")
  const [result, setResult] = useState<any>(null)

  // Count questions that need re-evaluation
  const failedCount = questions.filter(q => {
    const hasZeroScore = (q.points_earned || 0) === 0
    const hasFailedAI = q.ai_feedback && (
      (typeof q.ai_feedback === 'string' && q.ai_feedback.includes('failed')) ||
      (typeof q.ai_feedback === 'object' && (
        q.ai_feedback.errorType ||
        q.ai_feedback.score === 0 ||
        (!q.ai_feedback.aiGraded && q.requires_review)
      ))
    )
    return hasZeroScore || hasFailedAI
  }).length

  const stuckCount = questions.filter(q => {
    if (!q.ai_feedback) return false
    try {
      const feedback = typeof q.ai_feedback === 'string' ? JSON.parse(q.ai_feedback || '{}') : q.ai_feedback
      return (
        (typeof q.ai_feedback === 'string' && q.ai_feedback.includes('Processing')) ||
        (feedback.status === "Processing..." ||
        feedback.statusMessage === "Processing..." ||
        (feedback.feedback && typeof feedback.feedback === 'string' && feedback.feedback.includes('Processing')))
      )
    } catch {
      return typeof q.ai_feedback === 'string' && q.ai_feedback.includes('Processing')
    }
  }).length

  const codeQuestionsCount = questions.filter(q => 
    q.question_type?.toLowerCase().includes('code') || 
    q.question_type === 'code_write_plot'
  ).length

  const circuitSubmissionCount = questions.filter(q =>
    (q.question_type || "").toLowerCase() === "circuit_submission"
  ).length

  const locallyVerifiableCount = questions.filter(q => 
    canVerifyLocally(q.question_type || "")
  ).length

  const reEvaluableCount = codeQuestionsCount + locallyVerifiableCount + circuitSubmissionCount

  const handleBulkReEvaluate = async (mode: "failed" | "stuck" | "all") => {
    setIsReEvaluating(true)
    setEvaluationMode(mode)
    setResult(null)

    try {
      const instructorSession = localStorage.getItem("instructorSession")
      const instructorId = localStorage.getItem("instructorId")
      const adminId = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("adminId") : null

      if (!instructorSession && !instructorId && !adminId) {
        throw new Error("Instructor or admin authentication required")
      }

      const headers: Record<string, string> = adminId
        ? {
            ...buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" }),
            "x-admin-id": adminId,
          }
        : buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" })

      let answerIds: number[] | undefined
      let index = 0
      let lastResult: any = null
      const accumulated = { evaluated: 0, updated: 0, failed: 0, skipped: 0 }

      do {
        const body: Record<string, unknown> = { attemptId, mode }
        if (answerIds != null && answerIds.length > 0) {
          body.answerIds = answerIds
          body.index = index
        }

        const response = await instructorApiFetch("/api/instructor/re-evaluate-attempt", {
          method: "POST",
          headers,
          body: JSON.stringify(body)
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to bulk re-evaluate")
        }

        const result = await response.json()
        lastResult = result
        answerIds = result.answerIds
        index = result.nextIndex ?? 0
        accumulated.evaluated += result.evaluated ?? 0
        accumulated.updated += result.updated ?? 0
        accumulated.failed += result.failed ?? 0
        accumulated.skipped += result.skipped ?? 0
        setResult({ ...result, evaluated: accumulated.evaluated, updated: accumulated.updated, failed: accumulated.failed, skipped: accumulated.skipped })

        const detail = result.details?.[0]
        if (detail?.status === "success" && onQuestionEvaluated) {
          const questionIndex = questions.findIndex((q: any) => (q.answer_id ?? q.id) === detail.answerId)
          const qIdx = questionIndex >= 0 ? questionIndex + 1 : index + 1
          onQuestionEvaluated(
            {
              answerId: detail.answerId,
              questionId: detail.questionId,
              newPoints: detail.newPoints,
              score: detail.score ?? 0,
              isCorrect: detail.isCorrect,
              aiFeedback: detail.aiFeedback
            },
            qIdx
          )
          toast.success(`Question ${qIdx} evaluated and grade updated`, {
            description: `Score: ${detail.score ?? 0}% • ${detail.newPoints ?? 0} pts`
          })
        }
      } while (answerIds && answerIds.length > 0 && index < answerIds.length && !lastResult?.done)

      toast.success("Bulk re-evaluation completed", {
        description: lastResult?.message || `Re-evaluated ${accumulated.evaluated} question(s), ${accumulated.updated} updated`
      })
      onReEvaluated()

    } catch (err: any) {
      toast.error("Bulk re-evaluation failed", {
        description: err.message || "Please try again"
      })
    } finally {
      setIsReEvaluating(false)
    }
  }

  // Show panel if there are re-evaluable questions (code OR MCQ, true/false, select all, etc.)
  if (reEvaluableCount === 0) {
    return null
  }

  return (
    <Card className={portalTheme?.mainCard ?? "border border-blue-200/60 dark:border-blue-700/60 bg-blue-50/80 dark:bg-blue-900/30 rounded-2xl shadow-lg"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Sparkles className={cn("h-5 w-5", portalTheme?.fp.iconText ?? "text-blue-600 dark:text-blue-400")} />
          <span>Bulk Re-evaluate</span>
        </CardTitle>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Re-evaluate questions: code and circuit uploads use AI; MCQ, true/false, select all use automatic grading. Updates grades in place—student answers and attempt are preserved.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className={portalTheme?.insetPanel ?? "p-3 rounded-lg bg-white/50 dark:bg-slate-800"}>
            <div className="text-xs text-slate-700 dark:text-slate-200 mb-1">Re-evaluable</div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{reEvaluableCount}</div>
            <div className="text-xs text-slate-500 mt-0.5">{codeQuestionsCount} code, {circuitSubmissionCount} circuit, {locallyVerifiableCount} auto</div>
          </div>
          <div className="p-3 rounded-lg bg-red-50/50 dark:bg-red-900/20">
            <div className="text-xs text-red-600 dark:text-red-400 mb-1">Failed/Zero Score</div>
            <div className="text-lg font-bold text-red-700 dark:text-red-300">{failedCount}</div>
          </div>
          <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-900/20">
            <div className="text-xs text-amber-600 dark:text-amber-400 mb-1">Stuck Processing</div>
            <div className="text-lg font-bold text-amber-700 dark:text-amber-300">{stuckCount}</div>
          </div>
        </div>
        
        {reEvaluableCount > 0 && failedCount === 0 && stuckCount === 0 && (
          <div className={portalTheme?.referencePanel ?? "p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-700/50"}>
            <p className={cn("text-xs", portalTheme?.fp.iconText ?? "text-blue-700 dark:text-blue-300")}>
              ℹ️ All re-evaluable questions have been evaluated. You can still re-evaluate them if needed.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Re-evaluation Mode</label>
          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={() => handleBulkReEvaluate("failed")}
              disabled={isReEvaluating || failedCount === 0}
              variant={evaluationMode === "failed" ? "default" : "outline"}
              size="sm"
              className="w-full"
            >
              {isReEvaluating && evaluationMode === "failed" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Evaluating...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Failed Only ({failedCount})
                </>
              )}
            </Button>
            <Button
              onClick={() => handleBulkReEvaluate("stuck")}
              disabled={isReEvaluating || stuckCount === 0}
              variant={evaluationMode === "stuck" ? "default" : "outline"}
              size="sm"
              className="w-full"
            >
              {isReEvaluating && evaluationMode === "stuck" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Evaluating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Stuck Only ({stuckCount})
                </>
              )}
            </Button>
            <Button
              onClick={() => handleBulkReEvaluate("all")}
              disabled={isReEvaluating || reEvaluableCount === 0}
              variant={evaluationMode === "all" ? "default" : "outline"}
              size="sm"
              className="w-full"
            >
              {isReEvaluating && evaluationMode === "all" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Evaluating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  All Questions ({reEvaluableCount})
                </>
              )}
            </Button>
          </div>
        </div>

        {result && (
          <div className="p-4 rounded-lg bg-green-50/50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
            <div className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2">
              Re-evaluation Results
            </div>
            {result.aiEvaluationMode && (
              <div className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                AI mode used: <span className="font-medium">{result.aiEvaluationMode}</span> (same as EditQuizForm)
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Evaluated: <span className="font-bold">{result.evaluated}</span></div>
              <div>Updated: <span className="font-bold text-green-600">{result.updated}</span></div>
              <div>Failed: <span className="font-bold text-red-600">{result.failed}</span></div>
              <div>Skipped: <span className="font-bold">{result.skipped}</span></div>
            </div>
            {result.newAttemptScore !== undefined && (
              <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-700">
                <div className="text-xs">
                  New Attempt Score: <span className="font-bold">{result.newAttemptScore.toFixed(2)}</span> / {result.totalPossible}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Student Re-evaluate Button - for questions that failed evaluation (e.g. connection timeout)
// Label: "Re-evaluate" (no AI wording - students shouldn't feel AI is grading them)
const StudentReEvaluateButton = ({
  answerId,
  attemptId,
  questionId,
  questionType,
  aiFeedback,
  requiresReview,
  studentReEvaluateUsedAt,
  instructorAdjustedPoints,
  onReEvaluated,
}: {
  answerId?: number
  attemptId: string
  questionId: number
  questionType?: string
  aiFeedback?: any
  requiresReview?: boolean
  /** When set, student already used their one Re-evaluate - show "Waiting for manual review" */
  studentReEvaluateUsedAt?: string | null
  /** When instructor set override_points, student re-eval must not overwrite it */
  instructorAdjustedPoints?: number | null
  onReEvaluated: () => void
}) => {
  const [isReEvaluating, setIsReEvaluating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (instructorAdjustedPoints != null) {
    return (
      <div className="mt-4 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/20">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          <Pencil className="h-3 w-3 inline mr-1" />
          Your instructor set the score for this question. Re-evaluate is not available so that grade stays final.
        </p>
      </div>
    )
  }

  // Student gets 1 Re-evaluate per question - after use, show waiting message
  if (studentReEvaluateUsedAt) {
    return (
      <div className="mt-4 p-3 rounded-xl border border-amber-200/60 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-900/20">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          <AlertCircle className="h-3 w-3 inline mr-1" />
          Waiting for manual review. Your instructor will grade this question.
        </p>
      </div>
    )
  }

  const qType = (questionType || "").toLowerCase()
  const isCodeQuestion = qType.includes("code") || qType === "code_write_plot"
  const isMultiPart = qType === "multi_part"
  const isStuck = aiFeedback && (
    (typeof aiFeedback === "string" && aiFeedback.includes("Processing")) ||
    (typeof aiFeedback === "object" && (
      aiFeedback.status === "Processing..." ||
      aiFeedback.statusMessage === "Processing..." ||
      (typeof aiFeedback.feedback === "string" && aiFeedback.feedback.includes("Processing"))
    ))
  )
  const hasEvalError = aiFeedback && typeof aiFeedback === "object" && aiFeedback.errorType
  const multiPartUploadNeedsReview =
    isMultiPart &&
    requiresReview === true &&
    aiFeedback?.multiPartAiGraded !== true
  const needsReEvaluation =
    (isCodeQuestion &&
      (!aiFeedback ||
        requiresReview ||
        isStuck ||
        hasEvalError ||
        (aiFeedback?.score === 0 && requiresReview))) ||
    multiPartUploadNeedsReview

  if (!needsReEvaluation || (!answerId && !attemptId)) return null

  const handleReEvaluate = async () => {
    setIsReEvaluating(true)
    setError(null)
    try {
      const studentDatabaseId = typeof window !== "undefined" ? sessionStorage.getItem("studentDatabaseId") : null
      if (!studentDatabaseId) {
        throw new Error("Please log in again to re-evaluate")
      }
      const response = await studentApiFetch("/api/student/re-evaluate-answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-student-id": studentDatabaseId,
        },
        body: JSON.stringify({
          answerId: answerId ?? undefined,
          attemptId: answerId ? undefined : attemptId,
          questionId: answerId ? undefined : questionId,
          studentId: studentDatabaseId,
        }),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || errData.details || `Request failed`)
      }
      toast.success("Re-evaluated successfully")
      onReEvaluated()
    } catch (err: any) {
      setError(err.message || "Failed to re-evaluate")
      toast.error("Re-evaluate failed", { description: err.message })
    } finally {
      setIsReEvaluating(false)
    }
  }

  return (
    <div className="mt-4 p-3 rounded-xl border border-amber-200/60 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-900/20">
      <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
        {isMultiPart
          ? "Your upload could not be graded automatically. Re-evaluate to try again, or wait for your instructor to review."
          : "Your answer was saved but evaluation may not have completed. Try again to get your score."}
      </p>
      <Button
        onClick={handleReEvaluate}
        disabled={isReEvaluating}
        size="sm"
        variant="outline"
        className="shrink-0"
      >
        {isReEvaluating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Re-evaluating...
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4 mr-2" />
            Re-evaluate
          </>
        )}
      </Button>
      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>}
    </div>
  )
}

// Re-evaluate Button Component for Instructors ONLY
// Shows for BOTH code questions (AI re-eval) and auto-checked questions (compare answer to correct, update score)
// Does NOT delete any data - only updates is_correct and points_earned based on comparison
const ReEvaluateButton = ({
  answerId,
  attemptId,
  questionId,
  questionType,
  aiFeedback,
  onReEvaluated,
  userType,
  portalTheme = null,
}: {
  answerId?: number
  attemptId?: string
  questionId?: number
  questionType?: string
  aiFeedback?: any
  onReEvaluated: () => void
  userType?: "student" | "admin" | "instructor"
  portalTheme?: FacultyResultsDetailTheme | null
}) => {
  const [isReEvaluating, setIsReEvaluating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // CRITICAL SECURITY: Only show re-evaluate button to instructors and admins (never students)
  if (userType !== "instructor" && userType !== "admin") {
    return null
  }

  const qType = (questionType || "").toLowerCase()
  const isCodeQuestion = qType.includes("code") || qType === "code_write_plot"
  const isMultiPart = qType === "multi_part"
  const isCircuitSubmission = qType === "circuit_submission"
  const isAutoChecked = !isCodeQuestion && !isMultiPart && !isCircuitSubmission

  const canTarget =
    answerId != null || (attemptId != null && attemptId !== "" && questionId != null)
  const multiPartUploadPending =
    isMultiPart &&
    aiFeedback?.multiPartAiGraded !== true &&
    (aiFeedback?.uploadPending === true ||
      aiFeedback?.requiresManualReview === true ||
      Boolean(aiFeedback?.errorType))

  if (!canTarget || (!isCodeQuestion && !isAutoChecked && !multiPartUploadPending && !isCircuitSubmission)) {
    return null
  }

  // Code / multi-part upload / circuit submission: needs re-evaluation if stuck, failed, or manual review
  const needsReEvaluation =
    multiPartUploadPending ||
    (isCircuitSubmission &&
      (!aiFeedback ||
        aiFeedback.circuitSubmissionAiGraded !== true ||
        aiFeedback.requiresManualReview === true ||
        Boolean(aiFeedback?.errorType) ||
        aiFeedback.score === 0 ||
        aiFeedback.score === undefined)) ||
    (isCodeQuestion &&
      (!aiFeedback ||
        aiFeedback.score === 0 ||
        aiFeedback.score === undefined ||
        aiFeedback.status === "Processing..." ||
        aiFeedback.statusMessage === "Processing..." ||
        (typeof aiFeedback.feedback === "string" && aiFeedback.feedback.includes("Processing")) ||
        (aiFeedback.requiresManualReview && !aiFeedback.aiGraded) ||
        (aiFeedback.errorType && aiFeedback.errorType !== undefined) ||
        (aiFeedback.statusMessage && aiFeedback.statusMessage.includes("Processing"))))

  const handleReEvaluate = async () => {
    if (!canTarget) return
    setIsReEvaluating(true)
    setError(null)
    try {
      const instructorSession = localStorage.getItem("instructorSession")
      const instructorId = localStorage.getItem("instructorId")
      const adminId = sessionStorage.getItem("adminId")
      const hasInstructorAuth = instructorSession || instructorId
      const hasAdminAuth = adminId
      if (!hasInstructorAuth && !hasAdminAuth) {
        throw new Error("Instructor or admin authentication required")
      }
      const body =
        answerId != null
          ? { answerId, forceAI: isCodeQuestion }
          : { attemptId: Number(attemptId), questionId, forceAI: isCodeQuestion }
      const response = await instructorApiFetch("/api/instructor/re-evaluate-answer", {
        method: "POST",
        headers: adminId
          ? {
              ...buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" }),
              "x-admin-id": adminId,
            }
          : buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body)
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.details || `HTTP ${response.status}`)
      }
      const result = await response.json()
      toast.success("Answer re-evaluated successfully", {
        description: isCodeQuestion
          ? `Score: ${result.pointsEarned}/${result.maxPoints}`
          : `Updated: ${result.isCorrect ? "Correct" : "Incorrect"} (${result.pointsEarned} pts)`
      })
      setTimeout(() => onReEvaluated(), 1000)
    } catch (err: any) {
      setError(err.message || "Failed to re-evaluate")
      toast.error("Re-evaluation failed", { description: err.message })
    } finally {
      setIsReEvaluating(false)
    }
  }

  if (isAutoChecked) {
    return (
      <div className={portalTheme?.insetPanel ?? "mt-4 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/30"}>
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Compare saved answer to correct answer and update score. No data is deleted.
          </p>
          <Button
            onClick={handleReEvaluate}
            disabled={isReEvaluating}
            size="sm"
            variant="outline"
            className="shrink-0"
          >
            {isReEvaluating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Re-evaluating...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Re-evaluate
              </>
            )}
          </Button>
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>}
      </div>
    )
  }

  return (
    <div className={cn(
      portalTheme?.insetPanel ?? "mt-4 p-4 rounded-xl border",
      !portalTheme && (needsReEvaluation
        ? "border-amber-200/60 dark:border-amber-700/60 bg-amber-50/80 dark:bg-amber-900/30"
        : "border-blue-200/60 dark:border-blue-700/60 bg-blue-50/80 dark:bg-blue-900/30"),
    )}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {needsReEvaluation ? (
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            ) : (
              <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            )}
            <span className={`text-sm font-semibold ${
              needsReEvaluation ? "text-amber-900 dark:text-amber-200" : "text-blue-900 dark:text-blue-200"
            }`}>
              {aiFeedback?.status === "Processing..." || aiFeedback?.statusMessage === "Processing..."
                ? "Evaluation Stuck in Processing"
                : aiFeedback?.errorType
                ? "AI Evaluation Failed"
              : needsReEvaluation
              ? "Manual Review Required"
              : isMultiPart
              ? "Re-evaluate Upload"
              : isCircuitSubmission
              ? "Re-evaluate Solution"
              : "Re-evaluate Code"}
            </span>
          </div>
          <p className={`text-xs ${
            needsReEvaluation ? "text-amber-800 dark:text-amber-300" : "text-blue-800 dark:text-blue-300"
          }`}>
            {aiFeedback?.status === "Processing..." || aiFeedback?.statusMessage === "Processing..."
              ? "This answer appears to be stuck in processing. Click to re-evaluate with AI."
              : aiFeedback?.errorType
              ? `Error: ${aiFeedback.errorType}. Click to retry AI evaluation.`
              : needsReEvaluation
              ? isMultiPart
                ? "Upload grading failed or needs review. Re-run AI evaluation or grade manually below."
                : isCircuitSubmission
                  ? "Solution upload needs grading or review. Re-run AI vision evaluation."
                  : "This answer requires manual review or re-evaluation."
              : isMultiPart
              ? "Re-run AI grading on the uploaded solution."
              : isCircuitSubmission
              ? "Re-run AI vision grading on the uploaded circuit solution."
              : "Click to re-evaluate this code question with AI."}
          </p>
          {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
        </div>
        <Button
          onClick={handleReEvaluate}
          disabled={isReEvaluating}
          size="sm"
          className="ml-4 bg-amber-600 hover:bg-amber-700 text-white"
        >
          {isReEvaluating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Evaluating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Re-evaluate with AI
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// Manual grade override - per-question points override for instructors/admins
const ManualGradeOverride = ({
  answerId,
  attemptId,
  questionId,
  pointsEarned,
  overridePoints,
  maxPoints,
  userType,
  onOverridden,
  portalTheme = null,
}: {
  answerId?: number
  attemptId?: string
  questionId?: number
  pointsEarned: number
  overridePoints?: number | null
  maxPoints: number
  userType?: "student" | "admin" | "instructor"
  onOverridden: () => void
  portalTheme?: FacultyResultsDetailTheme | null
}) => {
  const effectiveValue = overridePoints ?? pointsEarned ?? 0
  const [points, setPoints] = useState(String(effectiveValue))
  const [isApplying, setIsApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync local state when props change (e.g. after refetch following override)
  useEffect(() => {
    setPoints(String(effectiveValue))
  }, [effectiveValue])

  if (userType !== "instructor" && userType !== "admin") return null

  const maxPts = maxPoints || 1
  const handleApply = async () => {
    if (!answerId && !(attemptId && questionId != null)) {
      setError("Missing answer row — refresh the page")
      return
    }
    const val = parseFloat(points)
    if (isNaN(val) || val < 0 || val > maxPts) {
      setError(`Enter 0–${maxPts}`)
      return
    }
    setIsApplying(true)
    setError(null)
    try {
      const adminId = sessionStorage.getItem("adminId")
      const payload =
        answerId != null
          ? { answerId, pointsEarned: val }
          : { attemptId: Number(attemptId), questionId, pointsEarned: val }
      const res = await instructorApiFetch("/api/instructor/results/override-question-grade", {
        method: "POST",
        headers: adminId
          ? {
              ...buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" }),
              "x-admin-id": adminId,
            }
          : buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      toast.success("Grade overridden", { description: `${val}/${maxPts} pts applied` })
      onOverridden()
    } catch (err: any) {
      setError(err.message || "Failed")
      toast.error("Override failed", { description: err.message })
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <div className={portalTheme?.insetPanel ?? "mt-4 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/30"}>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-slate-600 dark:text-slate-400">Manual override:</span>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={maxPts}
            step={0.01}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            className="w-24 min-w-[5rem] h-8 text-sm"
          />
          <span className="text-xs text-slate-500">/ {maxPts} pts</span>
        </div>
        <Button size="sm" variant="outline" onClick={handleApply} disabled={isApplying} className="shrink-0">
          {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4 mr-1" />}
          Apply
        </Button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>}
    </div>
  )
}

const FeedbackText = ({ text, className }: { text: string; className?: string }) => (
  <FeedbackTextRenderer
    text={text}
    className={className ?? "text-sm text-slate-800 dark:text-slate-200 leading-relaxed"}
  />
)

// AI Feedback Display Component for Quiz Results
const AIFeedbackDisplay = ({ 
  feedback: rawFeedback, 
  sampleAnswers,
  portalTheme = null,
}: { 
  feedback: QuestionResult['ai_feedback']
  sampleAnswers?: QuestionResult['sample_answers']
  portalTheme?: FacultyResultsDetailTheme | null
}) => {
  const feedback = (
    flattenStoredAiFeedback(rawFeedback) ?? rawFeedback
  ) as QuestionResult["ai_feedback"]
  if (!feedback) return null

  const isMultiPartUploadPending =
    feedback.questionType === "multi_part" &&
    feedback.multiPartAiGraded !== true &&
    (feedback.uploadPending === true || feedback.requiresManualReview === true)

  const displayPercent = isMultiPartUploadPending
    ? undefined
    : canonicalAiPercentForUi(feedback)
  const previewPercent =
    isMultiPartUploadPending && feedback.uploadScorePercentPreview != null
      ? Number(feedback.uploadScorePercentPreview)
      : undefined
  const pctForStyle = displayPercent ?? previewPercent ?? 0

  const scoreColor = 
    pctForStyle >= 90 ? "text-green-600 dark:text-green-400" :
    pctForStyle >= 70 ? "text-blue-600 dark:text-blue-400" :
    pctForStyle >= 50 ? "text-yellow-600 dark:text-yellow-400" :
    "text-red-600 dark:text-red-400"

  const bgColor = 
    pctForStyle >= 90 ? "bg-green-50/80 dark:bg-green-900/30 border-green-200/60 dark:border-green-700/60" :
    pctForStyle >= 70 ? "bg-blue-50/80 dark:bg-blue-900/30 border-blue-200/60 dark:border-blue-700/60" :
    pctForStyle >= 50 ? "bg-yellow-50/80 dark:bg-yellow-900/30 border-yellow-200/60 dark:border-yellow-700/60" :
    "bg-red-50/80 dark:bg-red-900/30 border-red-200/60 dark:border-red-700/60"

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-5 rounded-2xl border ${bgColor}`}
    >
      {/* Header with Score */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {feedback.aiGraded ? (
            <div className={portalTheme?.aiIconWell ?? cn("p-2 rounded-xl", RESULTS_ACCENT_SOFT_PILL)}>
              <svg className={cn("h-5 w-5", portalTheme?.fp.iconText ?? RESULTS_ACCENT_PTS_ICON)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
          ) : (
            <div className="p-2 bg-gray-100/80 dark:bg-gray-800/80 rounded-xl">
              <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
          <div>
            <h4 className="font-bold text-slate-900 dark:text-slate-100">
              {feedback.aiGraded && !isMultiPartUploadPending
                ? "AI Evaluation"
                : feedback.multiPartMcqGraded && !feedback.aiGraded
                  ? "Auto-graded (Multiple Choice)"
                  : isMultiPartUploadPending && feedback.aiGraded
                    ? "AI Feedback (pending review)"
                    : "Manual Review Required"}
            </h4>
            {isMultiPartUploadPending ? (
              <p className="text-xs text-slate-700 dark:text-slate-200">
                Upload score is not final — re-evaluate with AI or wait for your instructor.
              </p>
            ) : feedback.requiresManualReview ? (
              <p className="text-xs text-slate-700 dark:text-slate-200">Your instructor may adjust this grade if needed.</p>
            ) : null}
          </div>
        </div>
        {(displayPercent !== undefined || previewPercent !== undefined) && (
          <div className="text-right">
            <div className={`text-3xl font-bold ${scoreColor}`}>
              {formatCanonicalAiPercent((displayPercent ?? previewPercent)!)}
            </div>
            <div className="text-xs text-slate-700 dark:text-slate-200 flex items-center gap-1 justify-end">
              {isMultiPartUploadPending && previewPercent != null ? "Preview" : "Score"}
              {feedback.bestScore && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  🏆 Best
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Score Breakdown - transparent breakdown so students know exactly why they scored what they scored */}
      {(() => {
        const sb = feedback.scoreBreakdown
        const breakdown = sb ?? (feedback.criteria && {
          criteriaScores: feedback.criteria as Record<string, number>,
          finalScore: feedback.score
        })
        if (!breakdown) return null
        const hasContent = breakdown.criteriaScores || breakdown.rawScore != null ||
          (breakdown.suspiciousTypingPenalty != null && breakdown.suspiciousTypingPenalty > 0) ||
          breakdown.finalScore != null || feedback.score != null
        if (!hasContent) return null
        return (
          <div className="mb-4 p-4 bg-slate-50/80 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-600">
            <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              📊 Detailed Scoring
            </h5>
            <div className="space-y-2 text-sm">
              {breakdown.criteriaScores && (
                <div className="flex flex-wrap gap-3">
                  {Object.entries(breakdown.criteriaScores).map(([key, val]) => (
                    <span key={key} className="text-slate-700 dark:text-slate-300">
                      {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}: {val}
                    </span>
                  ))}
                </div>
              )}
              {breakdown.rawScore != null && (
                <p className="text-slate-700 dark:text-slate-300">
                  Raw score (code quality): {breakdown.rawScore}%
                </p>
              )}
              {sb?.suspiciousTypingPenalty != null && sb.suspiciousTypingPenalty > 0 && (
                <div className="p-2 bg-amber-50/80 dark:bg-amber-900/30 rounded-lg border border-amber-200/60 dark:border-amber-700/60">
                  <p className="text-amber-800 dark:text-amber-200 font-medium">
                    Suspicious typing penalty: −{sb.suspiciousTypingPenalty}%
                  </p>
                  {sb.penaltyReason && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">{sb.penaltyReason}</p>
                  )}
                </div>
              )}
              {(breakdown.finalScore != null || displayPercent != null) && (
                <p className="font-semibold text-slate-900 dark:text-slate-100 pt-1">
                  Final score:{" "}
                  {(breakdown.finalScore != null
                    ? breakdown.finalScore
                    : displayPercent)}
                  %
                </p>
              )}
            </div>
          </div>
        )
      })()}

      {feedback.questionType === "multi_part" &&
        feedback.mcqEarned != null &&
        feedback.mcqMaxPoints != null && (
          <div className="mb-4 p-4 bg-white/50 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-600">
            <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Multiple Choice Score
            </h5>
            <p className="text-sm text-slate-800 dark:text-slate-200">
              {Number(feedback.mcqEarned).toFixed(2)} / {Number(feedback.mcqMaxPoints)} pts
            </p>
            {feedback.uploadMaxPoints != null && Number(feedback.uploadMaxPoints) > 0 && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                {feedback.uploadPending
                  ? `Uploaded solution: pending review (up to ${feedback.uploadMaxPoints} pts).`
                  : feedback.uploadPointsEarned != null
                    ? `Upload: ${Number(feedback.uploadPointsEarned).toFixed(2)} / ${Number(feedback.uploadMaxPoints)} pts`
                    : `Solution upload: not submitted (up to ${feedback.uploadMaxPoints} pts available).`}
              </p>
            )}
          </div>
        )}

      {/* Detailed Explanation - show detailedExplanation or fallback to feedback for manual grades */}
      {(feedback.detailedExplanation || (feedback.feedback && !feedback.gradeBreakdown?.reasoning)) && (
        <div className="mb-4 p-4 bg-white/50 dark:bg-slate-800 rounded-xl border-l-4 border-blue-500 dark:border-blue-400">
          <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
            📝 Grade Explanation
          </h5>
          <FeedbackText text={String(feedback.detailedExplanation || feedback.feedback || "")} />
        </div>
      )}

      {/* Grade Breakdown */}
      {feedback.gradeBreakdown && (
        <div className="mb-4 space-y-4">
          {/* Reasoning */}
          {feedback.gradeBreakdown.reasoning && (
            <div className="p-4 bg-white/50 dark:bg-slate-800 rounded-xl">
              <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                🧠 Reasoning
              </h5>
              <FeedbackText text={String(feedback.gradeBreakdown.reasoning)} />
            </div>
          )}

          {/* Strengths */}
          {feedback.gradeBreakdown.strengths && feedback.gradeBreakdown.strengths.length > 0 && (
            <div className="p-4 bg-green-50/50 dark:bg-green-900/20 rounded-xl border border-green-200/50 dark:border-green-700/50">
              <h5 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2 flex items-center gap-2">
                ✅ Strengths
              </h5>
              <ul className="space-y-1">
                {feedback.gradeBreakdown.strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-green-700 dark:text-green-300">
                    <span className="text-green-600 dark:text-green-400 font-bold mt-0.5">•</span>
                    <FeedbackText text={String(strength)} className="text-sm text-green-700 dark:text-green-300" />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weaknesses */}
          {feedback.gradeBreakdown.weaknesses && feedback.gradeBreakdown.weaknesses.length > 0 && (
            <div className="p-4 bg-yellow-50/50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200/50 dark:border-yellow-700/50">
              <h5 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2 flex items-center gap-2">
                ⚠️ Areas for Improvement
              </h5>
              <ul className="space-y-1">
                {feedback.gradeBreakdown.weaknesses.map((weakness, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-yellow-700 dark:text-yellow-300">
                    <span className="text-yellow-600 dark:text-yellow-400 font-bold mt-0.5">•</span>
                    <FeedbackText text={String(weakness)} className="text-sm text-yellow-700 dark:text-yellow-300" />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Improvements */}
          {feedback.gradeBreakdown.improvements && feedback.gradeBreakdown.improvements.length > 0 && (
            <div className="p-4 bg-blue-50/50 dark:bg-blue-900/20 rounded-xl border border-blue-200/50 dark:border-blue-700/50">
              <h5 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
                🚀 How to Improve
              </h5>
              <ul className="space-y-1">
                {feedback.gradeBreakdown.improvements.map((improvement, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-blue-700 dark:text-blue-300">
                    <span className="text-blue-600 dark:text-blue-400 font-bold mt-0.5">•</span>
                    <FeedbackText text={String(improvement)} className="text-sm text-blue-700 dark:text-blue-300" />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Sample Answers */}
      {sampleAnswers && sampleAnswers.length > 0 && (
        <div className="mb-4 p-4 bg-white/50 dark:bg-slate-800 rounded-xl border border-slate-200/50 dark:border-slate-600">
          <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            📚 Sample Correct Answers
          </h5>
          <div className="space-y-4">
            {sampleAnswers.map((sample, index) => (
              <div key={index} className={cn("rounded-xl overflow-hidden", portalTheme ? "mt-0" : "border border-slate-200 dark:border-slate-600 shadow-sm")}>
                <div className={portalTheme?.sampleAnswerHeader ?? cn("bg-[var(--cc-accent-soft)] px-4 py-2.5 border-b border-slate-200 dark:border-slate-600")}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className={cn("text-xs font-bold uppercase tracking-wide", portalTheme?.fp.iconText ?? RESULTS_ACCENT_PTS_ICON)}>
                      {sample.approach}
                    </span>
                    <span className="text-xs text-slate-700 dark:text-slate-200 italic">
                      {sample.description}
                    </span>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 p-4">
                  <pre className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre font-mono leading-relaxed overflow-x-auto">
                    <code className="language-cpp">{sample.code}</code>
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Itemized Issues - specific, actionable feedback */}
      {feedback.itemizedIssues && feedback.itemizedIssues.length > 0 && (
        <div className="mb-4 p-4 bg-amber-50/80 dark:bg-amber-900/20 rounded-xl border border-amber-200/60 dark:border-amber-700/50">
          <h5 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-3 flex items-center gap-2">
            📋 Itemized Feedback
          </h5>
          <div className="space-y-3">
            {feedback.itemizedIssues.map((item, index) => (
              <div key={index} className="p-3 bg-white/60 dark:bg-slate-800/60 rounded-lg border border-amber-200/40 dark:border-amber-700/40">
                <div className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                  {index + 1}. <FeedbackText text={String(item.issue)} className="inline text-sm font-medium text-amber-800 dark:text-amber-200" />
                </div>
                {item.location && (
                  <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                    <span className="font-medium">Location:</span>{" "}
                    <FeedbackText text={String(item.location)} className="inline text-xs text-slate-600 dark:text-slate-400" />
                  </div>
                )}
                {item.fix && (
                  <div className="text-xs text-green-700 dark:text-green-300">
                    <span className="font-medium">Fix:</span>{" "}
                    <FeedbackText text={String(item.fix)} className="inline text-xs text-green-700 dark:text-green-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback Text (Fallback) */}
      {feedback.feedback && (
        <div className="mb-4 p-4 bg-white/50 dark:bg-slate-800 rounded-xl">
          <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
            💬 General Feedback
          </h5>
          <FeedbackText text={String(feedback.feedback)} />
        </div>
      )}

      {/* Suggestions */}
      {feedback.suggestions && feedback.suggestions.length > 0 && (
        <div className={portalTheme?.insetPanel ?? cn("mb-4 p-4 rounded-xl border", RESULTS_ACCENT_SOFT_PILL)}>
          <h5 className={cn("text-sm font-semibold mb-2 flex items-center gap-2", portalTheme?.fp.iconText ?? RESULTS_ACCENT_PTS_ICON)}>
            💡 Suggestions
          </h5>
          <ul className="space-y-1">
            {feedback.suggestions.map((suggestion: string, index: number) => (
              <li key={index} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <span className={cn("font-bold mt-0.5", portalTheme?.fp.iconText ?? RESULTS_ACCENT_PTS_ICON)}>•</span>
                <FeedbackText text={String(suggestion)} className="text-sm text-slate-700 dark:text-slate-300" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Error/Manual Review Notice */}
      {isMultiPartUploadPending && (
        <div className="mt-4 p-4 bg-amber-50/80 dark:bg-amber-900/30 border-2 border-amber-300/60 dark:border-amber-700/60 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100/80 dark:bg-amber-800/80 rounded-lg">
              <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h5 className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-1">
                Upload Pending Review
              </h5>
              <p className="text-xs text-amber-800 dark:text-amber-200">
                {feedback.statusMessage ||
                  "AI could not finalize your upload score. Use Re-evaluate to try again, or your instructor will grade it manually."}
              </p>
              {feedback.errorType && (
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 italic">
                  Reason: {feedback.errorType === 'evaluation_failed' ? 'AI evaluation was unable to process this answer' :
                           feedback.errorType === 'timeout' ? 'AI evaluation timed out' :
                           feedback.errorType === 'connection_error' ? 'Connection issue during evaluation' :
                           'Technical issue during evaluation'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Criteria Breakdown - derive from score when criteria is all zeros */}
      {(() => {
        const c = feedback.criteria
        const score = displayPercent ?? (feedback.score ?? 0)
        const sum = (c?.correctness ?? 0) + (c?.codeQuality ?? 0) + (c?.efficiency ?? 0) + (c?.completeness ?? 0)
        const criteria = sum > 0 ? {
          correctness: c?.correctness ?? 0,
          codeQuality: c?.codeQuality ?? 0,
          efficiency: c?.efficiency ?? 0,
          completeness: c?.completeness ?? 0,
        } : score > 0 ? {
          correctness: Math.round((score / 100) * 40),
          codeQuality: Math.round((score / 100) * 25),
          efficiency: Math.round((score / 100) * 20),
          completeness: Math.round((score / 100) * 15),
        } : null
        if (!criteria) return null
        return (
          <div className="mb-4 space-y-2">
            <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              📊 Detailed Scoring
            </h5>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white/50 dark:bg-slate-800 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Correctness</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{criteria.correctness}/40</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${Math.min(100, (criteria.correctness / 40) * 100)}%` }}></div>
                </div>
              </div>
              <div className="p-3 bg-white/50 dark:bg-slate-800 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Code Quality</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{criteria.codeQuality}/25</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-green-600 h-1.5 rounded-full" style={{ width: `${Math.min(100, (criteria.codeQuality / 25) * 100)}%` }}></div>
                </div>
              </div>
              <div className="p-3 bg-white/50 dark:bg-slate-800 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Efficiency</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{criteria.efficiency}/20</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                  <div className="h-1.5 rounded-full bg-[var(--cc-accent)]" style={{ width: `${Math.min(100, (criteria.efficiency / 20) * 100)}%` }}></div>
                </div>
              </div>
              <div className="p-3 bg-white/50 dark:bg-slate-800 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200">Completeness</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{criteria.completeness}/15</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-orange-600 h-1.5 rounded-full" style={{ width: `${Math.min(100, (criteria.completeness / 15) * 100)}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Suggestions (Fallback) */}
      {feedback.suggestions && feedback.suggestions.length > 0 && (
        <div className="p-4 bg-white/50 dark:bg-slate-800 rounded-xl">
          <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
            💡 Quick Tips
          </h5>
          <ul className="space-y-2">
            {feedback.suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-slate-800 dark:text-slate-200">
                <span className="text-blue-600 dark:text-blue-400 font-bold mt-0.5">•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  )
}

interface QuestionResult {
  question_text: string
  question_type: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  option_e: string
  correct_answer: string
  selected_answer: string | null
  is_correct: boolean
  ai_feedback?: {
    score?: number
    status?: string
    statusMessage?: string
    feedback?: string
    criteria?: {
      correctness: number
      codeQuality: number
      efficiency: number
      completeness: number
    }
    suggestions?: string[]
    detailedExplanation?: string
    scoreBreakdown?: {
      criteriaScores?: Record<string, number>
      rawScore?: number
      suspiciousTypingPenalty?: number
      penaltyReason?: string
      finalScore?: number
    }
    gradeBreakdown?: {
      reasoning: string
      strengths: string[]
      weaknesses: string[]
      improvements: string[]
    }
    itemizedIssues?: { issue: string; location: string; fix: string }[]
    aiGraded?: boolean
    requiresManualReview?: boolean
    bestScore?: boolean // Indicates this is the best score achieved
    attemptCount?: number // Number of attempts made
  }
  sample_answers?: Array<{
    approach: string
    description: string
    code: string
  }>
  /** Instructor: raw code snapshot from DB (before replay-based display fix) */
  code_saved_snapshot?: string | null
  /** Instructor: document reconstructed from typing_replay at end of session */
  code_from_typing_replay?: string | null
  /** Instructor: normalized text differs between saved snapshot and replay */
  code_saved_vs_replay_mismatch?: boolean
}

interface ResultsData {
  student_name: string
  student_id: string
  section: string
  quiz_title: string
  score: number
  total_questions: number
  total_points?: number // Total points from all questions (preferred over total_questions)
  percentage: number
  questions: QuestionResult[]
  quiz_id: number
  assessment_type?: string
  tab_switch_count?: number
  copy_paste_attempts?: number
  mouse_leave_count?: number
  auto_submitted?: boolean
  violation_reason?: string | null
  gemini_strikes_count?: number
  prevAttemptId?: number | null
  nextAttemptId?: number | null
  totalAttempts?: number
  currentIndex?: number
  section_breakdown?: Array<{
    title: string
    earned: number
    max: number
    weightPercent: number
    sectionPercentage: number
  }>
  section_config?: Array<{ title: string; question_types: string[]; weight_percent: number; question_order_start?: number; question_order_end?: number }> | null
  /** Instructor: avg time spent per question type (across all students) for breakdown KPI; null = no data yet */
  avg_time_by_question_type?: Array<{ question_type: string; avg_seconds: number | null }>
  /** Student: in-progress attempt saved for later — show Continue button to resume */
  can_continue?: boolean
  /** Set when attempt is submitted; used for instructor total-score override UI */
  completed_at?: string | null
  /** Attempt start time — used with completed_at for session-length KPI when per-question timers are missing */
  started_at?: string | null
  /** Server count of fully correct questions (informational; aligns with scoring display) */
  correct_answers?: number
  /** Student: instructor hid per-question review and PDF until released (finals / anti-sharing). */
  results_review_locked?: boolean
  /** Instructor view: cohort % stats for this quiz (all completed attempts) */
  cohort_average_percent?: number | null
  cohort_top_percent?: number | null
  /** Instructor: all completed attempts for this student on this quiz */
  student_attempts?: Array<{
    id: number
    attemptNumber: number
    percentage: number
    score: number
    isFinalGrade: boolean
    shouldShowPnd: boolean
    resultsFinalized: boolean
    completedAt: string | null
  }>
  /** Instructor marked this report as reviewed/finalized for the student */
  results_finalized?: boolean
  results_finalized_at?: string | null
  results_finalized_by?: string | null
}

interface RetakeStatus {
  quiz: {
    id: number
    title: string
    retakeEnabled: boolean
    retakeLimit: number | null
    retakePolicy: string
    reviewBeforeRetake: boolean
  }
  attempts: Array<{
    id: number
    attemptNumber: number
    score: number
    totalQuestions: number
    totalPoints?: number
    questionsCorrect?: number
    percentage: number
    startedAt: string
    completedAt: string | null
    isFinalGrade: boolean
    hasViewedReport: boolean
  }>
  canRetake: boolean
  attemptsRemaining: number | null
  finalGrade: number | null
  hasRetakeAccess?: boolean
  retakeBlockReason?: string | null
  forfeitRetakeOnReportView?: boolean
  reason?: string
  expiredRetakeSlots?: number | null
}

const handleDownloadPDF = async (attemptId: string, results: ResultsData | null, assessmentType: string = "quiz") => {
  if (!results) return
  if (results.results_review_locked) {
    toast.error("PDF not available yet", {
      description:
        "Your instructor has temporarily locked detailed results. You will be able to download your report after they release it.",
      duration: 6000,
    })
    return
  }
  const startTime = Date.now()
  try {
    const { generateQuizResultsPdfArrayBuffer: buildPdf } = await import("@/lib/quiz-results-pdf")
    const buf = await buildPdf(results as any, results.assessment_type || assessmentType)
    const blob = new Blob([buf], { type: "application/pdf" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const filename = buildResultsPdfFilename(
      results.student_name,
      results.section,
      results.assessment_type || assessmentType,
    )
    a.download = filename
    document.body.appendChild(a)
    a.click()
    URL.revokeObjectURL(url)
    document.body.removeChild(a)
    const duration = Date.now() - startTime
    const logModuleComplete = assessmentType === "mid_semester" ? "mid_semester" : "quiz"
    logEvent(logModuleComplete, "pdf", "PDF_DOWNLOAD_COMPLETE", {
      attemptId,
      assessmentType,
      filename,
      durationMs: duration,
      questionCount: results.questions.length,
    }, "success")
  } catch (error) {
    const logModuleError = assessmentType === "mid_semester" ? "mid_semester" : "quiz"
    logError(logModuleError, "pdf", error instanceof Error ? error : new Error(String(error)), {
      attemptId,
      assessmentType,
      phase: "pdf_generation",
    })
    toast.error("Failed to generate PDF", {
      description: "Please try again or contact support if the issue persists",
      duration: 5000,
    })
  }
}

export function QuizResults({
  attemptId,
  isAdminView = false,
  assessmentType = "quiz",
  userType = "student",
  embedInDashboard = false,
  preferDashboardV2 = false,
  resultsOverride = null,
}: { 
  attemptId: string
  isAdminView?: boolean
  assessmentType?: string
  userType?: "student" | "admin" | "instructor"
  /** When true (instructor + dashboard-v2), use dashboard-v2 paths for back navigation */
  embedInDashboard?: boolean
  /** When true (student results page), always use dashboard-v2 paths for back navigation */
  preferDashboardV2?: boolean
  /** When provided, use this data instead of fetching (e.g. for instructor preview) */
  resultsOverride?: ResultsData | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [results, setResults] = useState<ResultsData | null>(null)
  const [retakeStatus, setRetakeStatus] = useState<RetakeStatus | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showForfeitAlert, setShowForfeitAlert] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showAllQuestions, setShowAllQuestions] = useState(false)
  const [showIncorrectOnly, setShowIncorrectOnly] = useState(false)
  const [showViewReportDialog, setShowViewReportDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasViewedReport, setHasViewedReport] = useState(false)
  const [selectedAttemptTab, setSelectedAttemptTab] = useState(0)
  const [showAttemptSelector, setShowAttemptSelector] = useState(false)
  const [attemptSelectorExpanded, setAttemptSelectorExpanded] = useState(true)
  const [selectedFinalAttempt, setSelectedFinalAttempt] = useState<number | null>(null)
  const [retakeAccess, setRetakeAccess] = useState<{ hasAccess: boolean } | null>(null)
  const [backupData, setBackupData] = useState<any>(null)
  const [showBackupSummary, setShowBackupSummary] = useState(false)
  // Default to false - show modal until we confirm PDF was downloaded
  const [hasDownloadedReport, setHasDownloadedReport] = useState(false)
  const [showExitWarningModal, setShowExitWarningModal] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const [hasShownAutoModal, setHasShownAutoModal] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [isRecalculating, setIsRecalculating] = useState(false)
  const [isReEvaluatingAll, setIsReEvaluatingAll] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [recalcCooldownUntil, setRecalcCooldownUntil] = useState(0)
  const [highlightedSection, setHighlightedSection] = useState<string | null>(null)
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [pendingReportAction, setPendingReportAction] = useState<"all" | "incorrect" | { section: string } | null>(null)
  const [replayViewerOpen, setReplayViewerOpen] = useState(false)
  const [replayViewerReplay, setReplayViewerReplay] = useState<TypingReplay | null>(null)
  const [isEmailingGrades, setIsEmailingGrades] = useState(false)
  const [isTogglingFinalized, setIsTogglingFinalized] = useState(false)
  /** Student PND guidance: prompt to re-evaluate before download/finalize */
  const [pndGuidanceDismissed, setPndGuidanceDismissed] = useState(false)
  const [showPndReevaluateModal, setShowPndReevaluateModal] = useState(false)
  const [showReevaluateProcessModal, setShowReevaluateProcessModal] = useState(false)

  const needsPndGuidance = useMemo(() => {
    if (!results || isAdminView || userType !== "student") return false
    if ((results as any)?.student_bulk_re_evaluate_used_at) return false
    if ((results.questions || []).some((q: any) => q.override_points != null)) return false
    return computeHasAnyFlagOrError(results)
  }, [results, isAdminView, userType])

  const blockExitModalForPnd = needsPndGuidance && !pndGuidanceDismissed

  const completedRetakeAttempts = useMemo(() => {
    return (retakeStatus?.attempts || [])
      .filter((a) => a.completedAt != null)
      .sort((a, b) => b.attemptNumber - a.attemptNumber)
  }, [retakeStatus?.attempts])

  const selectedRetakeAttempt = useMemo(() => {
    if (selectedFinalAttempt == null) return null
    return completedRetakeAttempts.find((a) => a.id === selectedFinalAttempt) ?? null
  }, [completedRetakeAttempts, selectedFinalAttempt])

  const confirmedFinalRetakeAttempt = useMemo(
    () => completedRetakeAttempts.find((a) => a.isFinalGrade) ?? null,
    [completedRetakeAttempts],
  )

  const syncRetakeSelection = useCallback(
    (attemptId: number | null) => {
      if (attemptId == null) return
      setSelectedFinalAttempt(attemptId)
      const idx = completedRetakeAttempts.findIndex((a) => a.id === attemptId)
      if (idx >= 0) setSelectedAttemptTab(idx)
    },
    [completedRetakeAttempts],
  )

  useEffect(() => {
    if (!confirmedFinalRetakeAttempt) return
    setAttemptSelectorExpanded(false)
    syncRetakeSelection(confirmedFinalRetakeAttempt.id)
    // Only re-sync when the confirmed attempt id changes (not while user is editing).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmedFinalRetakeAttempt?.id])

  useEffect(() => {
    try {
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(`pnd-reeval-dismissed-${attemptId}`)) {
        setPndGuidanceDismissed(true)
      }
    } catch {
      /* ignore */
    }
  }, [attemptId])

  useEffect(() => {
    if (!needsPndGuidance || pndGuidanceDismissed) {
      setShowPndReevaluateModal(false)
      return
    }
    const t = setTimeout(() => setShowPndReevaluateModal(true), 800)
    return () => clearTimeout(t)
  }, [needsPndGuidance, pndGuidanceDismissed])

  const dismissPndGuidance = () => {
    setPndGuidanceDismissed(true)
    setShowPndReevaluateModal(false)
    try {
      sessionStorage.setItem(`pnd-reeval-dismissed-${attemptId}`, "1")
    } catch {
      /* ignore */
    }
  }

  // Component mount
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Scroll to section when selectedSection expands (after DOM updates)
  useEffect(() => {
    if (!selectedSection) return
    const sectionId = `section-${selectedSection.replace(/\s+/g, "-").toLowerCase()}`
    const timer = setTimeout(() => {
      const el = document.getElementById(sectionId)
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 100)
    return () => clearTimeout(timer)
  }, [selectedSection])

  // Check for pending navigation from "View Report" button - show immediately (before waiting for results)
  useEffect(() => {
    // Only check for students, not admin/instructor views
    if (isAdminView || userType !== "student") {
      return
    }
    if (blockExitModalForPnd) return
    if (results?.results_review_locked) {
      try {
        sessionStorage.removeItem("pendingReportNavigation")
        sessionStorage.removeItem("pendingReportAttemptId")
      } catch {
        /* ignore */
      }
      return
    }

    // Don't show if already downloaded
    if (hasDownloadedReport) {
      // Clean up session storage if PDF is downloaded
      sessionStorage.removeItem('pendingReportNavigation')
      sessionStorage.removeItem('pendingReportAttemptId')
      return
    }

    // Don't show if already shown (prevent multiple triggers)
    if (hasShownAutoModal) {
      return
    }

    // Check if we came from a "View Report" button - show immediately (don't wait for results)
    const pendingNav = sessionStorage.getItem('pendingReportNavigation')
    const pendingAttemptId = sessionStorage.getItem('pendingReportAttemptId')
    
    // Compare as strings to ensure match
    const cameFromReportButton = pendingNav && pendingAttemptId && pendingAttemptId === attemptId.toString()

    if (cameFromReportButton) {
      // Show modal immediately (don't wait for results to load)
      setShowExitWarningModal(true)
      setHasShownAutoModal(true)
      // Clean up session storage AFTER showing modal
      setTimeout(() => {
        sessionStorage.removeItem('pendingReportNavigation')
        sessionStorage.removeItem('pendingReportAttemptId')
      }, 1000) // Small delay to ensure modal is shown
    }
  }, [attemptId, isAdminView, userType, hasDownloadedReport, hasShownAutoModal, blockExitModalForPnd, results?.results_review_locked])

  useEffect(() => {
    if (isAdminView || userType !== "student" || !results?.results_review_locked) return
    setShowExitWarningModal(false)
    try {
      sessionStorage.removeItem("pendingReportNavigation")
      sessionStorage.removeItem("pendingReportAttemptId")
    } catch {
      /* ignore */
    }
  }, [isAdminView, userType, results?.results_review_locked])

  // Auto-show modal after 1.5 seconds on results page (only for students)
  useEffect(() => {
    // Only show for students, not admin/instructor views
    if (isAdminView || userType !== "student") {
      return
    }
    if (blockExitModalForPnd) return

    // Wait for results to load
    if (!results) {
      return
    }
    if (results.results_review_locked) {
      return
    }

    // Don't show if already downloaded
    if (hasDownloadedReport) {
      return
    }

    // Don't show if already shown (prevent multiple triggers)
    if (hasShownAutoModal) {
      return
    }

    // Show modal after 1.5 seconds
    const timer = setTimeout(() => {
      setShowExitWarningModal(true)
      setHasShownAutoModal(true)
    }, 1500)

    return () => {
      clearTimeout(timer)
    }
  }, [results, hasDownloadedReport, hasShownAutoModal, isAdminView, userType, blockExitModalForPnd])

  // Backup: Force show modal if conditions are met but modal isn't showing
  useEffect(() => {
    if (isAdminView || userType !== "student" || hasDownloadedReport || !results) {
      return
    }
    if (blockExitModalForPnd) return
    if (results.results_review_locked) return

    // If we should show the modal but it's not showing, force it
    if (!showExitWarningModal && !hasShownAutoModal) {
      // Wait a bit longer (3 seconds) as backup
      const backupTimer = setTimeout(() => {
        setShowExitWarningModal(true)
        setHasShownAutoModal(true)
      }, 3000)

      return () => {
        clearTimeout(backupTimer)
      }
    }
  }, [results, hasDownloadedReport, showExitWarningModal, hasShownAutoModal, isAdminView, userType, blockExitModalForPnd])

  useEffect(() => {
    if (resultsOverride) {
      setResults(resultsOverride)
      setLoading(false)
      setError(null)
      return
    }
    const fetchResults = async () => {
      // Define endpoint outside try block so it's accessible in catch block
      const endpoint = isAdminView 
        ? userType === "instructor" 
          ? `/api/instructor/results/${attemptId}/view` 
          : `/api/admin/results/${attemptId}/view`
        : `/api/student/results/${attemptId}`

      try {
        const headers: HeadersInit =
          userType === "instructor" && isAdminView
            ? buildInstructorAuthorizedApiHeaders()
            : userType === "admin" && isAdminView
              ? {
                  ...buildInstructorAuthorizedApiHeaders(),
                  ...(sessionStorage.getItem("adminId")
                    ? { "x-admin-id": sessionStorage.getItem("adminId")! }
                    : {}),
                }
              : getStudentAuthHeaders()
        
        const response =
          userType === "instructor" && isAdminView
            ? await instructorApiFetch(endpoint, { headers, cache: "no-store" })
            : userType === "admin" && isAdminView
              ? await fetch(endpoint, { headers, credentials: "include", cache: "no-store" })
              : await fetch(endpoint, { headers, credentials: "include", cache: "no-store" })
        if (!response.ok) {
          let errorText = ""
          try {
            errorText = await response.text()
          } catch (e) {
            errorText = `HTTP ${response.status}: ${response.statusText}`
          }
          try {
            const errorJson = JSON.parse(errorText)
            if (response.status === 409 && errorJson?.is_in_progress) {
              setError(`IN_PROGRESS: ${errorJson.message || "This student has not finished the assessment yet."}`)
              return
            }
          } catch {
            /* not JSON */
          }
          throw new Error(`Failed to fetch results: ${response.status} - ${errorText.substring(0, 200)}`)
        }
        const data = await response.json()


        // CRITICAL: Ensure questions array exists even if empty
        if (!data.questions || !Array.isArray(data.questions)) {
          data.questions = []
        }

        setResults(data)
        
        // Set hasDownloadedReport from database flag (or instructor lock = no PDF nag)
        setHasDownloadedReport(studentResultsPdfGateSatisfied(data))

        // CRITICAL: Auto-show questions if auto-submitted for violations (not when instructor locked review)
        if ((data.auto_submitted || data.violation_reason) && !data.results_review_locked) {
          setShowAllQuestions(true)
        }

        // Use assessment_type from API response if available
        if (data.assessment_type && data.assessment_type !== assessmentType) {
          // The PDF will use the correct type from results.assessment_type
        }

        if (!isAdminView) {
          const studentId = sessionStorage.getItem("studentDatabaseId")
          if (studentId && data.quiz_id) {

            // Check retake access
            const accessResponse = await studentApiFetch(`/api/student/retake-access?studentId=${studentId}`)
            if (accessResponse.ok) {
              const accessData = await accessResponse.json()
              setRetakeAccess(accessData)
            }

            const retakeResponse = await fetch(
              `/api/student/quiz-retake-status?studentId=${studentId}&quizId=${data.quiz_id}`,
            )
            if (retakeResponse.ok) {
              const retakeData = await retakeResponse.json()
              setRetakeStatus(retakeData)

              const currentAttempt = retakeData.attempts?.find((a: any) => a.id === Number.parseInt(attemptId))
              if (currentAttempt?.hasViewedReport) {
                setHasViewedReport(true)
              }

              // CRITICAL: Only show attempt selector if there are multiple COMPLETED attempts
              // Incomplete attempts (completedAt: null) should not be shown in the selector
              // This prevents showing "Multiple Attempts Detected" for incomplete test sessions
              const completedAttempts = (retakeData.attempts?.filter((a: any) => a.completedAt !== null) || [])
                .sort((a: any, b: any) => b.attemptNumber - a.attemptNumber)
              
              
              // Only show selector if there are multiple COMPLETED attempts
              if (completedAttempts.length > 1) {
                setShowAttemptSelector(true)
                const currentIndex = completedAttempts.findIndex((a: any) => a.id === Number.parseInt(attemptId))
                if (currentIndex !== -1) {
                  setSelectedAttemptTab(currentIndex)
                } else {
                  // Current attempt might not be completed yet, select first completed attempt
                  setSelectedAttemptTab(0)
                }

                const finalAttempt = completedAttempts.find((a: any) => a.isFinalGrade)
                if (finalAttempt) {
                  setSelectedFinalAttempt(finalAttempt.id)
                } else {
                  // Pre-select the highest-scoring completed attempt (not merely the current URL attempt)
                  const bestAttempt = completedAttempts.reduce((best: any, a: any) => {
                    const bestPct = Number(best?.percentage ?? best?.score ?? 0)
                    const aPct = Number(a?.percentage ?? a?.score ?? 0)
                    return aPct > bestPct ? a : best
                  }, completedAttempts[0])
                  setSelectedFinalAttempt(bestAttempt?.id ?? completedAttempts[0]?.id)
                }
              } else if (completedAttempts.length === 1) {
                // Only one completed attempt - don't show selector
                setShowAttemptSelector(false)
              } else {
                // No completed attempts yet - don't show selector
                setShowAttemptSelector(false)
              }
            }
          }
        }

        // Debug logging for answer data

        if (data.percentage >= 70) {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
          })
        }
        
        // Backup / primary-storage comparison — instructors & admins only (debugging)
        if (isAdminView) {
          try {
            const backupResponse =
              userType === "instructor"
                ? await instructorApiFetch(`/api/student/answer-backup/${attemptId}`, { headers })
                : await fetch(`/api/student/answer-backup/${attemptId}`, {
                    headers,
                    credentials: "include",
                    cache: "no-store",
                  })
            if (backupResponse.ok) {
              const backupJson = await backupResponse.json()
              setBackupData(backupJson)
              if (
                backupJson.summary &&
                (backupJson.summary.missingInPrimary > 0 || backupJson.summary.failedToSave > 0)
              ) {
                setShowBackupSummary(true)
              }
            } else {
              setBackupData(null)
            }
          } catch {
            setBackupData(null)
          }
        } else {
          setBackupData(null)
        }
      } catch (error: any) {
        setError(error.message || "Failed to load quiz results")
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [attemptId, isAdminView, userType, refreshTrigger, resultsOverride])

  // Exit warning modal - only for students
  useEffect(() => {
    // Only show exit warning for students, not admin/instructor views
    if (isAdminView || userType !== "student") {
      return
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Don't block when there's an error - user should be able to leave freely
      if (error) return
      if (!hasDownloadedReport) {
        e.preventDefault()
        e.returnValue = "You haven't downloaded your report yet. Are you sure you want to leave?"
        return e.returnValue
      }
    }

    const handleVisibilityChange = () => {
      if (!hasDownloadedReport && !document.hidden) {
        // User came back to the tab - show warning modal
        setShowExitWarningModal(true)
      }
    }

    // Handle browser back/forward navigation
    const handlePopState = (e: PopStateEvent) => {
      if (!hasDownloadedReport) {
        // Prevent navigation and show modal
        e.preventDefault()
        window.history.pushState(null, "", window.location.href)
        setShowExitWarningModal(true)
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    
    // Push initial state to track navigation attempts
    window.history.pushState(null, "", window.location.href)
    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("popstate", handlePopState)
    }
  }, [hasDownloadedReport, isAdminView, userType, error])

  // Handle navigation attempts - intercept link clicks and back button
  useEffect(() => {
    if (isAdminView || userType !== "student") {
      return
    }

    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')
      if (link && link.href && !hasDownloadedReport) {
        const url = new URL(link.href)
        if (url.pathname !== window.location.pathname) {
          e.preventDefault()
          setPendingNavigation(url.pathname)
          setShowExitWarningModal(true)
        }
      }
    }

    document.addEventListener('click', handleLinkClick, true)
    return () => {
      document.removeEventListener('click', handleLinkClick, true)
    }
  }, [hasDownloadedReport, isAdminView, userType])

  const handleViewReportClick = () => {
    if (!isAdminView && results?.results_review_locked) {
      toast("Detailed review is locked", {
        description:
          "Your instructor will release per-question review and the PDF when everyone has finished. You can still see your score above.",
        duration: 6000,
      })
      return
    }
    // When forfeit is disabled (codewrite quizzes), skip the forfeit dialog and show report directly
    const forfeitOnView = retakeStatus?.forfeitRetakeOnReportView ?? true
    if (!forfeitOnView) {
      setShowAllQuestions(!showAllQuestions)
      setSelectedSection(null)
      if (!hasViewedReport) recordReportView()
      return
    }
    if (retakeStatus?.canRetake && !hasViewedReport) {
      setPendingReportAction("all")
      setShowViewReportDialog(true)
    } else {
      setShowAllQuestions(!showAllQuestions)
      setSelectedSection(null)
    }
  }

  const recordReportView = async () => {
    if (!results?.quiz_id) return
    try {
      const studentId = sessionStorage.getItem("studentDatabaseId")
      await studentApiFetch("/api/student/forfeit-retake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, quizId: results.quiz_id, studentId }),
      })
      setHasViewedReport(true)
      if (studentId) {
        const retakeResponse = await fetch(
          `/api/student/quiz-retake-status?studentId=${studentId}&quizId=${results.quiz_id}`,
        )
        if (retakeResponse.ok) setRetakeStatus(await retakeResponse.json())
      }
    } catch {
      /* non-blocking */
    }
  }

  const confirmViewReport = async () => {
    const action = pendingReportAction
    setHasViewedReport(true)
    setShowViewReportDialog(false)
    setPendingReportAction(null)

    if (action === "all") {
    setShowAllQuestions(true)
      setShowIncorrectOnly(false)
      setSelectedSection(null)
    } else if (action === "incorrect") {
      setShowIncorrectOnly(true)
      setShowAllQuestions(false)
      setSelectedSection(null)
    } else if (action && typeof action === "object" && "section" in action) {
      setSelectedSection(action.section)
      setShowAllQuestions(false)
      setShowIncorrectOnly(false)
    } else {
      setShowAllQuestions(true)
      setSelectedSection(null)
    }

    try {
      const studentId = sessionStorage.getItem("studentDatabaseId")
      const response = await studentApiFetch("/api/student/forfeit-retake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          quizId: results?.quiz_id,
          studentId,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to forfeit retake")
      }


      if (results?.quiz_id) {
        const studentId = sessionStorage.getItem("studentDatabaseId")
        const retakeResponse = await fetch(
          `/api/student/quiz-retake-status?studentId=${studentId}&quizId=${results.quiz_id}`,
        )
        if (retakeResponse.ok) {
          const retakeData = await retakeResponse.json()
          setRetakeStatus(retakeData)
        }
      }

      // Toast removed as per user request - dialog dismissal is enough feedback
    } catch (error) {
      // Only show error toast if something actually fails
      toast.error("Failed to update retake status")
    }
  }

  const handleSelectFinalAttempt = async () => {
    if (!selectedFinalAttempt || !results?.quiz_id) return

    try {
      const response = await studentApiFetch("/api/student/select-final-attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: selectedFinalAttempt,
          quizId: results.quiz_id,
          studentId: sessionStorage.getItem("studentDatabaseId"),
        }),
      })

      if (response.ok) {
        toast.success("Final attempt selected successfully!")
        setAttemptSelectorExpanded(false)
        const studentId = sessionStorage.getItem("studentDatabaseId")
        if (studentId) {
          const retakeResponse = await fetch(
            `/api/student/quiz-retake-status?studentId=${studentId}&quizId=${results.quiz_id}`,
          )
          if (retakeResponse.ok) {
            const retakeData = await retakeResponse.json()
            setRetakeStatus(retakeData)
            const finalAttempt = retakeData.attempts?.find((a: { isFinalGrade?: boolean }) => a.isFinalGrade)
            if (finalAttempt?.id) syncRetakeSelection(finalAttempt.id)
          }
        }
        setRefreshTrigger((t) => t + 1)
      } else {
        toast.error("Failed to select final attempt")
      }
    } catch (error) {
      toast.error("Failed to select final attempt")
    }
  }

  const handleCancelAttemptSelectionEdit = () => {
    setAttemptSelectorExpanded(false)
    if (confirmedFinalRetakeAttempt) {
      syncRetakeSelection(confirmedFinalRetakeAttempt.id)
    }
  }

  const handleRetakeQuiz = async () => {
    if (hasViewedReport || !results?.quiz_id) {
      return
    }

    // Check if student has donation or membership access
    // If they don't have access, show upgrade modal
    if (!retakeStatus?.hasRetakeAccess) {
      setShowUpgradeModal(true)
      return
    }

    // If they have access but can't retake (forfeited or max attempts), show appropriate alert
    if (!retakeStatus?.canRetake) {
      if (retakeStatus?.retakeBlockReason === "retake_forfeited") {
        setShowForfeitAlert(true)
        return
      }
      if (retakeStatus?.retakeBlockReason === "retake_calendar_expired") {
        const slots = retakeStatus?.expiredRetakeSlots
        toast(
          typeof slots === "number" && slots > 0
            ? `${slots} unused retake${slots !== 1 ? "s" : ""} expired when the deadline passed. Use Extend (rollover) during an active window if eligible.`
            : (retakeStatus?.reason ||
              "Retakes for this assessment expired after the due date. Use Extend when eligible or contact your instructor."),
          { variant: "default" },
        )
        return
      }
      if (retakeStatus?.retakeBlockReason === "retake_max_attempts") {
        toast("You've used all attempts for this assessment.", { variant: "default" })
        return
      }
      return
    }

    // Can retake: navigate to quiz
    const retakePath =
      assessmentType === "practice"
        ? `/student/practice/take/${results.quiz_id}`
        : `/student/quiz/${results.quiz_id}`

    router.push(retakePath)
  }

  const handleContinueQuiz = () => {
    if (!results?.quiz_id) return
    const continuePath =
      assessmentType === "homework"
        ? `/student/homework/${results.quiz_id}`
        : assessmentType === "mid_semester"
        ? `/student/mid-semester/${results.quiz_id}`
        : assessmentType === "final"
        ? `/student/final/${results.quiz_id}`
        : assessmentType === "practice"
        ? `/student/practice/take/${results.quiz_id}`
        : `/student/quiz/${results.quiz_id}`
    router.push(continuePath)
  }

  const handleToggleResultsFinalized = async (finalized: boolean) => {
    if (!results) return
    setIsTogglingFinalized(true)
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...buildInstructorAuthorizedApiHeaders(),
      }
      if (userType === "admin" && typeof sessionStorage !== "undefined") {
        const adminId = sessionStorage.getItem("adminId")
        if (adminId) headers["x-admin-id"] = adminId
      }
      const res = await instructorApiFetch(`/api/instructor/results/${attemptId}/finalize`, {
        method: "POST",
        headers,
        body: JSON.stringify({ finalized }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setResults((prev) =>
          prev
            ? {
                ...prev,
                results_finalized: data.results_finalized ?? finalized,
                results_finalized_at: data.results_finalized_at ?? null,
                results_finalized_by: data.results_finalized_by ?? null,
              }
            : prev,
        )
        toast.success(
          finalized ? "Results finalized for student" : "Finalized flag cleared",
          { duration: 3500 },
        )
      } else {
        toast.error("Could not update finalized status", {
          description: data.error || "Please try again.",
          duration: 5000,
        })
      }
    } catch (err) {
      console.error("Failed to toggle finalized:", err)
      toast.error("Failed to update finalized status", { duration: 5000 })
    } finally {
      setIsTogglingFinalized(false)
    }
  }

  const handleRecalculateScore = async () => {
    if (!results?.quiz_id || isRecalculating) return
    if (Date.now() < recalcCooldownUntil) {
      const secs = Math.ceil((recalcCooldownUntil - Date.now()) / 1000)
      toast.error(`Please wait ${secs}s before recalculating again.`)
      return
    }
    setIsRecalculating(true)
    try {
      const res = await studentApiFetch("/api/student/finalize-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getStudentAuthHeaders() },
        body: JSON.stringify({ attemptId, quizId: results.quiz_id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 429) {
          const retryMs = Number(data.retryAfterMs) || 5000
          setRecalcCooldownUntil(Date.now() + retryMs)
        }
        throw new Error(data.error || "Recalculation failed")
      }
      setRecalcCooldownUntil(Date.now() + 5000)
      toast.success("Score recalculated")
      setRefreshTrigger((t) => t + 1)
    } catch (err: any) {
      toast.error(err.message || "Failed to recalculate score")
    } finally {
      setIsRecalculating(false)
    }
  }

  /** Student bulk re-evaluate (one-time per attempt): single batch request — `failed`/`all` same as server modes */
  const runStudentBulkReevaluate = async (mode: "failed" | "all") => {
    if (!results?.quiz_id || isReEvaluatingAll) return
    const studentDbId = typeof window !== "undefined" ? sessionStorage.getItem("studentDatabaseId") : null
    if (!studentDbId) {
      toast.error("Please log in again to re-evaluate")
      return
    }
    setIsReEvaluatingAll(true)
    try {
      const lastResult = await runStudentBulkReevaluateBatch(Number(attemptId), mode, studentDbId)
      const evaluated = typeof lastResult.evaluated === "number" ? lastResult.evaluated : 0
      toast.success(mode === "failed" ? "Re-evaluate failed questions completed" : "Re-evaluate all completed", {
        description:
          (typeof lastResult.message === "string" ? lastResult.message : null) ||
          `Processed ${evaluated} question(s). Your score has been updated where possible.`,
      })
      dismissPndGuidance()
      setShowPndReevaluateModal(false)
      setRefreshTrigger((t) => t + 1)
    } catch (err: any) {
      toast.error(err.message || "Re-evaluation failed")
    } finally {
      setIsReEvaluatingAll(false)
    }
  }

  // Raw percentage (0-100) - never round this; used for calculations and raw score display
  let rawPercentageValue = 0
  if (results?.percentage !== undefined && results.percentage !== null) {
    const raw = Number(results.percentage)
    if (!isNaN(raw) && isFinite(raw)) {
      rawPercentageValue = Math.min(100, Math.max(0, raw))
    }
  }
  // CRITICAL SAFEGUARD: Recalculate from score/total_points if percentage seems wrong (10x bug)
  if (results?.score !== undefined && results?.total_points !== undefined && results.total_points > 0) {
    const recalculated = (results.score / results.total_points) * 100
    if (rawPercentageValue > 0 && recalculated > 0) {
      const ratio = rawPercentageValue / recalculated
      if (ratio > 9.5 && ratio < 10.5) rawPercentageValue = Math.min(100, recalculated)
    }
  }
  // For the circle: show PND% whenever ANY error or flag exists - never show a numeric score until re-evaluated
  const hasAnyFlagOrError = computeHasAnyFlagOrError(results)
  const apiPnd = (results as any)?.should_show_pnd as boolean | undefined
  const failedReevalCandidateCount = countFailedModeQuestions(results?.questions || [])
  const displayPercentageCircle = hasAnyFlagOrError
    ? "PND%"
    : String(Math.round(Math.min(100, rawPercentageValue)))
  const assessmentTypeResolved = ((results as any)?.assessment_type as string | undefined) || assessmentType || "quiz"
  const performanceSummaryLabel =
    assessmentTypeResolved === "homework"
      ? "Homework Performance Summary"
      : assessmentTypeResolved === "mid_semester"
        ? "Mid-Semester Exam Summary"
        : assessmentTypeResolved === "final"
          ? "Final Exam Summary"
          : assessmentTypeResolved === "practice"
            ? "Practice Summary"
            : "Quiz Performance Summary"
  const gradedProgressPct = Math.min(100, rawPercentageValue)
  /** SVG donut gauge (performance summary circle) */
  const donutRadius = 75
  const donutStroke = 12
  const donutCircumference = 2 * Math.PI * donutRadius
  const donutProgressLength = hasAnyFlagOrError
    ? 0
    : (Math.min(100, gradedProgressPct) / 100) * donutCircumference

  // CRITICAL: Always show all questions if auto-submitted for violations (unless instructor locked review)
  const isAutoSubmitted = results?.auto_submitted || results?.violation_reason
  const studentResultsReviewLocked = !isAdminView && Boolean(results?.results_review_locked)

  // For admin/instructor view, always show all questions
  // CRITICAL FIX: Ensure questionsToShow is always an array, never undefined
  const questionsToShow = isAdminView
    ? results?.questions || []
    : studentResultsReviewLocked
      ? []
      : isAutoSubmitted
        ? results?.questions || [] // Always show all questions for auto-submitted
        : showIncorrectOnly
          ? (results?.questions || []).filter((q) => !q.is_correct)
          : showAllQuestions
            ? results?.questions || []
            : selectedSection
              ? (results?.questions || []).filter((q) => (q as any).section_title === selectedSection)
            : []

  // Only lock when forfeit is enabled; when forfeit_retake_on_report_view=false (codewrite), student can view without forfeiting
  const shouldLockReviewButtons = !isAdminView && retakeStatus?.canRetake && !hasViewedReport && (retakeStatus?.forfeitRetakeOnReportView ?? true)
  const pdfOrReviewBlockedByInstructor = studentResultsReviewLocked
  // Always show retake button if not admin view and report not viewed (check access on click)
  const shouldShowRetakeButton = !isAdminView && !hasViewedReport

  const fr = getFacultyResultsDetailTheme(embedInDashboard, userType)
  const { themeId, tokens } = useAppearance()
  const isResultsDark = Boolean(tokens.isDark)
  const resultsSwatch = useMemo(
    () => chromeSwatchFromTokens(tokens, themeId),
    [themeId, tokens],
  )
  const spawnResultsRipple = useMaterialRipple(false)

  // Custom error modal - no browser native alerts
  const getErrorModalContent = () => {
    if (!error) return null
    const isInProgress = /^IN_PROGRESS:/i.test(error)
    const is404 = /404|not found|Quiz attempt not found/i.test(error)
    const is401 = /401|unauthorized|session/i.test(error)
    const title = isInProgress
      ? "Student Still Taking Assessment"
      : is404
        ? "Report Not Found"
        : is401
          ? "Session Expired"
          : "Unable to Load Report"
    const description = isInProgress
      ? error.replace(/^IN_PROGRESS:\s*/i, "")
      : is404
      ? "This report may no longer be available or the link may be incorrect. Please return to your dashboard and try again."
      : is401
        ? "Your session may have expired. Please log in again and try viewing your report."
        : "Something went wrong while loading your results. Please try again or return to your dashboard."
    const backPath = isAdminView
      ? userType === "instructor"
        ? (isInstructorResultDetailPath(pathname)
            ? instructorResultsListPath(embedInDashboard)
            : embedInDashboard
              ? "/faculty/dashboard"
              : "/instructor/dashboard")
        : "/admin"
      : getBackPathForAssessmentV2(assessmentType === "mid_semester" ? "mid_semester" : assessmentType === "final" ? "final" : assessmentType === "homework" ? "homework" : "quiz")
    const backLabel = isAdminView
      ? (userType === "instructor" && isInstructorResultDetailPath(pathname)
          ? "Back to Results"
          : userType === "admin"
            ? "Back to Results"
            : "Back to Dashboard")
      : assessmentType === "mid_semester" ? "Back to Mid-Semester Exams" : assessmentType === "final" ? "Back to Final Exams" : assessmentType === "homework" ? "Back to Homework" : "Back to Quizzes"
    return { title, description, backPath, backLabel }
  }
  const errorContent = getErrorModalContent()

  if (error && errorContent) {
    const handleErrorModalClose = (open: boolean) => {
      if (!open) {
        setError(null)
        router.push(errorContent!.backPath)
      }
    }
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <Dialog open={true} onOpenChange={handleErrorModalClose}>
          <DialogContent
            className="sm:max-w-lg bg-white dark:bg-slate-800 border-slate-200/60 dark:border-slate-600 rounded-2xl shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_25px_rgba(0,0,0,0.4)]"
          >
            <DialogHeader className="p-6 pb-4">
              <DialogTitle className="flex items-center gap-3 text-slate-800 dark:text-slate-200">
                <div className="p-2.5 bg-red-100/80 dark:bg-red-900/80 rounded-xl shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-700 dark:text-red-400" />
                </div>
                <span>{errorContent.title}</span>
              </DialogTitle>
              <DialogDescription className="pt-4 text-slate-700 dark:text-slate-200 text-[15px] leading-relaxed">
                {errorContent.description}
              </DialogDescription>
              {!/^IN_PROGRESS:/i.test(error) && (
              <div className="mt-3 px-4 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                <span className="text-sm font-medium text-amber-800 dark:text-amber-200">Score: PND%</span>
                <span className="text-xs text-amber-700 dark:text-amber-300 block mt-0.5">Unable to load—your score may be pending. Please retry or contact your instructor.</span>
              </div>
              )}
            </DialogHeader>
            <div className="px-6 pb-2">
              <details className="group">
                <summary className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 select-none">
                  Technical details
                </summary>
                <p className="mt-2 text-xs font-mono text-slate-500 dark:text-slate-400 break-all bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 max-h-24 overflow-y-auto">
                  {error}
                </p>
              </details>
            </div>
            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-3 p-6 pt-4">
              <Button
                variant="outline"
                onClick={() => router.push(errorContent!.backPath)}
                className="rounded-full w-full sm:w-auto order-2 sm:order-1"
              >
                <ArrowLeft className="h-4 w-4 mr-2 shrink-0" />
                {errorContent!.backLabel}
              </Button>
              <Button
                onClick={() => {
                  setError(null)
                  setRefreshTrigger((t) => t + 1)
                }}
                className={cn("rounded-full w-full sm:w-auto order-1 sm:order-2", fr?.cta ?? RESULTS_ACCENT_CTA)}
              >
                <RefreshCw className="h-4 w-4 mr-2 shrink-0" />
                Retry
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 sm:space-y-8 text-slate-900 dark:text-slate-100">
      {isAdminView && userType === "instructor" && (results?.student_attempts?.length ?? 0) > 1 ? (
        <InstructorStudentAttemptPicker
          attempts={results!.student_attempts!}
          currentAttemptId={Number.parseInt(attemptId, 10)}
          studentName={results!.student_name ?? "Student"}
          detailPath={(id) => instructorResultDetailPath(id, embedInDashboard)}
          onFinalChanged={() => setRefreshTrigger((t) => t + 1)}
        />
      ) : null}
      {showAttemptSelector && completedRetakeAttempts.length > 1 && (
        <Card
          className={cn(
            resultsPanelClass(isResultsDark, false),
            !isResultsDark && "rounded-2xl",
          )}
          style={isResultsDark ? resultsDarkElevatedStyle() : undefined}
        >
          {!attemptSelectorExpanded && confirmedFinalRetakeAttempt ? (
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: resultsSwatch[0],
                      color: resultsSwatch[3],
                    }}
                  >
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold text-gray-800 dark:text-slate-100">
                      Final attempt selected
                    </p>
                    <p className="text-sm text-gray-700 dark:text-slate-300">
                      Attempt {confirmedFinalRetakeAttempt.attemptNumber} ·{" "}
                      {confirmedFinalRetakeAttempt.percentage.toFixed(1)}% ·{" "}
                      {confirmedFinalRetakeAttempt.questionsCorrect ?? 0} /{" "}
                      {confirmedFinalRetakeAttempt.totalQuestions || 0} correct
                    </p>
                    <p className="text-xs text-gray-700 dark:text-slate-400">
                      {completedRetakeAttempts.length} completed attempts on record
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAttemptSelectorExpanded(true)}
                  onPointerDown={spawnResultsRipple}
                  className={cn(
                    RESULTS_ACTION_BTN,
                    materialSurfaceClass,
                    "w-full shrink-0 rounded-full border-[var(--cc-accent)]/40 bg-[var(--cc-accent-soft)] px-5 text-[var(--cc-accent-dark)] hover:bg-[var(--cc-accent)]/15 dark:border-[var(--cc-accent)]/50 dark:text-[var(--cc-accent)] sm:w-auto",
                  )}
                  style={{ ["--material-ink" as string]: "var(--cc-accent)" }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Change selection
                </Button>
              </div>
            </CardContent>
          ) : (
            <>
              <CardHeader className="p-6 sm:p-8 text-center">
                <div className="flex items-center justify-center mb-4">
                  <div className={cn("p-3 rounded-2xl", RESULTS_ACCENT_SOFT_PILL)}>
                    <AlertCircle className={cn("h-6 w-6", RESULTS_ACCENT_PTS_ICON)} />
                  </div>
                </div>
                <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-200 mb-2">
                  {confirmedFinalRetakeAttempt ? "Change final attempt" : "Multiple Attempts Detected"}
                </CardTitle>
                <p className="text-sm sm:text-base text-slate-700 dark:text-slate-200 max-w-lg mx-auto">
                  {confirmedFinalRetakeAttempt
                    ? "Pick a different completed attempt if you want to update your recorded final score."
                    : `You have ${completedRetakeAttempts.length} completed attempts for this assessment. Choose which score to keep as your final grade.`}
                </p>
              </CardHeader>
              <CardContent className="p-6 sm:p-8 pt-0">
                <div className="w-full max-w-4xl mx-auto mb-6 sm:mb-8">
                  {completedRetakeAttempts.length > 6 && (
                    <p className="mb-3 text-center text-xs text-slate-500 dark:text-slate-400">
                      Scroll to compare all attempts — newest first
                    </p>
                  )}
                  <div className="rounded-xl border border-slate-200/70 dark:border-slate-600/70 bg-slate-50/40 dark:bg-slate-900/30 p-3 sm:p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[min(60vh,26rem)] overflow-y-auto overscroll-contain py-2 px-1 scroll-pt-2">
                      {completedRetakeAttempts.map((attempt, index) => {
                        const isSelected = selectedAttemptTab === index
                        const pct = Math.floor((attempt.percentage || 0) * 100) / 100
                        const correct = attempt.questionsCorrect ?? 0
                        const total = attempt.totalQuestions || 0
                        return (
                          <motion.button
                            key={attempt.id}
                            type="button"
                            onClick={() => {
                              setSelectedAttemptTab(index)
                              setSelectedFinalAttempt(attempt.id)
                            }}
                            whileTap={{ scale: 0.98 }}
                            className={cn(
                              "relative flex min-h-[7.5rem] flex-col items-center justify-center rounded-xl border px-3 py-4 text-center transition-all duration-200",
                              isSelected
                                ? RESULTS_ACCENT_ATTEMPT_SELECTED
                                : "border-slate-200/80 bg-white/90 text-slate-800 hover:border-[var(--cc-accent-border)] hover:bg-slate-50 dark:border-white/15 dark:bg-slate-700/80 dark:text-slate-100 dark:hover:border-[var(--cc-accent)]/50 dark:hover:bg-slate-700",
                            )}
                          >
                            <div className="flex flex-wrap items-center justify-center gap-1.5 mb-2">
                              <span
                                className={cn(
                                  "text-xs font-semibold uppercase tracking-wide",
                                  isSelected ? "text-white/90" : "text-slate-500 dark:text-slate-400",
                                )}
                              >
                                Attempt {attempt.attemptNumber}
                              </span>
                              {attempt.isFinalGrade && (
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                    isSelected
                                      ? "bg-white/20 text-white"
                                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
                                  )}
                                >
                                  Final
                                </span>
                              )}
                            </div>
                            <div className={cn("text-2xl font-bold tabular-nums", isSelected ? "text-white" : "")}>
                              {pct.toFixed(1)}%
                            </div>
                            <div
                              className={cn(
                                "mt-1 text-xs tabular-nums",
                                isSelected ? "text-white/90" : "text-slate-600 dark:text-slate-300",
                              )}
                            >
                              {correct} / {total} correct
                            </div>
                            {isSelected && (
                              <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[var(--cc-accent-dark)] shadow-md">
                                <Check className="h-3 w-3" />
                              </div>
                            )}
                          </motion.button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {selectedFinalAttempt && selectedRetakeAttempt && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mx-auto max-w-lg text-center rounded-xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/80 p-4 sm:p-6"
                  >
                    <div className="mb-4 sm:mb-6">
                      <p className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">
                        Selected: Attempt {selectedRetakeAttempt.attemptNumber} (
                        {selectedRetakeAttempt.percentage.toFixed(1)}%)
                      </p>
                      <p className="text-sm sm:text-base text-slate-700 dark:text-slate-200">
                        {confirmedFinalRetakeAttempt &&
                        selectedFinalAttempt === confirmedFinalRetakeAttempt.id
                          ? "This is your current final attempt."
                          : "This will be recorded as your final score for this assessment."}
                      </p>
                    </div>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
                      {confirmedFinalRetakeAttempt && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCancelAttemptSelectionEdit}
                          className="rounded-full w-full sm:w-auto"
                        >
                          Cancel
                        </Button>
                      )}
                      {(!confirmedFinalRetakeAttempt ||
                        selectedFinalAttempt !== confirmedFinalRetakeAttempt.id) && (
                        <Button
                          onClick={handleSelectFinalAttempt}
                          className={cn(
                            "rounded-full px-6 py-2 sm:px-8 sm:py-3 text-sm sm:text-base transition-all duration-300 w-full sm:w-auto",
                            RESULTS_ACCENT_CTA,
                          )}
                        >
                          Confirm Selection
                        </Button>
                      )}
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </>
          )}
        </Card>
      )}

      <div id="printable-report" className="min-w-0 space-y-6 sm:space-y-8">
        <Card className={fr?.mainCard ?? "question-card min-w-0 overflow-hidden border border-slate-200/60 dark:border-slate-500 shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_25px_rgba(0,0,0,0.4)] rounded-2xl bg-white dark:bg-slate-800 backdrop-blur-sm"}>
          <CardHeader className="pb-4 text-center p-4 sm:p-6 md:p-8">
            <CardTitle className={fr?.title ?? cn("text-xl sm:text-2xl md:text-3xl font-bold tracking-tight break-words", RESULTS_ACCENT_TITLE)}>{results?.quiz_title}</CardTitle>
            <p className={fr?.subtitle ?? "text-xs sm:text-sm text-slate-700 dark:text-slate-200 mt-2"}>{performanceSummaryLabel}</p>
          </CardHeader>

          <CardContent className="question-options flex flex-col items-center justify-center text-center space-y-4 sm:space-y-6 md:space-y-8 pt-4 sm:pt-6 p-4 sm:p-6 md:p-8">
            <div className="flex flex-col items-center">
              <div
                className={`relative flex shrink-0 items-center justify-center ${
                  hasAnyFlagOrError
                    ? "h-[11.5rem] w-[11.5rem] min-h-[11.5rem] min-w-[11.5rem] sm:h-52 sm:w-52 sm:min-h-[13rem] sm:min-w-[13rem] md:h-56 md:w-56"
                    : "h-44 w-44 sm:h-48 sm:w-48 md:h-52 md:w-52"
                }`}
              >
                  <div className="pointer-events-none absolute -inset-6 -z-10 sm:-inset-8" aria-hidden>
                    {hasAnyFlagOrError ? (
                      <>
                        <div className="absolute left-0 top-[18%] h-14 w-14 rounded-full bg-[var(--cc-accent)]/15 blur-2xl" />
                        <div className="absolute right-[5%] top-[8%] h-10 w-10 rounded-full bg-slate-400/12 blur-xl" />
                        <div className="absolute bottom-[12%] right-[12%] h-12 w-12 rounded-full bg-[var(--cc-accent)]/12 blur-2xl" />
                      </>
                    ) : (
                      <>
                        <div className="absolute left-0 top-1/4 h-16 w-16 rounded-full bg-emerald-400/18 blur-2xl dark:bg-emerald-500/15" />
                        <div className="absolute right-[2%] top-[10%] h-11 w-11 rounded-full bg-emerald-300/14 blur-xl dark:bg-emerald-400/12" />
                        <div className="absolute bottom-[8%] right-[8%] h-14 w-14 rounded-full bg-emerald-400/12 blur-2xl" />
                        <div className="absolute bottom-[20%] left-[15%] h-9 w-9 rounded-full bg-emerald-300/10 blur-lg" />
                      </>
                    )}
                  </div>
                  <svg
                    className="h-full w-full drop-shadow-[0_8px_24px_rgba(15,23,42,0.08)] dark:drop-shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
                    viewBox="0 0 200 200"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden
                  >
                    <circle
                      cx="100"
                      cy="100"
                      r="62"
                      className={
                        hasAnyFlagOrError
                          ? "fill-slate-100 dark:fill-slate-800/90"
                          : "fill-[#E9F5EF] dark:fill-emerald-950/35"
                      }
                    />
                    <g transform="rotate(-90 100 100)">
                      <circle
                        cx="100"
                        cy="100"
                        r={donutRadius}
                        fill="none"
                        strokeWidth={donutStroke}
                        className="stroke-[#F2F2F2] dark:stroke-slate-600"
                        strokeLinecap="butt"
                      />
                      {!hasAnyFlagOrError && (
                        <circle
                          cx="100"
                          cy="100"
                          r={donutRadius}
                          fill="none"
                          strokeWidth={donutStroke}
                          strokeLinecap="butt"
                          strokeDasharray={`${donutProgressLength} ${donutCircumference}`}
                          className={
                            (results?.percentage ?? 0) >= 70
                              ? "stroke-[#76BA81] dark:stroke-emerald-400"
                              : "stroke-amber-500 dark:stroke-amber-400"
                          }
                        />
                      )}
                    </g>
                  </svg>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center px-2 sm:px-3">
                    {displayPercentageCircle === "PND%" ? (
                      <span
                        className={cn(
                          "text-center font-bold tabular-nums leading-none tracking-tight",
                          fr?.fp.iconText ?? RESULTS_ACCENT_SECTION_TEXT,
                          "text-[1.65rem] sm:text-4xl md:text-5xl",
                        )}
                      >
                        PND%
                      </span>
                    ) : (
                      <div
                        className={cn(
                          "flex items-baseline justify-center leading-none tabular-nums tracking-tight text-[#333333] dark:text-slate-100",
                          displayPercentageCircle.length >= 3
                            ? "text-[2rem] sm:text-[2.75rem] md:text-[3rem]"
                            : "text-4xl sm:text-5xl md:text-[3.25rem]",
                        )}
                      >
                        <span className="font-bold">{displayPercentageCircle}</span>
                        <span
                          className={cn(
                            "font-bold text-[#333333]/85 dark:text-slate-200/90",
                            displayPercentageCircle.length >= 3
                              ? "text-[0.55em] ml-px"
                              : "text-[0.5em] ml-0.5",
                          )}
                        >
                          %
                        </span>
                      </div>
                    )}
                  </div>
                </div>

              {hasAnyFlagOrError ? (
                <p className="mt-4 sm:mt-6 text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-md px-4">
                  Your answers are saved. Score is pending review — this is not a final grade. Re-evaluate or wait for instructor review.
                </p>
              ) : null}
              {results?.section_breakdown &&
                results.section_breakdown.length > 0 &&
                !studentResultsReviewLocked && (
                <div className="mt-8 w-full max-w-4xl mx-auto px-1">
                  <h3 className="mb-5 text-center text-sm font-bold uppercase tracking-widest text-gray-800 dark:text-slate-300">
                    Section Breakdown
                  </h3>
                  <div className="flex flex-wrap justify-center gap-5">
                    {results.section_breakdown.map((s, i) => {
                      const contribution = s.weightPercent > 0 && s.max > 0
                        ? ((s.earned / s.max) * s.weightPercent).toFixed(1)
                        : "0"
                      const pct = s.sectionPercentage ?? 0
                      const theme = resultsSectionTone(pct)
                      const sectionId = `section-${s.title.replace(/\s+/g, "-").toLowerCase()}`
                      const isSelected = selectedSection === s.title || highlightedSection === s.title
                      const handleSectionClick = () => {
                        if (studentResultsReviewLocked) {
                          toast("Detailed review is locked", {
                            description:
                              "Your instructor will release section breakdown and questions when everyone has finished.",
                            duration: 6000,
                          })
                          return
                        }
                        if (shouldLockReviewButtons) {
                          setPendingReportAction({ section: s.title })
                          setShowViewReportDialog(true)
                          return
                        }
                        setSelectedSection((prev) => (prev === s.title ? null : s.title))
                        setShowAllQuestions(false)
                        setHighlightedSection(s.title)
                        if (selectedSection !== s.title) {
                          const el = document.getElementById(sectionId)
                          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
                        }
                      }
                      return (
                        <motion.button
                          key={i}
                          type="button"
                          onClick={handleSectionClick}
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.06, type: "spring", stiffness: 300, damping: 24 }}
                          className={
                            fr
                              ? fr.sectionCard(isSelected)
                              : cn(
                                  "relative w-full overflow-hidden rounded-2xl text-left sm:w-72 sm:max-w-[18rem] sm:flex-shrink-0",
                                  RESULTS_SECTION_INTERACTIVE,
                                  theme.shell,
                                  isSelected &&
                                    "ring-2 ring-[var(--cc-accent)] ring-offset-2 dark:ring-offset-slate-900",
                                )
                          }
                        >
                          {!fr && !isResultsDark ? (
                            <div aria-hidden className={RESULTS_JEANS_HOVER_WASH} />
                          ) : null}
                          <div className="relative z-10 flex flex-col p-5 sm:p-6">
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <span className={cn("truncate text-base font-bold", theme.title)}>
                                {s.title}
                              </span>
                              <span className={cn("shrink-0 text-xs font-semibold", theme.meta)}>
                                {s.weightPercent}% weight
                              </span>
                            </div>
                            <div className={cn("mb-3 text-center text-2xl font-extrabold tabular-nums sm:text-3xl", theme.pct)}>
                              {Number(s.sectionPercentage) % 1 === 0
                                ? `${s.sectionPercentage}%`
                                : `${Number(s.sectionPercentage).toFixed(1)}%`}
                            </div>
                            <div className="mb-4 flex justify-between text-sm">
                              <span className={theme.pointsLabel}>Points</span>
                              <span className={cn("font-semibold tabular-nums", theme.pointsValue)}>
                                {s.earned % 1 === 0 ? s.earned : s.earned.toFixed(1)} / {s.max % 1 === 0 ? s.max : s.max.toFixed(1)}
                              </span>
                            </div>
                            <div className="mt-auto flex justify-center">
                              <div
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium",
                                  fr ? "bg-[var(--muted)]/50 text-[var(--cc-text-muted)]" : theme.badge,
                                )}
                              >
                                <span className="opacity-90">+{contribution}</span>
                                <span>to total</span>
                              </div>
                            </div>
                          </div>
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              )}
              {/* Instructor: Time by Question Type breakdown KPI */}
              {(userType === "instructor" || userType === "admin") && results?.avg_time_by_question_type && results.avg_time_by_question_type.length > 0 && (
                <div className="mt-8 w-full max-w-4xl mx-auto px-1">
                  <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest mb-5 text-center">
                    Avg Time by Question Type
                  </h3>
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                    {results.avg_time_by_question_type.map((t, i) => (
                      <div
                        key={i}
                        className={fr?.infoPill ?? "rounded-xl bg-slate-50/80 dark:bg-slate-800/60 p-4 text-center border border-slate-200/60 dark:border-slate-600/60"}
                      >
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate" title={t.question_type}>
                          {t.question_type}
                        </p>
                        <p className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1">
                          {t.avg_seconds != null && t.avg_seconds >= 0
                            ? t.avg_seconds >= 60
                              ? `${Math.floor(t.avg_seconds / 60)}m ${Math.round(t.avg_seconds % 60)}s`
                              : `${Math.round(t.avg_seconds)}s`
                            : "N/A"}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">avg across class</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Student + pending: single card (score, email note, actions). Instructor: classic score row + actions below. */}
              {!isAdminView && hasAnyFlagOrError ? (
                <div className="mt-6 w-full max-w-lg mx-auto px-1">
                  <div className="rounded-2xl border border-amber-200/90 dark:border-amber-800/50 bg-amber-50/80 dark:bg-amber-950/30 shadow-[0_12px_40px_-12px_rgba(180,83,9,0.2)] dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45)] p-5 sm:p-6 text-left">
                    <div className="flex gap-4">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100/90 dark:bg-amber-900/50 ring-1 ring-amber-300/50 dark:ring-amber-700/45"
                        aria-hidden
                      >
                        <Clock className="h-6 w-6 text-amber-700 dark:text-amber-300" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                          Grade pending
                        </p>
                        {apiPnd !== false ? (
                          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed flex items-start gap-2">
                            <Mail className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden />
                            <span>
                              Please wait for an email from your professor when this attempt is fully graded—or use
                              the actions below to recalculate or re-evaluate your attempt yourself.
                            </span>
                          </p>
                        ) : (
                          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            Your answers are saved. This is not a final grade until review is complete—you can also use
                            the actions below to recalculate or re-evaluate your attempt yourself.
                          </p>
                        )}
                      </div>
                    </div>
                    {results?.questions?.some((q) => q.override_points != null) && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-600 bg-amber-50/90 dark:bg-amber-900/35 text-amber-800 dark:text-amber-200">
                          <Pencil className="h-4 w-4 shrink-0" />
                          <span className="text-sm font-medium">Instructor adjusted</span>
                        </div>
                      </div>
                    )}
                    <div className="mt-5 border-t border-amber-200/70 dark:border-amber-800/45 pt-5 space-y-4">
                      <div className="rounded-xl bg-white/90 dark:bg-slate-800/75 px-4 py-3 border border-slate-200/80 dark:border-slate-600/60 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Trophy className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden />
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Score</span>
                          </div>
                          <div
                            className="inline-flex w-fit max-w-full flex-nowrap items-baseline gap-x-1.5 rounded-lg bg-slate-100/90 px-3 py-1.5 text-slate-900 ring-1 ring-inset ring-slate-200/80 dark:bg-slate-700/50 dark:text-slate-100 dark:ring-slate-600/60 sm:ml-auto"
                            aria-label={`Score pending out of ${results?.total_points || results?.total_questions || 0} points`}
                          >
                            <span className="text-[0.9375rem] font-bold tracking-tight">Pending</span>
                            <span className="text-slate-400 dark:text-slate-500 font-medium" aria-hidden>
                              /
                            </span>
                            <span className="text-[0.9375rem] font-bold tabular-nums">
                              {results?.total_points || results?.total_questions || 0}
                            </span>
                            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">pts</span>
                          </div>
                        </div>
                      </div>
                      {(results?.quiz_id ||
                        (retakeStatus?.canRetake && !hasViewedReport && !results?.can_continue)) && (
                        <div className="mt-4 flex flex-col sm:flex-row flex-wrap items-stretch justify-center gap-2 border-t border-amber-200/60 dark:border-amber-800/35 pt-4">
                          {results?.quiz_id && (
                            <>
                              <Button
                                onClick={handleRecalculateScore}
                                onPointerDown={spawnResultsRipple}
                                disabled={isRecalculating}
                                variant="outline"
                                size="sm"
                                className={cn(
                                  RESULTS_ACTION_BTN,
                                  materialSurfaceClass,
                                  "h-9 gap-2 rounded-lg border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-white/20 dark:bg-zinc-900 dark:text-slate-100 dark:hover:bg-zinc-800/80",
                                )}
                                style={{ ["--material-ink" as string]: "var(--cc-accent)" }}
                              >
                                {isRecalculating ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-4 w-4" />
                                )}
                                {isRecalculating ? "Recalculating…" : "Recalculate"}
                              </Button>
                              {userType === "student" &&
                                !(results as any)?.student_bulk_re_evaluate_used_at &&
                                !results?.questions?.some((q) => q.override_points != null) && (
                                  <Button
                                    onClick={() => runStudentBulkReevaluate("all")}
                                    onPointerDown={spawnResultsRipple}
                                    disabled={isReEvaluatingAll}
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                      RESULTS_ACTION_BTN,
                                      materialSurfaceClass,
                                      "h-9 gap-2 rounded-lg border-amber-400/90 bg-amber-50/80 px-4 text-sm font-semibold text-amber-950 hover:bg-amber-100/80 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/50",
                                    )}
                                    style={{ ["--material-ink" as string]: "#b45309" }}
                                  >
                                    {isReEvaluatingAll ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-4 w-4" />
                                    )}
                                    {isReEvaluatingAll ? "Re-evaluating…" : "Re-evaluate all"}
                                  </Button>
                                )}
                            </>
                          )}
                          {retakeStatus?.canRetake && !hasViewedReport && !results?.can_continue && (
                            <Button
                              onClick={handleViewReportClick}
                              onPointerDown={spawnResultsRipple}
                              variant="outline"
                              size="sm"
                              className={cn(
                                RESULTS_ACTION_BTN,
                                materialSurfaceClass,
                                "h-9 gap-2 rounded-lg border-[var(--cc-accent)]/50 bg-[var(--cc-accent-soft)] px-4 text-sm font-semibold text-[var(--cc-accent-dark)] hover:brightness-105 dark:text-[var(--cc-accent)]",
                              )}
                              style={{ ["--material-ink" as string]: "var(--cc-accent)" }}
                            >
                              <Eye className="h-4 w-4 shrink-0" />
                              View Detailed Report
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : !isAdminView && !hasAnyFlagOrError ? (
                <div className="mt-6 w-full max-w-3xl mx-auto px-1">
                  <div
                    className={cn(
                      "relative overflow-hidden text-left",
                      isResultsDark
                        ? "rounded-2xl border border-[var(--cc-accent)]/30"
                        : cn(RESULTS_JEANS_CARD_STATIC, "rounded-2xl group"),
                    )}
                    style={
                      isResultsDark
                        ? {
                            ...resultsDarkElevatedStyle(),
                            backgroundImage:
                              "radial-gradient(ellipse at 100% 0%, color-mix(in srgb, var(--cc-accent) 22%, transparent), transparent 55%)",
                          }
                        : undefined
                    }
                  >
                    {!isResultsDark ? (
                      <div aria-hidden className={RESULTS_JEANS_HOVER_WASH} />
                    ) : null}
                    <div
                      className="pointer-events-none absolute -right-14 -top-24 h-52 w-52 rounded-full bg-[var(--cc-accent)]/15 blur-3xl"
                      aria-hidden
                    />
                    <div className="relative z-10 space-y-5 p-5 sm:p-7">
                      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                            style={{
                              backgroundColor: resultsSwatch[2],
                              color: "#fff",
                            }}
                          >
                            <CheckCircle2 className="h-6 w-6" strokeWidth={2.25} aria-hidden />
                          </div>
                          <div className="min-w-0 space-y-2">
                            <div
                              className={cn(
                                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                                results?.results_finalized
                                  ? "border-emerald-300/80 bg-emerald-50/90 text-emerald-800 dark:border-emerald-700/70 dark:bg-emerald-950/50 dark:text-emerald-100"
                                  : "border-[var(--cc-accent)]/30 bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]",
                              )}
                            >
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 shrink-0 rounded-full",
                                  results?.results_finalized ? "bg-emerald-500" : "bg-emerald-500",
                                )}
                                aria-hidden
                              />
                              {results?.results_finalized
                                ? "Finalized — instructor reviewed"
                                : "Grading complete"}
                            </div>
                            <p className="text-sm leading-relaxed text-gray-700 dark:text-slate-300">
                              {results?.results_finalized
                                ? "Your instructor has reviewed and approved this score. This is your official result for this attempt."
                                : "Final score for this attempt. Other coursework and exams still count toward your overall course grade."}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-start gap-0.5 border-t border-gray-200 pt-4 sm:border-t-0 sm:border-l sm:border-gray-200 sm:pl-8 sm:pt-0 dark:border-white/15">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-700 dark:text-slate-300">
                            Attempt score
                          </span>
                          <span
                            className={cn(
                              "text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl",
                              (results?.percentage ?? 0) >= 70
                                ? "text-[var(--cc-accent)]"
                                : "text-amber-600 dark:text-amber-400"
                            )}
                          >
                            {Math.round(gradedProgressPct)}%
                          </span>
                        </div>
                      </div>

                      <div
                        className={cn(
                          "rounded-xl p-4",
                          isResultsDark
                            ? "border border-white/15 bg-black/20"
                            : "border border-gray-200 bg-white shadow-sm",
                        )}
                      >
                        <div className="flex flex-wrap items-end justify-between gap-4">
                          <div className="flex items-center gap-2.5">
                            <Trophy className="h-5 w-5 shrink-0 text-[var(--cc-accent)]" aria-hidden />
                            <span className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                              Points on this attempt
                            </span>
                          </div>
                          <div className="flex items-baseline gap-1.5 tabular-nums">
                            <span className="text-2xl font-semibold text-gray-900 dark:text-slate-100">
                              {(results?.score !== undefined ? results.score : 0).toFixed(2)}
                            </span>
                            <span className="text-gray-500 dark:text-slate-400">/</span>
                            <span className="text-lg font-medium text-gray-700 dark:text-slate-300">
                              {results?.total_points || results?.total_questions || 0}
                            </span>
                            <span className="text-xs font-medium text-gray-700 dark:text-slate-400">pts</span>
                          </div>
                        </div>
                        <Progress
                          value={gradedProgressPct}
                          className="mt-4 h-2 w-full rounded-full bg-[var(--cc-accent-soft)] [&_[data-slot=progress-indicator]]:rounded-full [&_[data-slot=progress-indicator]]:bg-[var(--cc-accent)]"
                        />
                      </div>

                      {(() => {
                        const pendingCount = (results?.questions || []).filter((q: any) => isPendingManualReview(q)).length
                        if (pendingCount <= 0) return null
                        return (
                          <div className="flex gap-3 rounded-xl border border-amber-200/80 bg-amber-50/50 px-3 py-2.5 dark:border-amber-900/45 dark:bg-amber-950/40">
                            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                            <p className="text-xs leading-relaxed text-amber-950 dark:text-amber-100/95">
                              <span className="font-semibold">{pendingCount}</span> question
                              {pendingCount === 1 ? "" : "s"} still awaiting manual review from your instructor.
                            </p>
                          </div>
                        )
                      })()}

                      {results?.questions?.some((q) => q.override_points != null) && (
                        <div className="flex flex-wrap gap-2">
                          <div className="inline-flex items-center gap-2 rounded-xl border border-amber-300/80 bg-amber-50/90 px-3 py-2 text-xs font-medium text-amber-950 dark:border-amber-700/70 dark:bg-amber-950/50 dark:text-amber-100">
                            <Pencil className="h-3.5 w-3.5 shrink-0" />
                            Instructor adjusted score
                          </div>
                        </div>
                      )}

                      {results?.results_finalized && (
                        <div className="flex flex-wrap gap-2">
                          <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/80 bg-emerald-50/90 px-3 py-2 text-xs font-medium text-emerald-950 dark:border-emerald-700/70 dark:bg-emerald-950/50 dark:text-emerald-100">
                            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                            Instructor reviewed &amp; approved
                          </div>
                        </div>
                      )}

                      {(results?.quiz_id ||
                        (retakeStatus?.canRetake && !hasViewedReport && !results?.can_continue)) && (
                        <div className="flex flex-col gap-2 border-t border-gray-200 pt-5 dark:border-white/15 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-3">
                          {results?.quiz_id && (
                            <>
                              <Button
                                onClick={handleRecalculateScore}
                                onPointerDown={spawnResultsRipple}
                                disabled={isRecalculating}
                                variant="outline"
                                size="sm"
                                className={cn(
                                  RESULTS_ACTION_BTN,
                                  materialSurfaceClass,
                                  "h-9 gap-2 rounded-lg border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-white/20 dark:bg-zinc-900 dark:text-slate-100 dark:hover:bg-zinc-800/80",
                                )}
                                style={{ ["--material-ink" as string]: "var(--cc-accent)" }}
                              >
                                {isRecalculating ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-4 w-4" />
                                )}
                                {isRecalculating ? "Recalculating…" : "Recalculate"}
                              </Button>
                              {userType === "student" &&
                                !(results as any)?.student_bulk_re_evaluate_used_at &&
                                !results?.questions?.some((q) => q.override_points != null) && (
                                  <Button
                                    onClick={() => runStudentBulkReevaluate("all")}
                                    onPointerDown={spawnResultsRipple}
                                    disabled={isReEvaluatingAll}
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                      RESULTS_ACTION_BTN,
                                      materialSurfaceClass,
                                      "h-9 gap-2 rounded-lg border-[var(--cc-accent)]/40 bg-[var(--cc-accent-soft)] px-4 text-sm font-semibold text-[var(--cc-accent-dark)] hover:bg-[var(--cc-accent)]/15 dark:border-[var(--cc-accent)]/45 dark:bg-[var(--cc-accent)]/20 dark:text-[var(--cc-accent)]",
                                    )}
                                    style={{ ["--material-ink" as string]: "var(--cc-accent)" }}
                                  >
                                    {isReEvaluatingAll ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-4 w-4" />
                                    )}
                                    {isReEvaluatingAll ? "Re-evaluating…" : "Re-evaluate all"}
                                  </Button>
                                )}
                            </>
                          )}
                          {retakeStatus?.canRetake && !hasViewedReport && !results?.can_continue && (
                            <Button
                              onClick={handleViewReportClick}
                              onPointerDown={spawnResultsRipple}
                              variant="outline"
                              size="sm"
                              className={cn(
                                RESULTS_ACTION_BTN,
                                materialSurfaceClass,
                                "h-9 gap-2 rounded-lg border-[var(--cc-accent)]/45 bg-[var(--cc-accent-soft)] px-4 text-sm font-semibold text-[var(--cc-accent-dark)] hover:bg-[var(--cc-accent)]/15",
                              )}
                              style={{ ["--material-ink" as string]: "var(--cc-accent)" }}
                            >
                              <Eye className="h-4 w-4 shrink-0" />
                              View Detailed Report
                            </Button>
                          )}
                        </div>
                      )}

                      {results && hasIntegritySignals(results) && (
                        <div className="space-y-2 border-t border-gray-200 pt-5 dark:border-white/15">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-800 dark:text-slate-300">
                            Integrity &amp; behavior
                          </p>
                          <div
                            className={cn(
                              "max-h-[min(70vh,720px)] overflow-y-auto overflow-x-hidden rounded-xl p-3 sm:p-4",
                              isResultsDark
                                ? "border border-amber-500/35 bg-amber-950/30"
                                : "border border-amber-300 bg-amber-50 shadow-md",
                            )}
                          >
                            <StudentIntegrityBehaviorRecord results={results} variant="embedded" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-6 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                    <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
                      {results?.questions?.some((q) => q.override_points != null) && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-300 dark:border-amber-600 bg-amber-50/80 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                          <Pencil className="h-5 w-5 shrink-0" />
                          <span className="text-sm font-medium">Instructor Adjusted</span>
                        </div>
                      )}
                      {results?.results_finalized &&
                        !(isAdminView && (userType === "instructor" || userType === "admin")) && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-300 dark:border-emerald-600 bg-emerald-50/80 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                          <ShieldCheck className="h-5 w-5 shrink-0" />
                          <span className="text-sm font-medium">Finalized</span>
                        </div>
                      )}
                      <div className={fr?.chip ?? "flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-700/50 border border-slate-200/60 dark:border-slate-600/60"}>
                        <Trophy className={cn("h-5 w-5 shrink-0", fr?.fp.iconText ?? "text-amber-600 dark:text-amber-400")} />
                        <span className="text-slate-600 dark:text-slate-400 text-sm">Score</span>
                        <div className="flex items-center gap-0.5">
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {(() => {
                              if (hasAnyFlagOrError) {
                                const totalPoints = results?.total_points || results?.total_questions || 0
                                return `Pending / ${totalPoints} pts`
                              }
                              const score = results?.score !== undefined ? results.score : 0
                              const totalPoints = results?.total_points || results?.total_questions || 0
                              const pendingCount = (results?.questions || []).filter((q: any) => isPendingManualReview(q)).length
                              const suffix = pendingCount > 0 ? ` (${pendingCount} pending review)` : ""
                              return `${score.toFixed(2)} / ${totalPoints}${suffix}`
                            })()}
                          </span>
                          {isAdminView &&
                            userType === "instructor" &&
                            results?.quiz_id &&
                            !hasAnyFlagOrError && (
                              <InstructorScoreOverrideButton
                                attemptId={Number.parseInt(attemptId, 10)}
                                studentName={results.student_name}
                                assessmentTitle={results.quiz_title}
                                currentScore={results?.score !== undefined ? results.score : 0}
                                totalPoints={Number(results?.total_points ?? results?.total_questions ?? 0)}
                                assessmentType={normalizeAssessmentKindForOverride(results.assessment_type)}
                                usesPercentageScale={
                                  isMidSemesterOverrideType(results.assessment_type) ||
                                  usesWeightedPercentageDisplay(
                                    results.assessment_type,
                                    results.section_config,
                                  )
                                }
                                completedAt={results.completed_at ?? null}
                                onSaved={() => setRefreshTrigger((t) => t + 1)}
                              />
                            )}
                        </div>
                      </div>
                      {(userType === "instructor" || userType === "admin") && isAdminView && (
                        <div
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl",
                            fr?.chip,
                            !fr && cn(
                              "border",
                              results?.results_finalized
                                ? "border-emerald-300 dark:border-emerald-600 bg-emerald-50/80 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                                : "border-slate-200/60 dark:border-slate-600/60 bg-slate-100/80 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400",
                            ),
                          )}
                          title={
                            results?.results_finalized
                              ? `Finalized${results.results_finalized_by ? ` by ${results.results_finalized_by}` : ""}`
                              : "Mark results as reviewed and approved for the student"
                          }
                        >
                          <ShieldCheck className="h-5 w-5 shrink-0" />
                          <span className="text-sm font-medium">Finalized</span>
                          {isTogglingFinalized ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Switch
                              checked={Boolean(results?.results_finalized)}
                              onCheckedChange={handleToggleResultsFinalized}
                              disabled={shouldLockReviewButtons}
                              aria-label="Toggle finalized status for student results"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {!isAdminView && results?.can_continue && (
              <div className="flex flex-col items-center gap-4">
                <p className="text-slate-600 dark:text-slate-400 text-center max-w-md">
                  Your progress was saved. Click below to resume where you left off.
                </p>
                <Button
                  onClick={handleContinueQuiz}
                  className={cn(
                    "rounded-full px-8 py-6 gap-3 text-white font-bold text-lg shadow-xl hover:shadow-2xl",
                    RESULTS_ACCENT_CTA,
                  )}
                >
                  <Play className="h-5 w-5" />
                  Continue Assessment
                </Button>
              </div>
            )}
            {/* View Detailed Report: student pending/graded cards include this next to Recalculate when retake applies. */}
            {/* Instructor/admin: recalculate row. Student: actions live inside pending or graded cards only. */}
            {results?.quiz_id &&
              (isAdminView ? userType === "instructor" : true) &&
              !(!isAdminView && hasAnyFlagOrError) &&
              !(!isAdminView && !hasAnyFlagOrError) && (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  onClick={handleRecalculateScore}
                  disabled={isRecalculating}
                  variant="outline"
                  className={cn("rounded-full px-6 gap-2 border-2 font-semibold", fr?.outline ?? "border-slate-400 dark:border-slate-500 text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/30")}
                >
                  {isRecalculating ? "Recalculating…" : "Recalculate Score"}
                </Button>
                {/* Student: Re-evaluate all questions (one-time per attempt); modal offers failed vs all */}
                {!isAdminView &&
                  userType === "student" &&
                  !(results as any)?.student_bulk_re_evaluate_used_at &&
                  !results?.questions?.some((q) => q.override_points != null) && (
                  <Button
                    onClick={() => runStudentBulkReevaluate("all")}
                    disabled={isReEvaluatingAll}
                    variant="outline"
                    className="rounded-full px-6 gap-2 border-2 border-amber-400 dark:border-amber-500 text-amber-800 dark:text-amber-200 hover:bg-amber-50/80 dark:hover:bg-amber-900/30 font-semibold"
                  >
                    {isReEvaluatingAll ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Re-evaluating…
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        Re-evaluate all
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            <div className="mt-8 w-full max-w-3xl mx-auto space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className={fr?.infoPill ?? "flex items-center justify-center gap-2 rounded-xl border border-slate-200/60 bg-slate-50 px-4 py-3 dark:border-slate-600/60 dark:bg-slate-700/40"}>
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Student
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{results?.student_name}</span>
                </div>
                <div className={fr?.infoPill ?? "flex items-center justify-center gap-2 rounded-xl border border-slate-200/60 bg-slate-50 px-4 py-3 dark:border-slate-600/60 dark:bg-slate-700/40"}>
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    ID
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{results?.student_id}</span>
                </div>
                <div className={fr?.infoPill ?? "flex items-center justify-center gap-2 rounded-xl border border-slate-200/60 bg-slate-50 px-4 py-3 dark:border-slate-600/60 dark:bg-slate-700/40"}>
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Section
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{results?.section}</span>
                </div>
              </div>

              {results?.quiz_id && results?.completed_at && (
                <AttemptScoreHistoryPanel
                  attemptId={Number.parseInt(attemptId, 10)}
                  quizId={results.quiz_id}
                  studentId={results.student_id}
                  userType={userType}
                  embedInDashboard={embedInDashboard}
                  refreshKey={refreshTrigger}
                  className="w-full"
                />
              )}
            </div>

            {/* Anti-cheat / integrity: only when not already inside student "Grading complete" card */}
            {results && hasIntegritySignals(results) && (isAdminView || hasAnyFlagOrError) && (
              <div className="mt-4">
                <StudentIntegrityBehaviorRecord results={results} variant="standalone" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bulk Re-evaluation Panel for Instructors/Admins - prominent at top of student report */}
        {(userType === "instructor" || userType === "admin") && results && results.questions && results.questions.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2 mb-3">
            <CircuitWorkspaceExportAttemptButton
              attemptId={attemptId}
              questions={results.questions}
              onExported={() => setRefreshTrigger((t) => t + 1)}
            />
          </div>
        )}
        {(userType === "instructor" || userType === "admin") && results && results.questions && results.questions.length > 0 && (
          <BulkReEvaluatePanel
            attemptId={attemptId}
            questions={results.questions}
            portalTheme={fr}
            onReEvaluated={() => {
              setRefreshTrigger((t) => t + 1)
              window.dispatchEvent(new CustomEvent("instructor-re-evaluate-complete"))
            }}
            onQuestionEvaluated={(detail, questionIndex) => {
              setResults((prev) => {
                if (!prev?.questions) return prev
                const next = { ...prev }
                next.questions = prev.questions.map((q: any) => {
                  const aid = q.answer_id ?? q.id
                  if (aid !== detail.answerId) return q
                  return {
                    ...q,
                    points_earned: detail.newPoints,
                    ai_feedback: detail.aiFeedback ?? q.ai_feedback,
                    is_correct: detail.isCorrect ?? q.is_correct
                  }
                })
                const totalPts = prev.total_points ?? prev.total_questions ?? 1
                const sectionConfig = parseAssessmentSectionConfig(prev.section_config)
                const assessmentTypeResolved =
                  ((prev as { assessment_type?: string }).assessment_type as string | undefined) ||
                  assessmentType ||
                  "quiz"
                const useSectionWeighting = assessmentUsesSectionWeightedGrade(
                  assessmentTypeResolved,
                  sectionConfig,
                )

                if (useSectionWeighting && sectionConfig?.length) {
                  const answeredQuestionIds = new Set(
                    next.questions
                      .filter((q: any) => q.points_earned != null || q.override_points != null || q.selected_answer)
                      .map((q: any) => Number(q.id ?? q.question_id))
                      .filter((id: number) => Number.isFinite(id)),
                  )
                  const perQuestion = next.questions.map((q: any) => ({
                    max_points: Number(q.max_points ?? q.points ?? 1),
                    effective_points: capQuestionPoints(q.override_points, q.points_earned, q.max_points ?? q.points),
                    answered:
                      q.has_answer === true ||
                      answeredQuestionIds.has(Number(q.id ?? q.question_id)),
                  }))
                  const weighted = computeSectionWeightedScore(
                    next.questions.map((q: any) => ({
                      question_type: q.question_type,
                      id: Number(q.id ?? q.question_id),
                    })),
                    perQuestion,
                    sectionConfig,
                    { answeredQuestionIds },
                  )
                  next.score = weighted
                  next.percentage = weighted
                  next.total_points = 100
                } else if (detail.score != null && Number.isFinite(Number(detail.score)) && totalPts === 100) {
                  const pct = Math.min(100, Math.max(0, Number(detail.score)))
                  next.score = pct
                  next.percentage = pct
                } else {
                  const totalScore = next.questions.reduce(
                    (sum: number, q: any) => sum + (Number(q.points_earned) || 0),
                    0,
                  )
                  next.score = totalScore
                  next.percentage = totalPts > 0 ? (totalScore / totalPts) * 100 : 0
                }
                return next
              })
            }}
          />
        )}

        {/* Instructor/admin: backup vs primary storage (internal debugging) */}
        {isAdminView && backupData && (
          <Card className="border border-blue-200/60 dark:border-blue-700/60 bg-blue-50/80 dark:bg-blue-900/30 rounded-2xl shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_25px_rgba(0,0,0,0.4)]">
            <CardHeader className="p-6">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-200 flex items-center gap-3">
                  <div className="p-2 bg-blue-100/80 dark:bg-blue-800/80 rounded-xl">
                    <List className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                  </div>
                  Summary of Student Recorded Answers
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBackupSummary(!showBackupSummary)}
                  className="text-blue-700 dark:text-blue-400"
                >
                  {showBackupSummary ? "Hide Details" : "Show Details"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="p-4 bg-white/60 dark:bg-slate-800/60 rounded-xl border border-blue-200/60 dark:border-blue-700/60">
                  <div className="text-sm text-slate-700 dark:text-slate-200">Total Recorded</div>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                    {backupData.summary?.totalBackupRecords || 0}
                  </div>
                </div>
                <div className="p-4 bg-white/60 dark:bg-slate-800/60 rounded-xl border border-emerald-200/60 dark:border-emerald-700/60">
                  <div className="text-sm text-slate-700 dark:text-slate-200">Successfully Saved</div>
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                    {backupData.summary?.successfullySaved || 0}
                  </div>
                </div>
                <div className="p-4 bg-white/60 dark:bg-slate-800/60 rounded-xl border border-amber-200/60 dark:border-amber-700/60">
                  <div className="text-sm text-slate-700 dark:text-slate-200">Primary Storage</div>
                  <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                    {backupData.summary?.totalPrimaryRecords || 0}
                  </div>
                </div>
                <div className={`p-4 bg-white/60 dark:bg-slate-800/60 rounded-xl border ${
                  (backupData.summary?.missingInPrimary || 0) > 0
                    ? "border-red-200/60 dark:border-red-700/60"
                    : "border-slate-200/60 dark:border-slate-600"
                }`}>
                  <div className="text-sm text-slate-700 dark:text-slate-200">Missing in Primary</div>
                  <div className={`text-2xl font-bold ${
                    (backupData.summary?.missingInPrimary || 0) > 0
                      ? "text-red-700 dark:text-red-400"
                      : "text-slate-800 dark:text-slate-200"
                  }`}>
                    {backupData.summary?.missingInPrimary || 0}
                  </div>
                </div>
              </div>

              {showBackupSummary && backupData.comparison && backupData.comparison.length > 0 && (
                <div className="mt-6 space-y-3 max-h-96 overflow-y-auto">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Answer Recording Details:</h4>
                  {backupData.comparison.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border ${
                        item.match && item.backup.primaryStorageSuccess
                          ? "bg-emerald-50/60 dark:bg-emerald-900/20 border-emerald-200/60 dark:border-emerald-700/60"
                          : !item.backup.primaryStorageSuccess
                          ? "bg-red-50/60 dark:bg-red-900/20 border-red-200/60 dark:border-red-700/60"
                          : "bg-amber-50/60 dark:bg-amber-900/20 border-amber-200/60 dark:border-amber-700/60"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                            Question {item.questionOrder || idx + 1}
                          </div>
                          <div className="text-sm text-slate-700 dark:text-slate-200 mb-2">
                            {item.questionText?.substring(0, 100)}...
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <Badge variant="outline" className={
                              item.backup.primaryStorageSuccess
                                ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400"
                                : "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400"
                            }>
                              {item.backup.primaryStorageSuccess ? "✓ Saved" : "✗ Not Saved"}
                            </Badge>
                            <Badge variant="outline" className={
                              item.match ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400" : "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400"
                            }>
                              {item.match ? "✓ Match" : "⚠ Mismatch"}
                            </Badge>
                            <Badge variant="outline" className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                              Format: {item.backup.answerFormat}
                            </Badge>
                            <Badge variant="outline" className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                              Method: {item.backup.submissionMethod}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Student: actionable snapshot (replaces backup / storage summary) */}
        {!isAdminView &&
          results &&
          (() => {
            const insights = buildStudentReportInsights(results)
            if (!insights) return null
            const pendingReview = (results.questions || []).filter((q: any) => isPendingManualReview(q)).length
            let tip = hasAnyFlagOrError
              ? "Some responses are still being graded or reviewed — the snapshot below will update when scoring is complete."
              : insights.accuracyPct >= 85
                ? "Strong work — keep the habits that got you here."
                : insights.accuracyPct >= 70
                  ? "Solid foundation — a focused pass on your growth areas will compound."
                  : "Use the breakdown below to steer your next study session."
            if (hasAnyFlagOrError && pendingReview > 0) {
              tip = `${tip} ${pendingReview} question${pendingReview === 1 ? "" : "s"} still in manual review.`
            }

            const showShined = !hasAnyFlagOrError && insights.strongest.length > 0
            const showGrow = !hasAnyFlagOrError && insights.growth.length > 0
            const acc = resultsKpiAccent(0, resultsSwatch, isResultsDark)
            const pts = resultsKpiAccent(1, resultsSwatch, isResultsDark)
            const tim = resultsKpiAccent(2, resultsSwatch, isResultsDark)

            const metricTile = (
              label: string,
              value: string,
              hint: string,
              icon: ReactNode,
              accent: ReturnType<typeof resultsKpiAccent>,
              barPct?: number | null,
            ) => (
              <div
                key={label}
                className={cn(
                  "group relative flex min-h-[132px] min-w-0 flex-col overflow-hidden p-3.5 sm:min-h-[148px] sm:p-4",
                  resultsPanelClass(isResultsDark, true),
                )}
                style={isResultsDark ? resultsDarkElevatedStyle() : undefined}
              >
                {!isResultsDark ? <div aria-hidden className={RESULTS_JEANS_HOVER_WASH} /> : null}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full opacity-25 blur-2xl"
                  style={{ backgroundColor: accent.fill }}
                />
                <div
                  className={cn(
                    "relative z-10 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide sm:text-xs",
                    accent.labelClass,
                  )}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl shadow-sm sm:h-8 sm:w-8"
                    style={{ backgroundColor: accent.fill, color: accent.ink }}
                  >
                    {icon}
                  </span>
                  <span className="line-clamp-1">{label}</span>
                </div>
                <div className="relative z-10 mt-3 flex flex-1 flex-col justify-center">
                  <p className="break-words text-xl font-bold tabular-nums leading-none text-gray-900 dark:text-slate-50 sm:text-2xl">
                    {value}
                  </p>
                  {barPct != null && Number.isFinite(barPct) ? (
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-200/80 dark:bg-white/10">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(0, Math.min(100, barPct))}%`,
                          backgroundColor: accent.fill,
                        }}
                      />
                    </div>
                  ) : null}
                </div>
                <p className="relative z-10 mt-auto pt-2 text-[10px] leading-snug text-gray-700 dark:text-slate-300 sm:text-xs">
                  {hint}
                </p>
              </div>
            )

            return (
              <Card
                className={cn(
                  "overflow-hidden rounded-2xl",
                  isResultsDark
                    ? "border border-[var(--cc-accent)]/25"
                    : "border border-gray-200 bg-white shadow-md",
                )}
                style={
                  isResultsDark
                    ? {
                        ...resultsDarkElevatedStyle(),
                        backgroundImage:
                          "radial-gradient(ellipse at 0% 0%, color-mix(in srgb, var(--cc-accent) 18%, transparent), transparent 50%)",
                      }
                    : undefined
                }
              >
                <CardHeader className="p-4 pb-2 sm:p-6">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-lg font-bold tracking-tight text-gray-800 dark:text-slate-100 sm:gap-3 sm:text-xl">
                    <div
                      className="shrink-0 rounded-xl p-2"
                      style={{ backgroundColor: resultsSwatch[2], color: "#fff" }}
                    >
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <span className="min-w-0">Your performance snapshot</span>
                  </CardTitle>
                  <p className="mt-2 text-xs leading-relaxed text-gray-700 dark:text-slate-300 sm:pl-[3.25rem] sm:text-sm">
                    {tip}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4 p-4 pt-2 sm:space-y-5 sm:p-6">
                  <div className="grid w-full min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
                    {metricTile(
                      "Accuracy",
                      hasAnyFlagOrError ? "—" : `${Math.round(insights.accuracyPct)}%`,
                      `${insights.correctCount} / ${insights.questionCount} full credit`,
                      <Target className="h-3.5 w-3.5" />,
                      acc,
                      hasAnyFlagOrError ? null : insights.accuracyPct,
                    )}
                    {metricTile(
                      "Points",
                      hasAnyFlagOrError
                        ? "Pending"
                        : `${insights.pointsEarned.toFixed(2)} / ${insights.pointsPossible.toFixed(2)}`,
                      "Earned ÷ total (this attempt)",
                      <Trophy className="h-3.5 w-3.5" />,
                      pts,
                      hasAnyFlagOrError || insights.pointsPossible <= 0
                        ? null
                        : (insights.pointsEarned / insights.pointsPossible) * 100,
                    )}
                    {metricTile(
                      "Time",
                      insights.timeMinutes != null ? `~${insights.timeMinutes} min` : "—",
                      insights.timeDetail,
                      <Clock className="h-3.5 w-3.5" />,
                      tim,
                      null,
                    )}
                  </div>

                  {(showShined || showGrow) && (
                    <div
                      className={cn(
                        "grid gap-3",
                        showShined && showGrow ? "md:grid-cols-2" : "grid-cols-1",
                      )}
                    >
                      {showShined && (
                        <div className="relative overflow-hidden rounded-2xl bg-emerald-50/90 p-4 dark:bg-emerald-950/35 sm:p-5">
                          <div
                            aria-hidden
                            className="pointer-events-none absolute -bottom-10 -right-8 h-36 w-36 rounded-full bg-emerald-400/25 blur-3xl dark:bg-emerald-400/15"
                          />
                          <div className="relative z-10 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800 dark:text-emerald-200 sm:text-xs">
                                Where you shined
                              </p>
                              <p className="mt-1 text-xs text-emerald-900/70 dark:text-emerald-100/70">
                                Strongest question types this attempt
                              </p>
                            </div>
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
                              <TrendingUp className="h-5 w-5" />
                            </span>
                          </div>
                          <div className="relative z-10 mt-4 flex flex-wrap gap-2">
                            {insights.strongest.map((s) => (
                              <span
                                key={s.label}
                                title={s.label}
                                className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-emerald-900 shadow-sm ring-1 ring-emerald-200/80 dark:bg-emerald-900/55 dark:text-emerald-50 dark:ring-emerald-700/50"
                              >
                                <span className="truncate">{s.label}</span>
                                <span className="tabular-nums text-emerald-700 dark:text-emerald-300">
                                  {s.pct.toFixed(0)}%
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {showGrow && (
                        <div className="relative overflow-hidden rounded-2xl bg-orange-50/90 p-4 dark:bg-orange-950/30 sm:p-5">
                          <div
                            aria-hidden
                            className="pointer-events-none absolute -bottom-10 -left-8 h-36 w-36 rounded-full bg-orange-400/25 blur-3xl dark:bg-orange-400/15"
                          />
                          <div className="relative z-10 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-900 dark:text-orange-200 sm:text-xs">
                                Room to grow
                              </p>
                              <p className="mt-1 text-xs text-orange-950/70 dark:text-orange-100/70">
                                Review these types first
                              </p>
                            </div>
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-md shadow-orange-500/30">
                              <Target className="h-5 w-5" />
                            </span>
                          </div>
                          <ul className="relative z-10 mt-4 space-y-3">
                            {insights.growth.map((g) => (
                              <li key={g.label} className="min-w-0">
                                <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
                                  <span
                                    className="min-w-0 truncate font-medium text-gray-800 dark:text-slate-100"
                                    title={g.label}
                                  >
                                    {g.label}
                                  </span>
                                  <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-orange-800 dark:text-orange-300">
                                    {g.pct.toFixed(0)}%
                                  </span>
                                </div>
                                <div className="h-2 overflow-hidden rounded-full bg-orange-200/70 dark:bg-orange-950/60">
                                  <div
                                    className="h-full rounded-full bg-amber-500"
                                    style={{ width: `${Math.max(4, Math.min(100, g.pct))}%` }}
                                  />
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })()}

        {!isAdminView && (
          <div
            className={cn(
              "grid min-w-0 grid-cols-1 gap-6",
              shouldShowRetakeButton &&
                !results?.can_continue &&
                !retakeStatus?.hasRetakeAccess
                ? "md:grid-cols-2"
                : "md:grid-cols-3",
            )}
          >
            <Button
              onClick={() => {
                if (studentResultsReviewLocked) {
                  toast("Detailed review is locked", {
                    description:
                      "Your instructor will release question review when everyone has finished. Your score is shown above.",
                    duration: 6000,
                  })
                  return
                }
                if (shouldLockReviewButtons) {
                  setPendingReportAction("all")
                  setShowViewReportDialog(true)
                  return
                }
                  setShowAllQuestions(!showAllQuestions)
                  setShowIncorrectOnly(false)
                setSelectedSection(null)
              }}
              variant="outline"
              className="rounded-full px-6 gap-2 w-full bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-600 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 shadow-lg"
            >
              {shouldLockReviewButtons || studentResultsReviewLocked ? (
                <Lock className="h-4 w-4" />
              ) : (
                <List className="h-4 w-4" />
              )}
              {showAllQuestions ? "Hide Questions" : "Review All Questions"}
            </Button>
            <Button
              onClick={() => {
                if (studentResultsReviewLocked) {
                  toast("Detailed review is locked", {
                    description:
                      "Your instructor will release question review when everyone has finished. Your score is shown above.",
                    duration: 6000,
                  })
                  return
                }
                if (shouldLockReviewButtons) {
                  setPendingReportAction("incorrect")
                  setShowViewReportDialog(true)
                  return
                }
                  setShowIncorrectOnly(!showIncorrectOnly)
                  setShowAllQuestions(false)
                setSelectedSection(null)
              }}
              variant="outline"
              className="rounded-full px-6 gap-2 w-full bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-600 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 shadow-lg"
            >
              {shouldLockReviewButtons || studentResultsReviewLocked ? (
                <Lock className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              Review Incorrect
            </Button>
            {results?.can_continue && (
              <Button
                onClick={handleContinueQuiz}
                className={cn(
                  "rounded-full px-6 gap-2 w-full font-semibold",
                  RESULTS_ACCENT_CTA,
                )}
              >
                <Play className="h-4 w-4" />
                Continue Assessment
              </Button>
            )}
            {shouldShowRetakeButton && !results?.can_continue && (
              <div
                className={cn(
                  "min-w-0",
                  !retakeStatus?.hasRetakeAccess && "md:col-span-2",
                )}
              >
                <Button
                  onClick={handleRetakeQuiz}
                  disabled={hasViewedReport}
                  className={cn(
                  "h-auto min-h-10 w-full min-w-0 gap-2 whitespace-normal rounded-2xl px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-full sm:px-6 sm:py-2",
                  RESULTS_ACCENT_CTA,
                )}
                >
                  <span className="flex w-full min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1.5">
                    <span className="inline-flex shrink-0 items-center gap-2">
                      <RefreshCw className="h-4 w-4 shrink-0" />
                      {retakeStatus?.hasRetakeAccess ? "Retake Quiz" : "Upgrade to Retake"}
                    </span>
                    {retakeStatus?.attemptsRemaining !== null &&
                      retakeStatus?.canRetake &&
                      retakeStatus?.hasRetakeAccess && (
                        <Badge className="shrink-0 bg-white/20">
                          {retakeStatus.attemptsRemaining} left
                        </Badge>
                      )}
                    {!retakeStatus?.hasRetakeAccess && (
                      <Badge className="shrink-0 bg-white/20 text-xs">Requires Upgrade</Badge>
                    )}
                  </span>
                </Button>
              </div>
            )}
          </div>
        )}

        {shouldLockReviewButtons && (
          <Card className="border border-amber-200/60 dark:border-amber-700/60 bg-amber-50/80 dark:bg-amber-900/30 rounded-2xl shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_25px_rgba(0,0,0,0.4)]">
            <CardContent className="py-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-amber-100/80 dark:bg-amber-800/80 rounded-xl">
                  <Lock className="h-5 w-5 text-amber-700 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-amber-900 dark:text-amber-200">Review Locked</p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    You have {retakeStatus?.attemptsRemaining} retake{retakeStatus?.attemptsRemaining !== 1 ? "s" : ""}{" "}
                    available. Viewing any section or the full report will forfeit your retake. Click &quot;View Detailed
                    Report&quot; above, a section card, or &quot;Review All Questions&quot; to proceed.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {studentResultsReviewLocked && (
          <Card className="border border-slate-200/70 dark:border-slate-600/70 bg-slate-50/90 dark:bg-slate-900/50 rounded-2xl shadow-[0_8px_25px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_25px_rgba(0,0,0,0.35)]">
            <CardContent className="py-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-slate-200/80 dark:bg-slate-800/80 rounded-xl shrink-0">
                  <Lock className="h-5 w-5 text-slate-700 dark:text-slate-300" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">Detailed results temporarily unavailable</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                    Your instructor has locked per-question review and the results PDF until everyone has completed this
                    assessment. You can still see your score above. Check back later or ask your instructor when review will
                    open.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {questionsToShow.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
            <h3 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-200">Question Review</h3>
              {selectedSection && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedSection(null)
                    setHighlightedSection(null)
                  }}
                  className="rounded-full gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back to Summary
                </Button>
              )}
            </div>
            {/* Question Navigator - instructor/admin and student. Shows score per question for quick jump to 0% for re-evaluation. */}
            {results?.questions && results.questions.length > 0 && (
              <div className={fr?.neutralPanel ?? "flex flex-wrap items-center gap-2 p-4 rounded-xl border border-slate-200/60 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50"}>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-2">Jump to:</span>
                {questionsToShow.map((question, index) => {
                  const fullList = results?.questions || []
                  const originalIndex = fullList.findIndex((q: any) => (q.question_id ?? q.id) === (question.question_id ?? question.id))
                  const questionNumber = originalIndex >= 0 ? originalIndex + 1 : index + 1
                  const hasOverride = (userType === "instructor" || userType === "admin") && question.override_points != null
                  const isCorrect = question.is_correct === true
                  const circuitProvisional = isCircuitSubmissionProvisional(question)
                  const circuitPreviewPts = circuitProvisional ? resolveCircuitSubmissionProvisionalScore(question) : null
                  const effectivePoints = question.override_points != null
                    ? Number(question.override_points)
                    : circuitPreviewPts != null
                      ? circuitPreviewPts
                      : Number(question.points_earned ?? 0)
                  const maxPoints = Number(question.max_points ?? question.points ?? 1)
                  const scorePct = maxPoints > 0 ? Math.round((effectivePoints / maxPoints) * 100) : 0
                  const isZeroScore = scorePct === 0 && !circuitProvisional
                  const isPending = isPendingManualReview(question)
                  const navScoreLabel = isPending
                    ? "PND"
                    : circuitProvisional
                      ? `~${scorePct}%`
                      : `${scorePct}%`
                  return (
                    <button
                      key={question.question_id ?? question.id ?? index}
                      type="button"
                      onClick={() => {
                        const el = document.getElementById(`question-${questionNumber}`)
                        el?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }}
                      className={`flex flex-col items-center justify-center min-w-[2.75rem] h-9 px-2 rounded-lg text-sm font-medium transition-all hover:scale-105 ${
                        hasOverride
                          ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300/60 dark:border-amber-600 hover:bg-amber-200 dark:hover:bg-amber-800/50"
                          : isZeroScore || isPending
                            ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-300/60 dark:border-red-600 hover:bg-red-200 dark:hover:bg-red-800/50"
                            : userType === "student"
                              ? isCorrect
                                ? "bg-[var(--cc-accent)] text-white border border-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)]"
                                : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300/60 dark:border-amber-600 hover:bg-amber-200 dark:hover:bg-amber-800/50"
                              : "bg-white dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600/80"
                      }`}
                      title={hasOverride ? `Question ${questionNumber} (Instructor Adjusted) · ${scorePct}%` : (isPending ? `Question ${questionNumber} · Pending review` : circuitProvisional ? `Question ${questionNumber} · Provisional ~${scorePct}%` : (isZeroScore ? `Question ${questionNumber} · 0% — Re-evaluate` : `Question ${questionNumber} · ${scorePct}%`))}
                    >
                      <span className="leading-tight">{questionNumber}</span>
                      <span className="text-[10px] leading-tight opacity-90">{navScoreLabel}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {questionsToShow.map((question, index) => {
              const prevQuestion = index > 0 ? questionsToShow[index - 1] : null
              const showSectionHeader = question.section_title && question.section_title !== (prevQuestion as any)?.section_title
              const fullList = results?.questions || []
              const originalIndex = fullList.findIndex((q: any) => (q.question_id ?? q.id) === (question.question_id ?? question.id))
              const questionNumber = originalIndex >= 0 ? originalIndex + 1 : index + 1
              return (
              <div key={question.question_id ?? question.id ?? index} className="space-y-4">
                {showSectionHeader && (
                  <div
                    id={question.section_title ? `section-${question.section_title.replace(/\s+/g, "-").toLowerCase()}` : undefined}
                    className={
                      fr
                        ? fr.sectionHeader(highlightedSection === question.section_title)
                        : cn(
                            "flex items-center gap-2 scroll-mt-24 rounded-xl px-4 py-2 transition-all duration-300",
                            highlightedSection === question.section_title
                              ? RESULTS_ACCENT_SECTION_HEADER_ACTIVE
                              : RESULTS_ACCENT_SECTION_HEADER,
                          )
                    }
                  >
                    <span className={fr?.sectionHeaderText ?? RESULTS_ACCENT_SECTION_TEXT}>
                      {question.section_title}
                      {question.section_weight_percent != null && (
                        <span className={fr?.sectionHeaderMeta ?? RESULTS_ACCENT_SECTION_META}>
                          ({question.section_weight_percent}%)
                        </span>
                      )}
                    </span>
                  </div>
                )}
              <Card id={`question-${questionNumber}`} className={cn(
                fr ? fr.questionCard : "border shadow-[0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)] rounded-2xl backdrop-blur-sm",
                "transition-all duration-300",
                question.override_points != null
                  ? fr
                    ? cn("ring-1 ring-amber-500/35", fr.fp.softBg)
                    : "border-amber-400 dark:border-amber-500 bg-amber-50/40 dark:bg-amber-900/20 ring-1 ring-amber-200/60 dark:ring-amber-700/40"
                  : highlightedSection && question.section_title === highlightedSection
                    ? fr?.questionHighlight ?? RESULTS_ACCENT_QUESTION_HIGHLIGHT
                    : fr ? "" : "border-slate-200/60 dark:border-white/15 bg-white dark:bg-slate-800",
              )}>
                <CardHeader className="pb-4 p-6">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                    <CardTitle className="text-lg font-semibold tracking-tight text-slate-800 dark:text-slate-200">
                      Question {questionNumber}
                      </CardTitle>
                      {(() => {
                        // Check if manually evaluated or re-evaluated (priority check)
                        const isManuallyEvaluated = question.reviewed_by || question.override_points !== null || question.reviewed_at
                        
                        if (isManuallyEvaluated) {
                          const hasOverride = question.override_points != null
                          return (
                            <Badge className={cn("rounded-full", hasOverride ? "bg-amber-100/80 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300/60 dark:border-amber-700/60" : fr?.manualBadge ?? RESULTS_ACCENT_SOFT_PILL)}>
                              {hasOverride ? <Pencil className="h-3 w-3 mr-1" /> : (
                                <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              )}
                              {hasOverride ? "Instructor Adjusted" : "Manually Evaluated"}
                            </Badge>
                          )
                        }
                        
                        // Pending manual review (e.g. slow connection / eval timeout) — show PND%, not INCORRECT
                        if (isPendingManualReview(question)) {
                          return (
                            <Badge className="bg-amber-100/80 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300/60 dark:border-amber-700/60 rounded-full">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Pending Review
                            </Badge>
                          )
                        }

                        if (isCircuitSubmissionProvisional(question)) {
                          return (
                            <Badge className="bg-amber-100/80 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300/60 dark:border-amber-700/60 rounded-full">
                              <Clock className="h-3 w-3 mr-1" />
                              Provisional — instructor review
                            </Badge>
                          )
                        }
                        
                        // Check if this is an AI-graded question
                        const isAiGraded = ['code_write', 'code_problem', 'debug_code', 'code_explain', 'code_debug', 'code_write_plot'].includes(
                          question.question_type?.toLowerCase()
                        )
                        
                        // For AI-graded questions, calculate percentage from effective points (override ?? points_earned)
                        if (isAiGraded) {
                          const pointsEarned = question.override_points != null
                            ? question.override_points
                            : (question.points_earned !== undefined && question.points_earned !== null ? question.points_earned : 0)
                          const maxPoints = question.max_points || question.points || 1
                          const scorePercentage = Math.round((pointsEarned / maxPoints) * 100)
                          
                          let bgClass, textClass, borderClass, icon, label
                          
                          // Priority 1: Use AI status if available
                          if (question.ai_feedback?.status) {
                            const status = question.ai_feedback.status
                            if (status === "Expert") {
                              bgClass = "bg-yellow-100/80 dark:bg-yellow-900/30"
                              textClass = "text-yellow-700 dark:text-yellow-400"
                              borderClass = "border-yellow-300/60 dark:border-yellow-700/60"
                              icon = <Trophy className="h-3 w-3 mr-1" />
                              label = status
                            } else if (status === "Very Good") {
                              bgClass = "bg-green-100/80 dark:bg-green-900/30"
                              textClass = "text-green-700 dark:text-green-400"
                              borderClass = "border-green-300/60 dark:border-green-700/60"
                              icon = <CheckCircle2 className="h-3 w-3 mr-1" />
                              label = status
                            } else if (status === "Keep Practicing") {
                              bgClass = "bg-blue-100/80 dark:bg-blue-900/30"
                              textClass = "text-blue-700 dark:text-blue-400"
                              borderClass = "border-blue-300/60 dark:border-blue-700/60"
                              icon = <AlertCircle className="h-3 w-3 mr-1" />
                              label = status
                            } else if (status === "Getting Started" || status === "Just Beginning") {
                              bgClass = "bg-orange-100/80 dark:bg-orange-900/30"
                              textClass = "text-orange-700 dark:text-orange-400"
                              borderClass = "border-orange-300/60 dark:border-orange-700/60"
                              icon = <AlertCircle className="h-3 w-3 mr-1" />
                              label = status
                            } else {
                              bgClass = "bg-[var(--cc-accent-soft)]"
                              textClass = "text-[var(--cc-accent-dark)] dark:text-[var(--cc-accent)]"
                              borderClass = "border-[var(--cc-accent-border)]"
                              icon = <AlertCircle className="h-3 w-3 mr-1" />
                              label = status
                            }
                          }
                          // Priority 2: Use descriptive labels based on percentage (NO percentage shown)
                          else {
                            if (scorePercentage >= 90) {
                              bgClass = "bg-yellow-100/80 dark:bg-yellow-900/30"
                              textClass = "text-yellow-700 dark:text-yellow-400"
                              borderClass = "border-yellow-300/60 dark:border-yellow-700/60"
                              icon = <Trophy className="h-3 w-3 mr-1" />
                              label = "Expert"
                            } else if (scorePercentage >= 70) {
                              bgClass = "bg-green-100/80 dark:bg-green-900/30"
                              textClass = "text-green-700 dark:text-green-400"
                              borderClass = "border-green-300/60 dark:border-green-700/60"
                              icon = <CheckCircle2 className="h-3 w-3 mr-1" />
                              label = "Very Good"
                            } else if (scorePercentage >= 50) {
                              bgClass = "bg-blue-100/80 dark:bg-blue-900/30"
                              textClass = "text-blue-700 dark:text-blue-400"
                              borderClass = "border-blue-300/60 dark:border-blue-700/60"
                              icon = <AlertCircle className="h-3 w-3 mr-1" />
                              label = "Keep Practicing"
                            } else if (scorePercentage > 0) {
                              bgClass = "bg-orange-100/80 dark:bg-orange-900/30"
                              textClass = "text-orange-700 dark:text-orange-400"
                              borderClass = "border-orange-300/60 dark:border-orange-700/60"
                              icon = <AlertCircle className="h-3 w-3 mr-1" />
                              label = "Getting Started"
                            } else {
                              bgClass = "bg-red-100/80 dark:bg-red-900/30"
                              textClass = "text-red-700 dark:text-red-400"
                              borderClass = "border-red-300/60 dark:border-red-700/60"
                              icon = <XCircle className="h-3 w-3 mr-1" />
                              label = "Needs Work"
                            }
                          }
                          
                          return (
                            <Badge className={`${bgClass} ${textClass} ${borderClass} rounded-full`}>
                              {icon}
                              {label}
                            </Badge>
                          )
                        }
                        
                        // For non-AI questions, use binary CORRECT/INCORRECT
                        return question.is_correct ? (
                          <Badge className="bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300/60 dark:border-emerald-700/60 rounded-full">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            CORRECT
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100/80 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-300/60 dark:border-red-700/60 rounded-full">
                            <XCircle className="h-3 w-3 mr-1" />
                            INCORRECT
                          </Badge>
                        )
                      })()}
                  </div>
                    {/* Points Badge - use effective points (override_points when instructor adjusted, else points_earned) */}
                    {(() => {
                      const effectivePoints = question.override_points != null
                        ? question.override_points
                        : (question.points_earned !== undefined && question.points_earned !== null ? question.points_earned : (question.is_correct ? 1 : 0))
                      const provisionalScore = resolveCircuitSubmissionProvisionalScore(question)
                      const showProvisional = provisionalScore != null
                      return (
                    <div className={fr?.ptsBadge ?? RESULTS_ACCENT_PTS_BADGE}>
                      <Trophy className={cn("h-4 w-4", fr?.ptsIcon ?? RESULTS_ACCENT_PTS_ICON)} />
                      <span className={fr?.ptsText ?? RESULTS_ACCENT_PTS_TEXT}>
                        {showProvisional
                          ? provisionalScore
                          : isPendingManualReview(question)
                            ? "PND%"
                            : Math.round(effectivePoints * 10) / 10}
                        <span className="text-xs font-normal opacity-70 ml-0.5">
                          /{question.max_points || question.points || 1}
                        </span>
                      </span>
                      <span className={fr?.ptsSub ?? RESULTS_ACCENT_PTS_SUB}>
                        {showProvisional
                          ? "provisional"
                          : isPendingManualReview(question)
                            ? "pending review"
                            : "pts"}
                      </span>
                      {showProvisional ? (
                        <ClassroomProvisionalScoreBadge compact className="ml-0.5" />
                      ) : null}
                    </div>
                      )
                    })()}
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-200 mt-3">
                    <QuestionTextRenderer text={question.question_text} />
                  </div>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <p className="text-xs text-slate-600 dark:text-slate-300">Type: {question.question_type}</p>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Time: {question.time_spent_seconds != null && question.time_spent_seconds >= 0
                        ? question.time_spent_seconds >= 60
                          ? `${Math.floor(question.time_spent_seconds / 60)}m ${question.time_spent_seconds % 60}s`
                          : `${question.time_spent_seconds}s`
                        : "—"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-6">
                  {question.question_type?.toLowerCase() !== "multi_part" &&
                  question.question_type?.toLowerCase() !== "circuit_submission" &&
                  hasActiveQuestionMedia(
                    resolveQuestionMedia({
                      question_media: (question as { question_media?: unknown }).question_media,
                      circuit_spec: (question as { circuit_spec?: unknown }).circuit_spec,
                    }),
                  ) ? (
                    <QuestionMediaDisplay
                      question={{
                        question_media: (question as { question_media?: unknown }).question_media,
                        circuit_spec: (question as { circuit_spec?: unknown }).circuit_spec,
                      }}
                      size="medium"
                    />
                  ) : null}

                  {question.question_type?.toLowerCase() === "multi_part" ? (
                    <MultiPartResultsDisplay
                      question={{
                        question_text: question.question_text,
                        question_media: (question as { question_media?: unknown }).question_media,
                        circuit_spec: (question as { circuit_spec?: unknown }).circuit_spec,
                        subquestions: (question as { subquestions?: unknown }).subquestions,
                        selected_answer: question.selected_answer,
                        answer_data: (question as { answer_data?: unknown }).answer_data,
                      }}
                    />
                  ) : null}

                  {question.question_type?.toLowerCase() === "circuit_submission" ? (
                    <>
                      {userType === "student" && isCircuitSubmissionProvisional(question) ? (
                        <CircuitProvisionalStudentNotice
                          previewScore={resolveCircuitSubmissionProvisionalScore(question)}
                          maxPoints={Number(question.max_points ?? question.points ?? 10)}
                        />
                      ) : null}
                      <CircuitSubmissionResultsDisplay
                        question={{
                          question_type: question.question_type,
                          question_text: question.question_text,
                          question_media: (question as { question_media?: unknown }).question_media,
                          hint: (question as { hint?: string | null }).hint,
                          solution_upload_config: (question as { solution_upload_config?: unknown })
                            .solution_upload_config,
                          selected_answer: question.selected_answer,
                          answer_data: (question as { answer_data?: unknown }).answer_data,
                          requires_review: question.requires_review,
                          override_points: question.override_points,
                          reviewed_at: (question as { reviewed_at?: string | null }).reviewed_at,
                          ai_feedback: question.ai_feedback,
                          max_points: question.max_points,
                          points: question.points,
                        }}
                        userType={userType}
                      />
                    </>
                  ) : null}

                  {/* Handle MCQ/True-False questions with options */}
                  {question.question_type?.toLowerCase() !== "multi_part" &&
                  question.question_type?.toLowerCase() !== "circuit_submission" &&
                  ["option_a", "option_b", "option_c", "option_d", "option_e"].map((optionKey) => {
                    const optionValue = question[optionKey as keyof QuestionResult]
                    if (!optionValue) return null

                    const optionLetter = optionKey.split("_")[1].toUpperCase()
                    const optionText = String(optionValue || "").trim()
                    
                    // Normalize correct_answer and selected_answer for comparison
                    const correctAnswer = String(question.correct_answer || "").trim()
                    const selectedAnswer = String(question.selected_answer || "").trim()
                    
                    // Check if correct_answer is a letter (A, B, C, D, E) or text
                    const correctIsLetter = /^[A-E]$/i.test(correctAnswer)
                    const selectedIsLetter = /^[A-E]$/i.test(selectedAnswer)
                    
                    // Determine if this option is correct
                    // If correct_answer is a letter, compare with optionLetter
                    // If correct_answer is text, compare with optionText (case-insensitive)
                    let isCorrect = false
                    if (correctIsLetter) {
                      isCorrect = correctAnswer.toUpperCase() === optionLetter
                    } else {
                      isCorrect = correctAnswer.toLowerCase().trim() === optionText.toLowerCase().trim()
                    }
                    
                    // Determine if this option was selected
                    // If selected_answer is a letter, compare with optionLetter
                    // If selected_answer is text, compare with optionText (case-insensitive)
                    let isSelected = false
                    if (selectedIsLetter) {
                      isSelected = selectedAnswer.toUpperCase() === optionLetter
                    } else {
                      isSelected = selectedAnswer.toLowerCase().trim() === optionText.toLowerCase().trim()
                    }

                    return (
                      <div
                        key={optionKey}
                        className={cn(
                          "p-4 rounded-xl",
                          isCorrect
                            ? "bg-emerald-500/10 dark:bg-emerald-500/15"
                            : isSelected
                              ? "bg-red-500/10 dark:bg-red-500/15"
                              : fr?.optionNeutral ?? "rounded-2xl border bg-slate-50/80 dark:bg-slate-700/80 border-slate-200/60 dark:border-slate-600/60",
                          !fr && isCorrect && "border border-emerald-200/60 dark:border-emerald-700/60 rounded-2xl bg-emerald-50/80 dark:bg-emerald-900/30",
                          !fr && isSelected && !isCorrect && "border border-red-200/60 dark:border-red-700/60 rounded-2xl bg-red-50/80 dark:bg-red-900/30",
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{optionLetter}.</span>
                          <div className="flex-1 text-slate-900 dark:text-slate-100">
                            <QuestionTextRenderer text={optionValue as string} />
                          </div>
                          {/* Show badge based on selection and correctness */}
                          {isSelected && isCorrect && (
                            <Badge variant="outline" className="bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300/60 dark:border-emerald-700/60 rounded-full">
                              ✓ YOUR ANSWER (CORRECT)
                            </Badge>
                          )}
                          {isSelected && !isCorrect && (
                            <Badge variant="outline" className="bg-red-100/80 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-300/60 dark:border-red-700/60 rounded-full">
                              ✗ YOUR ANSWER (INCORRECT)
                            </Badge>
                          )}
                          {!isSelected && isCorrect && (
                            <Badge variant="outline" className="bg-blue-100/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-300/60 dark:border-blue-700/60 rounded-full">
                              ✓ CORRECT ANSWER
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Show student's selected answer for MCQ/True-False */}
                  {(question.question_type?.toLowerCase() === "mcq" || question.question_type?.toLowerCase() === "true_false") && (
                    <div className={cn(
                      "p-4 rounded-xl",
                      fr
                        ? question.is_correct
                          ? "bg-emerald-500/10 dark:bg-emerald-500/15"
                          : question.selected_answer || question.answer_id
                            ? "bg-red-500/10 dark:bg-red-500/15"
                            : fr.optionNeutral
                        : cn("rounded-2xl border",
                          question.is_correct
                            ? "bg-emerald-50/80 dark:bg-emerald-900/30 border-emerald-200/60 dark:border-emerald-700/60"
                            : question.selected_answer || question.answer_id
                              ? "bg-red-50/80 dark:bg-red-900/30 border-red-200/60 dark:border-red-700/60"
                              : "bg-slate-50/80 dark:bg-slate-900/30 border-slate-200/60 dark:border-slate-600",
                        ),
                    )}>
                      <div className="flex items-start gap-2">
                        <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">Your Answer:</span>
                        <div className="flex-1">
                          {question.selected_answer || question.answer_id || (question.answer_data && (typeof question.answer_data === "object" ? (question.answer_data as { answer?: unknown }).answer != null : true)) ? (
                            (() => {
                              let selectedAnswer: string
                              try {
                                const raw = question.selected_answer
                                if (raw != null && String(raw).trim() !== "") {
                                  const parsed = JSON.parse(String(raw))
                                  selectedAnswer = Array.isArray(parsed) ? parsed.join(", ") : String(parsed)
                                } else {
                                  selectedAnswer = ""
                                }
                              } catch {
                                selectedAnswer = String(question.selected_answer || "").trim()
                              }
                              if (!selectedAnswer && question.answer_data) {
                                try {
                                  const ad = typeof question.answer_data === "string" ? JSON.parse(question.answer_data) : question.answer_data
                                  if (ad && typeof ad === "object" && (ad as { answer?: unknown }).answer != null) {
                                    const a = (ad as { answer: unknown }).answer
                                    selectedAnswer = typeof a === "string" ? a : JSON.stringify(a)
                                  }
                                } catch {
                                  /* ignore */
                                }
                              }
                              if (!selectedAnswer) {
                                return (
                                  <span className="text-sm text-slate-600 dark:text-slate-300 italic">
                                    No answer selected
                                  </span>
                                )
                              }
                              
                              const isLetter = /^[A-E]$/i.test(selectedAnswer)
                              
                              let selectedLetter: string
                              let selectedOptionText: string
                              
                              if (isLetter) {
                                // Selected answer is a letter (A, B, C, D, E)
                                selectedLetter = selectedAnswer.toUpperCase()
                                const selectedOptionKey = `option_${selectedLetter.toLowerCase()}` as keyof QuestionResult
                                selectedOptionText = question[selectedOptionKey] as string || selectedAnswer
                              } else {
                                // Selected answer is text (like "True", "False")
                                // Find which option matches this text
                                const options = [
                                  { key: "option_a", letter: "A" },
                                  { key: "option_b", letter: "B" },
                                  { key: "option_c", letter: "C" },
                                  { key: "option_d", letter: "D" },
                                  { key: "option_e", letter: "E" },
                                ]
                                
                                const matchingOption = options.find(opt => {
                                  const optionText = String(question[opt.key as keyof QuestionResult] || "").trim()
                                  return optionText.toLowerCase() === selectedAnswer.toLowerCase()
                                })
                                
                                if (matchingOption) {
                                  selectedLetter = matchingOption.letter
                                  selectedOptionText = String(question[matchingOption.key as keyof QuestionResult] || selectedAnswer)
                                } else {
                                  // No matching option found, display as-is
                                  selectedLetter = ""
                                  selectedOptionText = selectedAnswer
                                }
                              }
                              
                              return (
                                <div className="flex items-center gap-2">
                                  {selectedLetter && (
                                    <Badge variant="outline" className={`text-xs ${
                                      question.is_correct 
                                        ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-600"
                                        : "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-300 dark:border-red-600"
                                    }`}>
                                      {selectedLetter}
                                    </Badge>
                                  )}
                                  <QuestionTextRenderer
                                    text={selectedOptionText}
                                    className="text-sm"
                                  />
                                </div>
                              )
                            })()
                          ) : (
                            <span className="text-sm text-slate-600 dark:text-slate-300 italic">
                              No answer selected
                            </span>
                          )}
                        </div>
                        <Badge variant="outline" className={`rounded-full ${
                          question.is_correct
                            ? "bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300/60 dark:border-emerald-700/60"
                            : "bg-red-100/80 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-300/60 dark:border-red-700/60"
                        }`}>
                          {question.is_correct ? "✓ CORRECT" : "✗ INCORRECT"}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {/* Handle Select All questions */}
                  {(question.question_type?.toLowerCase() === "select_all" || question.question_type?.toLowerCase() === "multi_output") && (
                    <div className="space-y-4">
                      {/* Student's Answer */}
                      <div className={cn(
                        "p-4 rounded-xl",
                        fr
                          ? question.is_correct
                            ? "bg-emerald-500/10 dark:bg-emerald-500/15"
                            : "bg-red-500/10 dark:bg-red-500/15"
                          : cn("rounded-2xl border",
                            question.is_correct
                              ? "bg-emerald-50/80 dark:bg-emerald-900/30 border-emerald-200/60 dark:border-emerald-700/60"
                              : "bg-red-50/80 dark:bg-red-900/30 border-red-200/60 dark:border-red-700/60",
                          ),
                      )}>
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-sm">Your Answer:</span>
                          <div className="flex-1">
                            {question.selected_answer ? (
                              (() => {
                                try {
                                  const selectedAnswers = JSON.parse(question.selected_answer)
                                  if (!Array.isArray(selectedAnswers) || selectedAnswers.length === 0) {
                                    return (
                                      <span className="text-sm text-slate-600 dark:text-slate-300 italic">
                                        No answer selected
                                      </span>
                                    )
                                  }
                                  return (
                                    <div className="flex flex-wrap gap-2">
                                      {selectedAnswers.map((answer: string, index: number) => {
                                        // Handle both letter format (A, B, C) and option text format
                                        let optionLetter = answer
                                        let optionText = answer
                                        
                                        // If answer is a letter (A, B, C, D, E), look up the option text
                                        if (typeof answer === 'string' && ['A', 'B', 'C', 'D', 'E'].includes(answer.toUpperCase())) {
                                          optionLetter = answer.toUpperCase()
                                          const optionKey = `option_${answer.toLowerCase()}` as keyof QuestionResult
                                          optionText = question[optionKey] as string || answer
                                        } else {
                                          // Answer is already option text, try to find which letter it corresponds to
                                          optionText = answer
                                          if (question.option_a === answer) optionLetter = 'A'
                                          else if (question.option_b === answer) optionLetter = 'B'
                                          else if (question.option_c === answer) optionLetter = 'C'
                                          else if (question.option_d === answer) optionLetter = 'D'
                                          else if (question.option_e === answer) optionLetter = 'E'
                                          else optionLetter = answer // Fallback to showing the text
                                        }
                                        
                                        return (
                                          <div key={index} className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs">
                                              {optionLetter}
                                            </Badge>
                                            <QuestionTextRenderer text={optionText} className="text-sm" />
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )
                                } catch (e) {
                                  // If parsing fails, try to display as-is
                                  return (
                                    <QuestionTextRenderer
                                      text={String(question.selected_answer || "")}
                                      className="text-sm"
                                    />
                                  )
                                }
                              })()
                            ) : (
                              <span className="text-sm text-slate-600 dark:text-slate-300 italic">
                                No answer selected
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Correct Answer */}
                      <div className={fr?.referencePanel ?? "p-4 rounded-2xl border bg-blue-50/80 dark:bg-blue-900/30 border-blue-200/60 dark:border-blue-700/60"}>
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-sm">Correct Answer:</span>
                          <div className="flex-1">
                            {question.correct_answer ? (
                              (() => {
                                try {
                                  const correctAnswers = JSON.parse(question.correct_answer)
                                  return (
                                    <div className="flex flex-wrap gap-2">
                                      {correctAnswers.map((answer: string, index: number) => {
                                        const optionKey = `option_${answer.toLowerCase()}` as keyof QuestionResult
                                        const optionText = question[optionKey] as string
                                        return (
                                          <div key={index} className="flex items-center gap-2">
                                            <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">
                                              {answer}
                                            </Badge>
                                            <QuestionTextRenderer text={optionText || answer} className="text-sm" />
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )
                                } catch (e) {
                                  return (
                                    <QuestionTextRenderer
                                      text={String(question.correct_answer || "")}
                                      className="text-sm"
                                    />
                                  )
                                }
                              })()
                            ) : (
                              <span className="text-sm text-slate-600 dark:text-slate-300 italic">
                                No correct answer specified
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Handle Fill-in-the-Blank and other text input questions */}
                  {["fill_blank", "code_output", "trace_output", "fill_code", "trace_logic", "scenario_match", "code_write", "code_problem", "debug_code", "code_explain", "code_write_plot"].includes(question.question_type?.toLowerCase()) && (
                    <div className="space-y-4">
                      {/* Student's Answer */}
                      <div className={`p-4 rounded-2xl border ${
                        (() => {
                          // For AI-graded questions, use canonical % (finalScore when present) for coloring
                          const aiPct = question.ai_feedback ? canonicalAiPercentForUi(question.ai_feedback) : undefined
                          if (aiPct !== undefined) {
                            const score = aiPct
                            if (score >= 90) return "bg-yellow-50/80 dark:bg-yellow-900/30 border-yellow-200/60 dark:border-yellow-700/60"
                            if (score >= 70) return "bg-green-50/80 dark:bg-green-900/30 border-green-200/60 dark:border-green-700/60"
                            if (score >= 50) return "bg-blue-50/80 dark:bg-blue-900/30 border-blue-200/60 dark:border-blue-700/60"
                            if (score >= 30) return "bg-orange-50/80 dark:bg-orange-900/30 border-orange-200/60 dark:border-orange-700/60"
                            return "bg-red-50/80 dark:bg-red-900/30 border-red-200/60 dark:border-red-700/60"
                          }
                          // For non-AI questions, use is_correct
                          return question.is_correct
                            ? "bg-emerald-50/80 dark:bg-emerald-900/30 border-emerald-200/60 dark:border-emerald-700/60"
                            : "bg-red-50/80 dark:bg-red-900/30 border-red-200/60 dark:border-red-700/60"
                        })()
                      }`}>
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-sm">
                            {["code_write", "code_problem", "debug_code", "code_explain", "code_write_plot", "code_debug"].includes(question.question_type?.toLowerCase())
                              ? "Student's Code:"
                              : "Your Answer:"}
                          </span>
                          <div className="flex-1">
                            {(() => {
                              // Extract typing_replay from answer_data (for code replay viewer)
                              let typingReplay: TypingReplay | null = null
                              if (question.answer_data) {
                                try {
                                  const ad = typeof question.answer_data === "string" ? JSON.parse(question.answer_data) : question.answer_data
                                  const tr = ad?.typing_replay
                                  if (tr && Array.isArray(tr?.events) && tr.events.length > 0) {
                                    typingReplay = tr as TypingReplay
                                  }
                                } catch { /* ignore */ }
                              }

                              // Extract student answer from various sources - for ALL question types (manual evaluation)
                              let studentCode = null
                              const qt = question.question_type?.toLowerCase() || ""
                              const isCodeType = ["code_write", "code_problem", "debug_code", "code_explain", "code_write_plot", "code_debug"].includes(qt)
                              
                              // For fill_blank, code_output, trace_output, fill_code, trace_logic, scenario_match: use selected_answer or answer_data.answer
                              if (!isCodeType && ["fill_blank", "code_output", "trace_output", "fill_code", "trace_logic", "scenario_match"].includes(qt)) {
                                studentCode = question.selected_answer || null
                                if (!studentCode && question.answer_data) {
                                  try {
                                    const ad = typeof question.answer_data === "string" ? JSON.parse(question.answer_data) : question.answer_data
                                    studentCode = ad?.answer != null ? String(ad.answer) : null
                                  } catch {
                                    studentCode = typeof question.answer_data === "string" ? question.answer_data : null
                                  }
                                }
                              }
                              
                              // Priority 1: Check if code was extracted by API (for code_write_plot)
                              if (!studentCode && question.code && question.code.trim()) {
                                studentCode = question.code
                              }
                              
                              // Priority 2: For code_write_plot, check answer_data first (may contain JSON with code and plot)
                              if (!studentCode && question.question_type?.toLowerCase() === "code_write_plot") {
                                if (question.answer_data) {
                                  try {
                                    const parsed = JSON.parse(question.answer_data)
                                    studentCode = parsed.code || parsed.answer || question.selected_answer
                                    if (parsed.code) {
                                      // Code extracted from answer_data JSON
                                    }
                                  } catch (e) {
                                    // Not JSON, use as-is
                                    studentCode = question.answer_data || question.selected_answer
                                  }
                                } else {
                                  studentCode = question.selected_answer
                                }
                              } 
                              // Priority 3: For other code questions, check both answer_data and selected_answer
                              else if (!studentCode) {
                                // Try answer_data first (may contain JSON or raw code)
                                if (question.answer_data) {
                                  try {
                                    const parsed = JSON.parse(question.answer_data)
                                    studentCode = parsed.code || parsed.answer || question.selected_answer
                                  } catch (e) {
                                    // Not JSON, use as-is (raw code string)
                                    studentCode = question.answer_data
                                  }
                                }
                                
                                // Fallback to selected_answer if answer_data didn't yield code
                                if (!studentCode && question.selected_answer) {
                                  studentCode = question.selected_answer
                                }
                              }
                              
                              // Do NOT filter template code - show it so instructors can see what the student submitted
                              // Text extracted from DB JSON / selected_answer before any replay-based recovery (for instructor compare)
                              const snapshotBeforeReplayRecovery =
                                isCodeType && studentCode != null ? String(studentCode) : ""

                              // RECOVERY: corrupt / empty → derive from replay; then align stored vs replay final doc
                              const looksCorrupt = isCodeType && studentCode && isCodeAnswerCorrupt(studentCode)
                              if (typingReplay?.events?.length && isCodeType && (!studentCode || !studentCode.trim() || looksCorrupt)) {
                                const lastT = Math.max(...typingReplay.events.map((e) => e.t), 0)
                                const derived = getDocumentAtTime(typingReplay, lastT + 1000)
                                if (derived && derived.trim() && (!studentCode || derived.length > studentCode.length)) {
                                  studentCode = derived
                                }
                              }
                              let codeTypingMismatch =
                                (question as { code_typing_mismatch?: boolean }).code_typing_mismatch === true
                              if (typingReplay?.events?.length && isCodeType) {
                                const resolved = resolveCodeDisplayWithTypingReplay({
                                  storedCode: studentCode ?? "",
                                  typingReplay,
                                })
                                if (resolved.displayCode.trim()) {
                                  studentCode = resolved.displayCode
                                  codeTypingMismatch = codeTypingMismatch || resolved.mismatchWarning
                                }
                              }

                              /** Instructors always get two columns: DB snapshot vs typing replay (or “no replay”). */
                              const showInstructorDualLayout =
                                (userType === "instructor" || isAdminView) && isCodeType
                              const instructorDual = showInstructorDualLayout
                                ? getDualCodeComparison({
                                    storedCode:
                                      question.code_saved_snapshot ?? snapshotBeforeReplayRecovery,
                                    typingReplay: typingReplay ?? undefined,
                                  })
                                : null
                              
                              // Extract plot image for code_write_plot questions
                              let plotImage = null
                              if (question.question_type?.toLowerCase() === "code_write_plot") {
                                if (question.plotImage) {
                                  plotImage = question.plotImage
                                } else if (question.answer_data) {
                                  try {
                                    const parsed = JSON.parse(question.answer_data)
                                    if (parsed.plotImage) {
                                      plotImage = parsed.plotImage
                                    }
                                  } catch (e) {
                                    // Not JSON, no plot
                                  }
                                }
                              }
                              
                              if (showInstructorDualLayout && instructorDual) {
                                const savedSide = instructorDual.savedCode
                                const replaySide = instructorDual.fromTypingReplay ?? ""
                                const hasReplayDoc = replaySide.trim() !== ""
                                const dualMismatch =
                                  hasReplayDoc &&
                                  (codeTypingMismatch ||
                                    question.code_saved_vs_replay_mismatch === true ||
                                    instructorDual.mismatch)
                                return (
                                  <div className="space-y-3">
                                    <p className="text-xs text-slate-600 dark:text-slate-400">
                                      Side-by-side: saved snapshot in the database (left) vs. document from typing replay (right). If no keystroke log was stored, the right panel explains that there is no replay backup.
                                    </p>
                                    {dualMismatch && (
                                      <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                                        These two differ in substance — compare panels below. Grading and the summary above prefer the replay when it is the reliable record.
                                      </p>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div className="space-y-2 min-w-0">
                                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                                          Saved in database
                                        </div>
                                        <div className="font-mono text-sm bg-white/50 dark:bg-slate-700/50 p-3 rounded border border-slate-200 dark:border-slate-600 overflow-x-auto">
                                          <pre
                                            className={`whitespace-pre-wrap break-words text-xs ${
                                              !savedSide.trim() ? "italic text-slate-500 dark:text-slate-400" : ""
                                            }`}
                                          >
                                            {savedSide.trim() ? savedSide : "(empty)"}
                                          </pre>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(savedSide)
                                            toast.success("Saved code copied")
                                          }}
                                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                        >
                                          Copy saved
                                        </button>
                                      </div>
                                      <div className="space-y-2 min-w-0">
                                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                                          From typing replay
                                        </div>
                                        <div className="font-mono text-sm bg-white/50 dark:bg-slate-700/50 p-3 rounded border border-slate-200 dark:border-slate-600 overflow-x-auto min-h-[2.5rem]">
                                          {hasReplayDoc ? (
                                            <pre className="whitespace-pre-wrap break-words text-xs">{replaySide}</pre>
                                          ) : (
                                            <p className="text-xs italic text-slate-500 dark:text-slate-400 leading-relaxed">
                                              No typing replay was recorded (no keystroke log in answer data). Use the saved snapshot only; there is no replay backup for this answer.
                                            </p>
                                          )}
                                        </div>
                                        {hasReplayDoc ? (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              navigator.clipboard.writeText(replaySide)
                                              toast.success("Replay code copied")
                                            }}
                                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                          >
                                            Copy replay
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                    {plotImage && question.question_type?.toLowerCase() === "code_write_plot" && (
                                      <div className="space-y-2">
                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Uploaded Plot:</span>
                                        <div className="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-800 p-2">
                                          <img
                                            src={plotImage.startsWith("data:") ? plotImage : `data:image/png;base64,${plotImage}`}
                                            alt="Student's plot submission"
                                            className="max-w-full h-auto rounded"
                                            style={{ maxHeight: "400px" }}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              }

                              if (studentCode && studentCode.trim()) {
                                return (
                                  <div className="space-y-3">
                                    {codeTypingMismatch && (
                                      <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                                        Saved code in the database differed from the final text reconstructed from typing replay. The code below matches the replay (editor state after recorded keystrokes).
                                      </p>
                                    )}
                                    <div className="font-mono text-sm bg-white/50 dark:bg-slate-700/50 p-3 rounded border border-slate-200 dark:border-slate-600 overflow-x-auto">
                                      <pre className="whitespace-pre-wrap break-words text-xs">{studentCode}</pre>
                                    </div>
                                    
                                    {/* Display plot image for code_write_plot questions */}
                                    {plotImage && question.question_type?.toLowerCase() === "code_write_plot" && (
                                      <div className="space-y-2">
                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Uploaded Plot:</span>
                                        <div className="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-800 p-2">
                                          <img 
                                            src={plotImage.startsWith('data:') ? plotImage : `data:image/png;base64,${plotImage}`}
                                            alt="Student's plot submission"
                                            className="max-w-full h-auto rounded"
                                            style={{ maxHeight: '400px' }}
                                          />
                                        </div>
                                      </div>
                                    )}
                                    
                                    <div className="flex items-center gap-3 flex-wrap">
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(studentCode)
                                          toast.success("Code copied to clipboard")
                                        }}
                                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                      >
                                        📋 Copy Code
                                      </button>
                                    </div>
                                  </div>
                                )
                              } else {
                                return (
                                  <span className="text-sm italic text-slate-600 dark:text-slate-300">No answer provided</span>
                                )
                              }
                            })()}
                          </div>
                          <Badge variant="outline" className={`rounded-full ${
                            question.ai_feedback ? (
                              // Use status if available, otherwise use score
                              question.ai_feedback.status ? (
                                question.ai_feedback.status === "Expert" ? "bg-yellow-100/80 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-300/60 dark:border-yellow-700/60" :
                                question.ai_feedback.status === "Very Good" ? "bg-blue-100/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-300/60 dark:border-blue-700/60" :
                                question.ai_feedback.status === "Keep Practicing" ? "bg-green-100/80 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300/60 dark:border-green-700/60" :
                                question.ai_feedback.status === "Getting Started" ? cn(RESULTS_ACCENT_SOFT_PILL) :
                                "bg-orange-100/80 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-300/60 dark:border-orange-700/60"
                              ) : (
                                // Score-based coloring (canonical %)
                                (() => {
                                  const s = canonicalAiPercentForUi(question.ai_feedback) ?? 0
                                  return s >= 90 ? "bg-yellow-100/80 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-300/60 dark:border-yellow-700/60" :
                                s >= 70 ? "bg-green-100/80 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300/60 dark:border-green-700/60" :
                                s >= 50 ? "bg-blue-100/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-300/60 dark:border-blue-700/60" :
                                s >= 30 ? "bg-orange-100/80 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-300/60 dark:border-orange-700/60" :
                                "bg-red-100/80 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-300/60 dark:border-red-700/60"
                                })()
                              )
                            ) : (
                              question.is_correct
                                ? "bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300/60 dark:border-emerald-700/60"
                                : "bg-red-100/80 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-300/60 dark:border-red-700/60"
                            )
                          }`}>
                            {(() => {
                              const p = canonicalAiPercentForUi(question.ai_feedback)
                              return question.ai_feedback?.status || (p !== undefined ? formatCanonicalAiPercent(p) : (question.is_correct ? "CORRECT" : "INCORRECT"))
                            })()}
                          </Badge>
                        </div>
                      </div>

                      {/* Correct Answer - DO NOT show for AI-graded code questions */}
                      {(() => {
                        // AI-graded code questions should NOT show "Correct Answer" section
                        const isAIGradedCodeQuestion = ["code_write", "code_problem", "debug_code", "code_explain", "code_debug", "code_write_plot"].includes(question.question_type?.toLowerCase());
                        
                        // Don't show "Correct Answer" section for AI-graded code questions
                        if (isAIGradedCodeQuestion) {
                          return null;
                        }
                        
                        let correctAnswer = question.correct_answer;
                        const isCodeQuestion = ["fill_code", "trace_logic"].includes(question.question_type?.toLowerCase());
                        
                        // Handle different formats of correct_answer
                        if (typeof correctAnswer === 'string') {
                          try {
                            // Try to parse as JSON (might be array format)
                            const parsed = JSON.parse(correctAnswer);
                            if (Array.isArray(parsed)) {
                              correctAnswer = parsed.join(", ");
                            }
                          } catch (e) {
                            // Keep as string
                          }
                        } else if (Array.isArray(correctAnswer)) {
                          correctAnswer = correctAnswer.join(", ");
                        }
                        
                        // Only render this section if there's an actual answer to display
                        if (!correctAnswer || correctAnswer.trim() === "") {
                          return null; // Don't show the section at all
                        }
                        
                        return (
                          <div className="p-4 rounded-2xl border bg-blue-50/80 dark:bg-blue-900/30 border-blue-200/60 dark:border-blue-700/60">
                            <div className="flex items-start gap-2">
                              <span className="font-semibold text-sm text-blue-900 dark:text-blue-100">
                                {isCodeQuestion ? "Expected Solution:" : "Correct Answer:"}
                              </span>
                              <div className="flex-1">
                                <div className={`text-sm p-3 rounded-lg border ${
                                  isCodeQuestion 
                                    ? "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600" 
                                    : "bg-white/50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600"
                                }`}>
                                  <pre className="font-mono text-xs whitespace-pre-wrap break-words">{correctAnswer}</pre>
                                </div>
                              </div>
                              <Badge variant="outline" className="bg-blue-100/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-300/60 dark:border-blue-700/60 rounded-full">
                                {isCodeQuestion ? "SOLUTION" : "ANSWER KEY"}
                              </Badge>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* "Not Answered" message removed - all question types have their own display:
                      - MCQ/True-False: shown in options with "YOUR ANSWER" and "CORRECT ANSWER" badges
                      - Fill-in/Code: shown in "Your Answer" section with correct answer below
                      - Select-all: shown in dedicated section with selected options
                  */}

                  {/* Typing Replay playback - code-write questions (students, instructors, admins) */}
                  {(() => {
                    let tr: TypingReplay | null = null
                    if (question.answer_data) {
                      try {
                        const ad = typeof question.answer_data === "string" ? JSON.parse(question.answer_data) : question.answer_data
                        const t = ad?.typing_replay
                        if (t && Array.isArray(t?.events) && t.events.length > 0) tr = t as TypingReplay
                      } catch { /* ignore */ }
                    }
                    const qt = question.question_type?.toLowerCase() || ""
                    const isCodeWrite = ["code_write", "code_problem", "code_debug", "code_write_plot", "code_explain"].includes(qt)
                    const showSection = isCodeWrite
                    if (!showSection) return null
                    const hasReplay = !!tr
                    return (
                      <div className="mt-4 p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-800/50">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Typing Replay (Anti-Cheat)</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {hasReplay ? "Watch how the student wrote this code over time" : "No keystroke data recorded"}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setReplayViewerReplay(tr)
                              setReplayViewerOpen(true)
                            }}
                            className="gap-2"
                          >
                            <Play className="h-4 w-4" />
                            {hasReplay ? "Play Typing Replay" : "View"}
                          </Button>
                        </div>
                      </div>
                    )
                  })()}

                  {/* AI Feedback Display — circuit_submission uses instructor feedback only */}
                  {question.ai_feedback &&
                    question.question_type?.toLowerCase() !== "circuit_submission" && (
                    <div className="mt-4">
                      <AIFeedbackDisplay 
                        feedback={question.ai_feedback} 
                        sampleAnswers={question.sample_answers}
                        portalTheme={fr}
                      />
                    </div>
                  )}

                  {/* Re-evaluate and manual override for instructors/admins (incl. skipped / no answer row) */}
                  {(userType === "instructor" || userType === "admin") &&
                    question.question_id != null &&
                    attemptId && (
                    <div className="mt-4 space-y-3">
                      {(question.question_type?.toLowerCase() === "circuit_submission" ||
                        question.question_type?.toLowerCase() === "multi_part" ||
                        question.question_type?.toLowerCase() === "code_write_plot") && (
                        <FacultySubmitAnswerOnBehalfPanel
                          attemptId={attemptId}
                          questionId={question.question_id}
                          questionType={question.question_type}
                          selectedAnswer={question.selected_answer}
                          answerDataRaw={(question as { answer_data?: unknown }).answer_data}
                          solutionUploadConfigRaw={
                            (question as { solution_upload_config?: unknown }).solution_upload_config
                          }
                          subquestionsRaw={(question as { subquestions?: unknown }).subquestions}
                          userType={userType}
                          onSaved={() => setRefreshTrigger((t) => t + 1)}
                        />
                      )}
                      <ReEvaluateButton
                        answerId={question.answer_id ?? undefined}
                        attemptId={attemptId}
                        questionId={question.question_id}
                        questionType={question.question_type}
                        aiFeedback={question.ai_feedback}
                        userType={userType}
                        portalTheme={fr}
                        onReEvaluated={() => setRefreshTrigger((t) => t + 1)}
                      />
                      {question.question_type?.toLowerCase() === "multi_part" ? (
                        <MultiPartInstructorGradePanel
                          answerId={question.answer_id ?? undefined}
                          attemptId={attemptId}
                          questionId={question.question_id}
                          pointsEarned={question.points_earned ?? 0}
                          overridePoints={question.override_points}
                          maxPoints={question.max_points ?? question.points ?? 3}
                          answerDataRaw={question.answer_data}
                          selectedAnswer={question.selected_answer}
                          subquestionsRaw={(question as { subquestions?: unknown }).subquestions}
                          solutionUploadConfigRaw={
                            (question as { solution_upload_config?: unknown }).solution_upload_config
                          }
                          requiresReview={question.requires_review}
                          userType={userType}
                          onOverridden={() => setRefreshTrigger((t) => t + 1)}
                        />
                      ) : question.question_type?.toLowerCase() === "circuit_submission" ? (
                        <CircuitSubmissionInstructorGradePanel
                          answerId={question.answer_id ?? undefined}
                          attemptId={attemptId}
                          questionId={question.question_id}
                          pointsEarned={question.points_earned ?? 0}
                          overridePoints={question.override_points}
                          maxPoints={question.max_points ?? question.points ?? 10}
                          selectedAnswer={question.selected_answer}
                          answerDataRaw={question.answer_data}
                          aiFeedbackRaw={question.ai_feedback}
                          solutionUploadConfigRaw={
                            (question as { solution_upload_config?: unknown }).solution_upload_config
                          }
                          requiresReview={question.requires_review}
                          userType={userType}
                          portalTheme={fr}
                          onOverridden={() => setRefreshTrigger((t) => t + 1)}
                        />
                      ) : (
                        <ManualGradeOverride
                          answerId={question.answer_id ?? undefined}
                          attemptId={attemptId}
                          questionId={question.question_id}
                          pointsEarned={question.points_earned ?? 0}
                          overridePoints={question.override_points}
                          maxPoints={question.max_points ?? question.points ?? 1}
                          userType={userType}
                          portalTheme={fr}
                          onOverridden={() => setRefreshTrigger((t) => t + 1)}
                        />
                      )}
                    </div>
                  )}

                  {/* Student Re-evaluate for questions that failed evaluation */}
                  {userType === "student" && (question.answer_id || question.question_id) && (
                    <StudentReEvaluateButton
                      answerId={question.answer_id}
                      attemptId={attemptId}
                      questionId={question.question_id}
                      questionType={question.question_type}
                      aiFeedback={question.ai_feedback}
                      requiresReview={question.requires_review}
                      studentReEvaluateUsedAt={question.student_re_evaluate_used_at}
                      instructorAdjustedPoints={question.override_points ?? null}
                      onReEvaluated={() => setRefreshTrigger((t) => t + 1)}
                    />
                  )}
                </CardContent>
              </Card>
              </div>
            )
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-4 sm:gap-6 justify-center items-center pt-8">
        {/* Instructor prev/next student navigation */}
        {isAdminView && userType === "instructor" && (results?.prevAttemptId != null || results?.nextAttemptId != null) && (
          <div className="flex items-center gap-2 order-first w-full sm:w-auto sm:order-none justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => results?.prevAttemptId && router.push(instructorResultDetailPath(results.prevAttemptId, embedInDashboard))}
              disabled={results?.prevAttemptId == null}
              className="rounded-full h-10 w-10 p-0 shrink-0"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-sm text-slate-600 dark:text-slate-400 min-w-[80px] text-center">
              {results?.currentIndex ?? 0} / {results?.totalAttempts ?? 0}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => results?.nextAttemptId && router.push(instructorResultDetailPath(results.nextAttemptId, embedInDashboard))}
              disabled={results?.nextAttemptId == null}
              className="rounded-full h-10 w-10 p-0 shrink-0"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        )}
        <Button
          variant="outline"
          onClick={() => {
            setLoading(true)
            setError(null)
            setRefreshTrigger((t) => t + 1)
          }}
          disabled={loading}
          className={cn("rounded-full px-6 gap-2 border-2", fr?.outline ?? "")}
          title="Refresh to see updated scores after instructor re-evaluation"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
        <Button
          onClick={async () => {
            if (!results) return
            try {
              await handleDownloadPDF(attemptId, results, results.assessment_type || assessmentType)
              
              // Mark PDF as downloaded in database
              try {
                const markResponse = await studentApiFetch(`/api/student/results/${attemptId}/mark-pdf-downloaded`, {
                  method: 'POST',
                  headers: getStudentAuthHeaders(),
                })
                if (!markResponse.ok) {
                  console.warn("Failed to mark PDF as downloaded in database")
                }
              } catch (markError) {
                console.error("Error marking PDF as downloaded:", markError)
                // Don't fail the download if marking fails
              }
              
              setHasDownloadedReport(true)
            } catch (error) {
              console.error("Failed to download PDF:", error)
              toast.error("Failed to download report", {
                description: "Please try again or contact support if the issue persists",
                duration: 5000,
              })
            }
          }}
          className={cn("rounded-full px-8 gap-2 shadow-lg", fr?.cta ?? "bg-emerald-600 hover:bg-emerald-700 text-white")}
          disabled={shouldLockReviewButtons || pdfOrReviewBlockedByInstructor}
        >
          {shouldLockReviewButtons || pdfOrReviewBlockedByInstructor ? (
            <Lock className="h-4 w-4" />
          ) : (
            <Printer className="h-4 w-4" />
          )}
          Download PDF
        </Button>
        {(userType === "instructor" || userType === "admin") && (
          <Button
            variant="outline"
            onClick={async () => {
              if (!results) return
              try {
                const res = await instructorApiFetch(`/api/instructor/results/${attemptId}/diagnostic-report`, {
                  headers: buildInstructorAuthorizedApiHeaders(),
                })
                if (!res.ok) throw new Error("Failed to generate report")
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = buildResultsPdfFilename(
                  results.student_name,
                  results.section,
                  results.assessment_type || assessmentType,
                  "diagnostic",
                )
                a.click()
                URL.revokeObjectURL(url)
                toast.success("Diagnostic report downloaded", {
                  description: "Contains error logs, submission issues, and violation details",
                  duration: 4000,
                })
              } catch (error) {
                console.error("Failed to download diagnostic report:", error)
                toast.error("Failed to download diagnostic report", {
                  description: "Please try again or contact support",
                  duration: 5000,
                })
              }
            }}
            className={cn("rounded-full px-6 gap-2", fr?.outline ?? "border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-200")}
            title="Detailed report with error logs, submission issues, and violations"
          >
            <FileSearch className="h-4 w-4" />
            Diagnostic Report
          </Button>
        )}
        {(userType === "instructor" || userType === "admin") && (
          <Button
            variant="outline"
            onClick={async () => {
              if (!results) return
              setIsEmailingGrades(true)
              try {
                const res = await instructorApiFetch(`/api/instructor/results/${attemptId}/email-grades-updated`, {
                  method: "POST",
                  headers: buildInstructorAuthorizedApiHeaders(),
                })
                const data = await res.json()
                if (res.ok && data.success) {
                  setResults((prev) =>
                    prev
                      ? {
                          ...prev,
                          results_finalized: data.results_finalized ?? true,
                          results_finalized_at: data.results_finalized_at ?? prev.results_finalized_at ?? null,
                          results_finalized_by: data.results_finalized_by ?? prev.results_finalized_by ?? null,
                        }
                      : prev,
                  )
                  toast.success("Email sent successfully", {
                    description: `${results.student_name} has been notified and results are marked finalized.`,
                    duration: 4000,
                  })
                } else {
                  toast.error("Could not send email", {
                    description: data.error || "Student may not have a valid email on file.",
                    duration: 5000,
                  })
                }
              } catch (err) {
                console.error("Failed to send grades email:", err)
                toast.error("Failed to send email", {
                  description: "Please try again or check that the student has an email on file.",
                  duration: 5000,
                })
              } finally {
                setIsEmailingGrades(false)
              }
            }}
            disabled={isEmailingGrades || shouldLockReviewButtons}
            className={cn(
              "rounded-full px-8 gap-2 shadow-lg",
              fr?.outline ??
                "border-2 border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)] hover:brightness-105 dark:text-[var(--cc-accent)]",
            )}
          >
            {isEmailingGrades ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : shouldLockReviewButtons ? (
              <Lock className="h-4 w-4" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            {isEmailingGrades ? "Sending…" : "Email Student"}
          </Button>
        )}
        <Button
          onClick={() => {
            // Determine the back path first
            let backPath = "/student/quizzes"
            
            if (isAdminView && userType === "admin") {
              backPath = "/admin/results"
            } else if (isAdminView && userType === "instructor") {
              const base = embedInDashboard ? "/faculty/dashboard" : "/instructor"
              if (isInstructorResultDetailPath(pathname)) {
                backPath = instructorResultsListPath(embedInDashboard)
              } else {
                // For other entry points (e.g. from quizzes page), use assessment_type or referrer
                const assessmentTypeValue = results?.assessment_type || assessmentType
                const referrer = typeof window !== "undefined" ? document.referrer : ""
                backPath = `${base}/results`
                if (assessmentTypeValue === "homework") {
                  backPath = `${base}/homeworks`
                } else if (assessmentTypeValue === "mid_semester") {
                  backPath = `${base}/mid-semester-exams`
                } else if (assessmentTypeValue === "quiz") {
                  backPath = `${base}/quizzes`
                } else if (assessmentTypeValue === "final") {
                  backPath = `${base}/final-exams`
                } else {
                  if (referrer.includes("/instructor/homeworks") || referrer.includes("/instructor/dashboard-v2/homeworks")) {
                    backPath = `${base}/homeworks`
                  } else if (referrer.includes("/instructor/mid-semester-exams") || referrer.includes("/instructor/dashboard-v2/mid-semester-exams")) {
                    backPath = `${base}/mid-semester-exams`
                  } else if (referrer.includes("/instructor/final-exams") || referrer.includes("/instructor/dashboard-v2/final-exams")) {
                    backPath = `${base}/final-exams`
                  } else if (referrer.includes("/instructor/quizzes") || referrer.includes("/instructor/dashboard-v2/quizzes")) {
                    backPath = `${base}/quizzes`
                  }
                }
              }
            } else {
              // For student, always use dashboard-v2 paths
              const assessmentTypeValue = results?.assessment_type || assessmentType
              const referrer = typeof window !== "undefined" ? document.referrer : ""
              backPath = referrer.includes("/student/quiz-history")
                ? `${DASHBOARD_V2_BASE}/quiz-history`
                : getBackPathForAssessmentV2(assessmentTypeValue || "quiz")
            }

            // Check if student needs to download before leaving
            if (!isAdminView && userType === "student" && !hasDownloadedReport) {
              setPendingNavigation(backPath)
              setShowExitWarningModal(true)
              return
            }

            // Navigate if download is confirmed or not a student
            router.push(backPath)
          }}
          variant="outline"
          className={cn("rounded-full px-8 gap-2 shadow-lg", fr?.outline ?? "bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-600 hover:bg-slate-100/80 dark:hover:bg-slate-700/80")}
        >
          <ArrowLeft className="h-4 w-4" />
          {(() => {
            if (isAdminView && userType === "admin") {
              return "Back to Results"
            }
            
            if (isAdminView && userType === "instructor") {
              if (isInstructorResultDetailPath(pathname)) {
                return "Back to Results"
              }
              // For other entry points, match routing logic
              const assessmentTypeValue = results?.assessment_type || assessmentType
              const referrer = typeof window !== "undefined" ? document.referrer : ""
              if (assessmentTypeValue === "homework" || results?.assessment_type === "homework") {
                return "Back to Homeworks"
              } else if (assessmentTypeValue === "mid_semester" || results?.assessment_type === "mid_semester") {
                return "Back to Mid-Semester Exams"
              } else if (assessmentTypeValue === "final" || results?.assessment_type === "final") {
                return "Back to Final Exams"
              } else if (assessmentTypeValue === "quiz" || results?.assessment_type === "quiz") {
                return "Back to Quizzes"
              } else if (referrer.includes("/instructor/homeworks")) {
                return "Back to Homeworks"
              } else if (referrer.includes("/instructor/mid-semester-exams")) {
                return "Back to Mid-Semester Exams"
              } else if (referrer.includes("/instructor/final-exams")) {
                return "Back to Final Exams"
              } else if (referrer.includes("/instructor/quizzes")) {
                return "Back to Quizzes"
              }
              return "Back to Results"
            } else {
              // Student view
              const assessmentTypeValue = results?.assessment_type || assessmentType
              const referrer = typeof window !== "undefined" ? document.referrer : ""
              if (assessmentTypeValue === "homework" || results?.assessment_type === "homework") {
                return "Back to Homework"
              } else if (assessmentTypeValue === "mid_semester" || results?.assessment_type === "mid_semester") {
                return "Back to Mid-Semester Exams"
              } else if (assessmentTypeValue === "final" || results?.assessment_type === "final") {
                return "Back to Final Exams"
              } else if (assessmentTypeValue === "practice") {
                return "Back to Practice"
              } else if (referrer.includes("/student/quiz-history")) {
                return "Back to History"
              } else if (referrer.includes("/student/homework")) {
                return "Back to Homework"
              } else if (referrer.includes("/student/mid-semester-exams")) {
                return "Back to Mid-Semester Exams"
              } else if (referrer.includes("/student/final-exams")) {
                return "Back to Final Exams"
              }
              return "Back to Quizzes"
            }
          })()}
        </Button>
      </div>

      <Dialog open={showViewReportDialog} onOpenChange={(open) => { setShowViewReportDialog(open); if (!open) setPendingReportAction(null) }}>
        <DialogContent className="sm:max-w-md bg-white/85 dark:bg-slate-800/85 backdrop-blur-md border border-slate-200/60 dark:border-slate-600 rounded-2xl shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_25px_rgba(0,0,0,0.4)]">
          <DialogHeader className="p-6">
            <DialogTitle className="flex items-center gap-3 text-slate-800 dark:text-slate-200">
              <div className="p-2 bg-amber-100/80 dark:bg-amber-900/80 rounded-xl">
                <AlertCircle className="h-5 w-5 text-amber-700 dark:text-amber-400" />
              </div>
              Forfeit Retake Opportunity?
            </DialogTitle>
            <DialogDescription className="pt-4 text-slate-700 dark:text-slate-200">
                  Viewing the detailed report will show you the correct answers to all questions.
            </DialogDescription>
            <div className="space-y-4 px-6">
                <div className="p-4 bg-amber-50/80 dark:bg-amber-900/30 border border-amber-200/60 dark:border-amber-700/60 rounded-2xl">
                  <div className="font-semibold text-amber-900 dark:text-amber-200 mb-2">⚠️ Warning:</div>
                  <div className="text-sm text-amber-800 dark:text-amber-300">
                    Once you view the correct answers, your retake opportunity will be forfeited to maintain quiz
                    integrity.
                  </div>
                </div>
              <div className="text-sm text-slate-700 dark:text-slate-200">Do you want to proceed and forfeit your retake?</div>
              </div>
          </DialogHeader>
          <DialogFooter className="flex gap-3 p-6 pt-0">
            <Button variant="outline" onClick={() => { setShowViewReportDialog(false); setPendingReportAction(null) }} className="rounded-full bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-600">
              Cancel
            </Button>
            <Button
              onClick={confirmViewReport}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-full shadow-lg"
            >
              Yes, View Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* How re-evaluation works (student) */}
      <Dialog open={showReevaluateProcessModal} onOpenChange={setShowReevaluateProcessModal}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-lg bg-white dark:bg-slate-800 border-slate-200/60 dark:border-slate-600 rounded-2xl max-h-[85vh] overflow-y-auto"
        >
          <DialogHeader className="relative pr-10">
            <button
              type="button"
              onClick={() => setShowReevaluateProcessModal(false)}
              className="absolute right-0 top-0 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 z-10"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100 pr-6">
              <Info className={cn("h-5 w-5 shrink-0", RESULTS_ACCENT_PTS_ICON)} />
              How re-evaluation works
            </DialogTitle>
            <DialogDescription className="text-left text-slate-600 dark:text-slate-300 space-y-3 pt-2">
              <p>
                Automated re-evaluation sends your <strong>saved answers</strong> through the grader again. It does not change what you typed—only scores and feedback may update.
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>
                  <strong>Re-evaluate failed</strong> — Only questions that look failed, stuck on &quot;Processing…&quot;, or have 0 points with an error are re-run. Fastest if only some items need a second pass.
                </li>
                <li>
                  <strong>Re-evaluate all</strong> — Every question is evaluated again. Use if you want a full refresh (takes longer).
                </li>
                <li>
                  For this attempt, the system allows <strong>one</strong> student bulk re-evaluation (either mode). After it completes, your score updates; use <strong>Recalculate score</strong> on this page if the total still looks off.
                </li>
                <li>
                  If your instructor has manually adjusted a grade, re-evaluation may be disabled for that submission—contact them if you still see PND%.
                </li>
              </ol>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" className="rounded-full" onClick={() => setShowReevaluateProcessModal(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Student: PND% — prompt re-evaluation before download / finalize */}
      {(() => {
        const shouldShowPndPortal =
          !isAdminView &&
          userType === "student" &&
          showPndReevaluateModal &&
          needsPndGuidance &&
          isMounted &&
          typeof document !== "undefined" &&
          document.body

        if (!shouldShowPndPortal) return null

        return createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pnd-reeval-title"
          >
            <div
              className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border-2 border-amber-200 dark:border-amber-800 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-200 dark:border-slate-600">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 bg-amber-100 dark:bg-amber-900/50 rounded-xl shrink-0">
                    <TriangleAlert className="h-6 w-6 text-amber-700 dark:text-amber-400" />
                  </div>
                  <div>
                    <h2 id="pnd-reeval-title" className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">
                      Pending score (PND%) — re-evaluate before you finalize
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      We noticed your result isn&apos;t final yet
                      {failedReevalCandidateCount > 0
                        ? ` — about ${failedReevalCandidateCount} question${failedReevalCandidateCount === 1 ? "" : "s"} may need another grading pass.`
                        : " — run a quick automated re-check to improve your score before you download your report."}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={dismissPndGuidance}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 shrink-0"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className={cn("rounded-xl px-4 py-3 text-sm", RESULTS_ACCENT_SOFT_PILL)}>
                  <p className="font-medium mb-1">Recommended next step</p>
                  <p>
                    Run re-evaluation now so fewer items need manual fixes later. Then download your report and submit on Canvas as your instructor directed.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full flex-1 border-amber-400 dark:border-amber-600 text-amber-900 dark:text-amber-100"
                    disabled={isReEvaluatingAll || failedReevalCandidateCount === 0}
                    onClick={() => runStudentBulkReevaluate("failed")}
                  >
                    {isReEvaluatingAll ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Re-evaluate failed only
                  </Button>
                  <Button
                    type="button"
                    className={cn("rounded-full flex-1 text-white", RESULTS_ACCENT_CTA)}
                    disabled={isReEvaluatingAll}
                    onClick={() => runStudentBulkReevaluate("all")}
                  >
                    {isReEvaluatingAll ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Re-evaluate all
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={RESULTS_ACCENT_PTS_ICON}
                    onClick={() => setShowReevaluateProcessModal(true)}
                  >
                    <Info className="h-4 w-4 mr-1.5" />
                    How does this work?
                  </Button>
                  <Button type="button" variant="link" size="sm" className="text-slate-500" onClick={dismissPndGuidance}>
                    Continue without re-evaluating
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      })()}

      {/* Custom Exit Warning Modal - Only for students */}
      {(() => {
        const shouldShowModal = !isAdminView && userType === "student" && showExitWarningModal && isMounted && typeof document !== 'undefined' && document.body
        
        if (!shouldShowModal) {
          return null
        }
        
        return createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            opacity: 1,
            display: 'flex',
            visibility: 'visible',
            pointerEvents: 'auto',
          }}
          onClick={(e) => {
            // Prevent closing by clicking outside
            e.stopPropagation()
          }}
          onKeyDown={(e) => {
            // Prevent closing with Escape key
            if (e.key === 'Escape' && !hasDownloadedReport) {
              e.preventDefault()
              e.stopPropagation()
            }
          }}
        >
          <div 
            className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border-2 border-amber-200 dark:border-amber-800 overflow-hidden"
            style={{
              animation: 'fadeInScale 0.3s ease-out',
              opacity: 1,
              visibility: 'visible',
              display: 'block',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-600">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-xl">
                    <TriangleAlert className="h-6 w-6 text-amber-700 dark:text-amber-400" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                    📌 Important: Save & Submit Your Assessment Report
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setHasDownloadedReport(true)
                    setShowExitWarningModal(false)
                    
                    if (pendingNavigation) {
                      router.push(pendingNavigation)
                      setPendingNavigation(null)
                    }
                  }}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0"
                  aria-label="Close modal"
                >
                  <X className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-3">
                <p className="font-medium text-slate-700 dark:text-slate-300">
                  To ensure your grade is properly recorded, you must complete the steps below:
                </p>
                <ol className="list-decimal list-inside space-y-2 ml-2 text-sm text-slate-700 dark:text-slate-300">
                  <li>Download your assessment report from this page (PDF or report download button).</li>
                  <li>Upload the downloaded report to Canvas under the correct assignment.</li>
                  <li>Submit on Canvas to finalize your grade.</li>
                </ol>
                <div className="p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg mt-4">
                  <p className="text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <span>⚠️ Do not skip this step. Grades are recorded based on Canvas submissions only.</span>
                  </p>
                </div>
              </div>
              
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2 mb-2">
                  <AlertCircle className="h-5 w-5" />
                  ⏰ Data Retention Notice
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  CourseCollab assessment results are automatically deleted after 24 hours.
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
                  If you do not download your report within this time window, it cannot be recovered.
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
                  Always keep a personal copy of your report for your records.
                </p>
              </div>

              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                <p className="font-semibold text-emerald-900 dark:text-emerald-200 mb-2">
                  ✅ Action required now:
                </p>
                <p className="text-sm text-emerald-800 dark:text-emerald-300">
                  Download → Upload to Canvas → Submit
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col sm:flex-row gap-3 p-6 pt-0 border-t border-slate-200 dark:border-slate-600">
              <Button
                onClick={async () => {
                  if (results) {
                    try {
                      // Download the PDF
                      await handleDownloadPDF(attemptId, results, results.assessment_type || assessmentType)
                      
                      // Mark PDF as downloaded in database
                      try {
                        const markResponse = await studentApiFetch(`/api/student/results/${attemptId}/mark-pdf-downloaded`, {
                          method: 'POST',
                          headers: getStudentAuthHeaders(),
                        })
                        if (!markResponse.ok) {
                          // Silently fail - don't interrupt user flow
                        }
                      } catch (markError) {
                        // Don't fail the download if marking fails
                      }
                      
                      setHasDownloadedReport(true)
                      setShowExitWarningModal(false)
                      
                      // Navigate if there was a pending navigation
                      if (pendingNavigation) {
                        router.push(pendingNavigation)
                        setPendingNavigation(null)
                      }
                    } catch (error) {
                      toast.error("Failed to download report", {
                        description: "Please try again or contact support if the issue persists",
                        duration: 5000,
                      })
                    }
                  }
                }}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6 gap-2 shadow-lg"
              >
                <Printer className="h-4 w-4" />
                Download Now
              </Button>
              <Button
                onClick={() => {
                  setHasDownloadedReport(true)
                  setShowExitWarningModal(false)
                  
                  if (pendingNavigation) {
                    router.push(pendingNavigation)
                    setPendingNavigation(null)
                  }
                }}
                variant="outline"
                className="w-full sm:w-auto rounded-full px-6 gap-2 bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-600 hover:bg-slate-100/80 dark:hover:bg-slate-700/80"
              >
                <Check className="h-4 w-4" />
                I've downloaded my report
              </Button>
            </div>
          </div>
        </div>,
        document.body
        )
      })()}
      
      {/* Retake Upgrade Modal */}
      <RetakeUpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        assessmentType={assessmentType || "assessment"}
      />
      {/* Retake Forfeit Alert */}
      <RetakeForfeitAlert
        open={showForfeitAlert}
        onClose={() => setShowForfeitAlert(false)}
        assessmentLabel={assessmentType === "mid_semester" ? "mid-semester exam" : assessmentType === "final" ? "final exam" : assessmentType === "homework" ? "homework" : "quiz"}
      />
      {/* Typing Replay Viewer for code questions */}
      <CodeReplayViewer
        open={replayViewerOpen}
        onOpenChange={setReplayViewerOpen}
        replay={replayViewerReplay}
        language={undefined}
      />
    </div>
  )
}
