"use client"

import { useEffect, useState, useMemo, useCallback, startTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/components/ui/use-toast"
import { 
  Download, 
  ArrowLeft, 
  Trash2, 
  AlertTriangle, 
  Flag,
  Eye, 
  Edit, 
  LayoutGrid, 
  List, 
  Users, 
  FileText, 
  Calendar, 
  Award, 
  TrendingUp, 
  Filter as FilterIcon, 
  Archive, 
  RotateCcw,
  ClipboardList,
  BookOpen,
  GraduationCap,
  BarChart3,
  Trash2 as TrashIcon,
  RefreshCw,
  Loader2,
  Clock,
  ChevronUp,
  ChevronDown,
  Search,
  Upload,
  ShieldCheck,
  CircleDot,
  Star,
} from "lucide-react"
import Link from "next/link"
import { usePreventBack } from "@/hooks/use-prevent-back"
import { usePersistedState, useScrollRestoration } from "@/hooks/use-persisted-state"
import { dbTimeToCDT } from "@/lib/timezone"
import { getSectionColumnHeading } from "@/lib/instructor-section-presets"
import { useSessionCatalog } from "@/components/session-catalog-provider"
import {
  sectionsMatchForFilter,
  unifySessionForFilterDropdown,
  SESSION_LEGACY_TO_CANONICAL,
} from "@/lib/session-code-aliases"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { InstructorAdvancedAnalytics } from "@/components/instructor-advanced-analytics"
import { CanvasExportPanel } from "@/components/canvas-export-panel"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
  facultyToolbarIconButtonClass,
  facultyToolbarSelectTriggerClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { getFacultyModuleTheme } from "@/lib/faculty-module-themes"
import { AN_META, AN_PANEL, PORTAL_TEXT_MUTED } from "@/lib/analytics/analytics-instructor-ui"
import { cn } from "@/lib/utils"
import { CANVAS_EXTRA_EXPORT_COLUMNS } from "@/lib/canvas-extra-export-columns"
import { buildSessionAssessmentExportBasename } from "@/lib/results-pdf-filename"
import { generateQuizResultsPdfArrayBuffer, getResultsPdfFilenameForZip } from "@/lib/quiz-results-pdf"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

interface Quiz {
  id: number
  title: string
  section?: string
  assessment_type?: string
  session_access?: Record<string, boolean>
  /** From /api/instructor/quizzes — helps distinguish duplicate titles */
  total_attempts?: number
}

interface Result {
  attempt_id: number
  assessment_id?: number
  student_name: string
  student_id: string
  section: string
  quiz_title: string
  assessment_title?: string
  assessment_type?: string
  score: number
  total_questions: number
  total_possible_points?: number // Total points possible (sum of max_points) - use this for score denominator
  // NOTE: correct_answers is for informational display only (count of correct questions)
  // CRITICAL: Scoring MUST use score (points_earned), NOT correct_answers count
  // correct_answers does NOT equal points scored (e.g., 4 correct questions ≠ 0.4 points)
  correct_answers?: number // Informational only - count of correct questions, NOT used for scoring
  percentage: number
  completed_at: string
  attempt_number?: number
  attempt_label?: string
  is_retake?: boolean
  is_final?: boolean
  is_final_grade?: boolean
  has_viewed_report?: boolean
  retake_enabled?: boolean
  retake_limit?: number
  retake_policy?: string
  is_final_grade?: boolean
  violation_log?: Array<{ type?: string }>
  /** True when pending review (requires_review w/o instructor review) or anti-cheat thresholds (from API) */
  is_flagged?: boolean
  /** When true, show "PND%" in grade column (pending eval / score — from unified results API) */
  should_show_pnd?: boolean
  /** Student has not submitted/finalized — results are not viewable yet */
  is_in_progress?: boolean
  /** Continue Later pause — student can resume; instructor may view saved work */
  is_paused?: boolean
  saved_for_later_at?: string | null
  started_at?: string | null
  /** Instructor marked results reviewed / approved for student */
  results_finalized?: boolean
  results_finalized_at?: string | null
  results_finalized_by?: string | null
}

/** Flagged = API `is_flagged`: anti-cheat thresholds or true PND% (pending grade), aligned after batch PND sync. */
function isAttemptFlaggedForReview(r: Result): boolean {
  return r.is_flagged === true
}

function resultShouldShowPnd(r: Result): boolean {
  return r.should_show_pnd === true
}

/** Grade column: show PND% when evaluation/score is still pending (matches student report). */
function formatResultsViewerGradePercent(r: Result): string {
  if (resultShouldShowPnd(r)) return "PND%"
  if (isAttemptInProgress(r)) {
    return `${Number(r.percentage ?? 0).toFixed(2)}% (partial)`
  }
  return `${Number(r.percentage ?? 0).toFixed(2)}%`
}

type ResultReviewStatus =
  | "in_progress"
  | "saved_for_later"
  | "pending"
  | "finalized"
  | "flagged"
  | "open"

function getResultReviewStatus(r: Result): ResultReviewStatus {
  if (isAttemptInProgress(r)) return "in_progress"
  if (isAttemptPaused(r)) return "saved_for_later"
  if (resultShouldShowPnd(r)) return "pending"
  if (r.results_finalized) return "finalized"
  if (isAttemptFlaggedForReview(r)) return "flagged"
  return "open"
}

const RESULT_STATUS_SORT_RANK: Record<ResultReviewStatus, number> = {
  in_progress: 0,
  saved_for_later: 1,
  pending: 2,
  flagged: 3,
  open: 4,
  finalized: 5,
}

function resultStatusTitle(r: Result, status: ResultReviewStatus): string {
  switch (status) {
    case "in_progress":
      return r.started_at
        ? `Student is still taking this assessment · started ${dbTimeToCDT(r.started_at, "MMM d, h:mm a")}`
        : "Student is still taking this assessment"
    case "saved_for_later":
      return r.saved_for_later_at
        ? `Saved for later · ${dbTimeToCDT(r.saved_for_later_at, "MMM d, h:mm a")}`
        : "Saved for later — student can resume"
    case "pending":
      return "Grade pending — awaiting evaluation or manual review"
    case "finalized": {
      const by = r.results_finalized_by?.trim()
      return by ? `Results finalized by ${by}` : "Results finalized and approved for release"
    }
    case "flagged":
      return "Flagged for review — anti-cheat signals or grading attention needed"
    case "open":
      return "Submitted — awaiting instructor finalization"
    default:
      return ""
  }
}

function ResultStatusBadge({
  result,
  compact = false,
}: {
  result: Result
  compact?: boolean
}) {
  const status = getResultReviewStatus(result)
  const title = resultStatusTitle(result, status)

  const config: Record<
    ResultReviewStatus,
    { label: string; shortLabel: string; icon: typeof Clock; className: string }
  > = {
    in_progress: {
      label: "In Progress",
      shortLabel: "Active",
      icon: Clock,
      className:
        "bg-amber-100/95 dark:bg-amber-950/45 text-amber-800 dark:text-amber-200 border-amber-200/70 dark:border-amber-700/40",
    },
    saved_for_later: {
      label: "Saved for Later",
      shortLabel: "Paused",
      icon: Clock,
      className:
        "bg-sky-100/95 dark:bg-sky-950/45 text-sky-800 dark:text-sky-200 border-sky-200/70 dark:border-sky-700/40",
    },
    pending: {
      label: "Pending",
      shortLabel: "PND",
      icon: Clock,
      className:
        "bg-amber-100/95 dark:bg-amber-950/45 text-amber-800 dark:text-amber-200 border-amber-200/70 dark:border-amber-700/40",
    },
    finalized: {
      label: "Finalized",
      shortLabel: "Done",
      icon: ShieldCheck,
      className:
        "bg-emerald-100/95 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200/70 dark:border-emerald-700/40",
    },
    flagged: {
      label: "Flagged",
      shortLabel: "Flag",
      icon: Flag,
      className:
        "bg-rose-100/95 dark:bg-rose-950/45 text-rose-800 dark:text-rose-200 border-rose-200/70 dark:border-rose-700/40",
    },
    open: {
      label: "Open",
      shortLabel: "Open",
      icon: CircleDot,
      className:
        "bg-slate-100/95 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-600/50",
    },
  }

  const { label, shortLabel, icon: Icon, className } = config[status]
  const sizeClass = compact
    ? "rounded-md px-1.5 py-0.5 text-[10px] leading-tight gap-1"
    : "rounded-md px-2 py-0.5 text-xs gap-1.5 w-fit max-w-full"

  return (
    <Badge
      title={title}
      className={`border font-medium inline-flex items-center shrink-0 ${sizeClass} ${className}`}
    >
      <Icon className={compact ? "h-3 w-3 shrink-0" : "h-3.5 w-3.5 shrink-0"} aria-hidden />
      <span className="hidden min-[480px]:inline truncate">{label}</span>
      <span className="min-[480px]:hidden truncate">{shortLabel}</span>
    </Badge>
  )
}

function resultsViewerGradeColorClass(r: Result): string {
  if (resultShouldShowPnd(r)) return "text-amber-600 dark:text-amber-400"
  const pct = Number(r.percentage ?? 0)
  if (pct >= 70) return "text-green-600 dark:text-green-400"
  if (pct >= 50) return "text-yellow-600 dark:text-yellow-400"
  return "text-red-600 dark:text-red-400"
}

function isAttemptInProgress(r: Result): boolean {
  return r.is_in_progress === true
}

function isAttemptPaused(r: Result): boolean {
  return r.is_paused === true
}

function formatResultsAssessmentTypeLabel(type?: string): string {
  switch (type) {
    case "homework":
      return "Homework"
    case "mid_semester":
    case "midsem":
      return "Mid-Semester Exam"
    case "final":
      return "Final Exam"
    case "quiz":
      return "Quiz"
    default:
      return type ? type.replace(/_/g, " ") : "Assessment"
  }
}

function formatRetakePolicyLabel(policy?: string): string | null {
  if (!policy) return null
  switch (policy) {
    case "best":
      return "Best score"
    case "latest":
      return "Latest attempt"
    case "average":
      return "Average of attempts"
    default:
      return policy.replace(/_/g, " ")
  }
}

function ResultAssessmentTooltipContent({ result }: { result: Result }) {
  const title = result.quiz_title || result.assessment_title || "Untitled assessment"
  const assessmentId = result.assessment_id ?? (result as { quiz_id?: number }).quiz_id
  const status = getResultReviewStatus(result)
  const statusLabel = resultStatusTitle(result, status)
  const retakePolicy = formatRetakePolicyLabel(result.retake_policy)

  return (
    <div className="space-y-2 text-left">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">Assessment</p>
        <p className="text-sm font-semibold text-[var(--cc-text)] leading-snug">{title}</p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-[var(--cc-text-muted)]">Type</dt>
        <dd className="font-medium text-[var(--cc-text)]">{formatResultsAssessmentTypeLabel(result.assessment_type)}</dd>
        {assessmentId != null ? (
          <>
            <dt className="text-[var(--cc-text-muted)]">ID</dt>
            <dd className="font-mono text-[var(--cc-text)]">#{assessmentId}</dd>
          </>
        ) : null}
        <dt className="text-[var(--cc-text-muted)]">Attempt</dt>
        <dd className="text-[var(--cc-text)]">
          #{result.attempt_number ?? 1}
          {result.is_final_grade ? " · Grade attempt" : result.is_retake ? " · Extra attempt" : ""}
        </dd>
        <dt className="text-[var(--cc-text-muted)]">Student</dt>
        <dd className="text-[var(--cc-text)]">
          {result.student_name}
          <span className="block font-mono text-[10px] text-[var(--cc-text-muted)]">{result.student_id}</span>
        </dd>
        <dt className="text-[var(--cc-text-muted)]">Section</dt>
        <dd className="text-[var(--cc-text)]">{result.section || "—"}</dd>
        {result.started_at ? (
          <>
            <dt className="text-[var(--cc-text-muted)]">Started</dt>
            <dd className="text-[var(--cc-text)]">{dbTimeToCDT(result.started_at, "MMM d, h:mm a")}</dd>
          </>
        ) : null}
        <dt className="text-[var(--cc-text-muted)]">{isAttemptInProgress(result) || isAttemptPaused(result) ? "Last activity" : "Completed"}</dt>
        <dd className="text-[var(--cc-text)]">{formatAttemptStatusLabel(result)}</dd>
        <dt className="text-[var(--cc-text-muted)]">Score</dt>
        <dd className="font-semibold tabular-nums text-[var(--cc-text)]">
          {Number(result.score || 0).toFixed(2)}/{result.total_possible_points ?? result.total_questions} ({formatResultsViewerGradePercent(result)})
        </dd>
        <dt className="text-[var(--cc-text-muted)]">Status</dt>
        <dd className="text-[var(--cc-text)]">{statusLabel}</dd>
        {retakePolicy ? (
          <>
            <dt className="text-[var(--cc-text-muted)]">Retakes</dt>
            <dd className="text-[var(--cc-text)]">
              {retakePolicy}
              {result.retake_limit != null ? ` · limit ${result.retake_limit}` : result.retake_enabled ? " · enabled" : ""}
            </dd>
          </>
        ) : null}
        <dt className="text-[var(--cc-text-muted)]">Record</dt>
        <dd className="font-mono text-[10px] text-[var(--cc-text-muted)]">Attempt #{result.attempt_id}</dd>
      </dl>
    </div>
  )
}

function formatAttemptStatusLabel(r: Result): string {
  if (isAttemptInProgress(r)) {
    return r.started_at
      ? `In Progress · Started ${dbTimeToCDT(r.started_at, "MMM d, h:mm a")}`
      : "In Progress"
  }
  if (isAttemptPaused(r)) {
    return r.saved_for_later_at
      ? `Saved for Later · ${dbTimeToCDT(r.saved_for_later_at, "MMM d, h:mm a")}`
      : "Saved for Later"
  }
  return r.completed_at ? dbTimeToCDT(r.completed_at, "MMM d, h:mm a") : "N/A"
}

function GradeAttemptBadge({ result, showRetakes }: { result: Result; showRetakes: boolean }) {
  if (!showRetakes) return null
  if (result.is_final_grade) {
    return (
      <Badge className="border-0 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-[10px] shrink-0">
        Grade
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
      Extra #{result.attempt_number ?? "?"}
    </Badge>
  )
}

function AttemptResultActions({
  result,
  resultsBase,
  embedInDashboard,
  onDelete,
  compact = false,
  canSetFinalGrade = false,
  onSetFinalGrade,
  settingFinalAttemptId = null,
}: {
  result: Result
  resultsBase: string
  embedInDashboard?: boolean
  onDelete: (attemptId: number) => void
  compact?: boolean
  canSetFinalGrade?: boolean
  onSetFinalGrade?: (attemptId: number) => void
  settingFinalAttemptId?: number | null
}) {
  const inProgress = isAttemptInProgress(result)
  const iconSize = compact ? "h-3.5 w-3.5" : "h-4 w-4"
  const btnSize = compact ? "h-8 w-8" : "h-8 w-8"
  const viewBtnClass = `border-slate-200 dark:border-white/10 transition-all rounded-lg shrink-0 ${btnSize} p-0 ${
    embedInDashboard
      ? "hover:bg-teal-50 dark:hover:bg-teal-500/10 hover:border-teal-300 dark:hover:border-teal-500/50 hover:text-teal-600 dark:hover:text-teal-400"
      : "hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
  }`
  const pendingTitle =
    "Student is still taking this assessment. Results will be available after they submit."

  if (inProgress) {
    return (
      <div className={`flex items-center gap-1.5 ${compact ? "justify-end" : ""}`}>
        <Button
          variant="outline"
          size="icon"
          disabled
          title={pendingTitle}
          aria-label="Pending — student still taking assessment"
          className={`${viewBtnClass} text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-700/50 bg-amber-50/60 dark:bg-amber-950/20 cursor-not-allowed opacity-100`}
        >
          <Clock className={iconSize} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          disabled
          title="Cannot delete while the student is still taking this assessment."
          aria-label="Delete unavailable while in progress"
          className={`${btnSize} p-0 shrink-0 border-slate-200 text-slate-400 cursor-not-allowed opacity-60 transition-all rounded-lg`}
        >
          <Trash2 className={iconSize} />
        </Button>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-1.5 ${compact ? "justify-end" : ""}`}>
      {canSetFinalGrade && !result.is_final_grade && onSetFinalGrade ? (
        <Button
          variant="outline"
          size="icon"
          disabled={settingFinalAttemptId === result.attempt_id}
          title="Use this attempt for the student's grade"
          aria-label="Use for grade"
          onClick={() => onSetFinalGrade(result.attempt_id)}
          className={`border-emerald-200 dark:border-emerald-700/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-300 text-emerald-700 dark:text-emerald-300 transition-all rounded-lg shrink-0 ${btnSize} p-0`}
        >
          {settingFinalAttemptId === result.attempt_id ? (
            <Loader2 className={`${iconSize} animate-spin`} />
          ) : (
            <Star className={iconSize} />
          )}
        </Button>
      ) : null}
      <Link href={`${resultsBase}/results/${result.attempt_id}`} title="View results">
        <Button
          variant="outline"
          size="icon"
          aria-label="View results"
          className={viewBtnClass}
        >
          <Eye className={iconSize} />
        </Button>
      </Link>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onDelete(result.attempt_id)}
        title="Delete result"
        aria-label="Delete result"
        className={`${btnSize} p-0 shrink-0 border-slate-200 hover:bg-red-50 hover:border-red-300 text-red-600 hover:text-red-700 transition-all rounded-lg`}
      >
        <Trash2 className={iconSize} />
      </Button>
    </div>
  )
}

function escapeCsvCell(v: unknown): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`
}

/** Same logical rows as the filtered results table (section + assessment + menu filters, retakes toggle, etc.). */
function buildFilteredResultsCsv(rows: Result[]): string {
  const headers = [
    "Student Name",
    "Student ID",
    "Section",
    "Assessment Title",
    "Assessment Type",
    "Score",
    "Total Questions",
    "Percentage",
    "Status",
    "Completed At",
    "Attempt ID",
  ]
  const statusLabel: Record<ResultReviewStatus, string> = {
    in_progress: "In Progress",
    saved_for_later: "Saved for Later",
    pending: "Pending",
    finalized: "Finalized",
    flagged: "Flagged",
    open: "Open",
  }
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        escapeCsvCell(r.student_name),
        escapeCsvCell(r.student_id),
        escapeCsvCell(r.section),
        escapeCsvCell(r.quiz_title),
        escapeCsvCell(r.assessment_type),
        escapeCsvCell(r.score),
        escapeCsvCell(r.total_questions),
        escapeCsvCell(formatResultsViewerGradePercent(r)),
        escapeCsvCell(statusLabel[getResultReviewStatus(r)]),
        escapeCsvCell(r.completed_at),
        escapeCsvCell(r.attempt_id),
      ].join(","),
    ),
  ]
  return lines.join("\n")
}

const RESULTS_MENU_TO_TYPE: Record<string, string> = {
  quizzes: "quiz",
  homeworks: "homework",
  "mid-semester": "mid_semester",
  finals: "final",
  all: "all",
}

/** Side menu drives assessment type; flagged view uses the Assessment Type dropdown. */
function getResultsFilterAssessmentType(activeMenu: string, selectedAssessmentType: string): string {
  if (activeMenu === "flagged") {
    return selectedAssessmentType || "all"
  }
  const fromMenu = RESULTS_MENU_TO_TYPE[activeMenu]
  if (fromMenu && fromMenu !== "all") {
    return fromMenu
  }
  return selectedAssessmentType || "all"
}

function resultMatchesAssessmentType(resultType: string | undefined, expectedType: string): boolean {
  if (expectedType === "all") return true
  const t = resultType ?? ""
  if (expectedType === "mid_semester") return t === "mid_semester" || t === "midsem"
  return t === expectedType
}

interface ResultsViewerProps {
  userType?: "admin" | "instructor"
  /** When true, use dashboard-v2 base path for links */
  embedInDashboard?: boolean
  /** When true, render inside the unified analytics hub (no duplicate analytics nav) */
  embedInHub?: boolean
}

const getResultsBase = (userType: "admin" | "instructor", embedInDashboard?: boolean) =>
  userType === "admin" ? "/admin" : embedInDashboard ? "/faculty/dashboard" : "/instructor"

export function ResultsViewer({
  userType = "admin",
  embedInDashboard,
  embedInHub,
}: ResultsViewerProps = {}) {
  const fp = embedInHub ? facultyEmbedChrome("results").p : getFacultyModuleTheme("results").page

  const resultsBase = getResultsBase(userType, embedInDashboard)
  const router = useRouter()
  const { toast } = useToast()
  const { courseScopeVersion } = useInstructorDashboardV2()
  const { codes: catalogCodes, labelByCode, entries: sessionCatalogEntries } = useSessionCatalog()
  const catalogCodeSet = useMemo(() => new Set(catalogCodes), [catalogCodes])
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [allQuizzes, setAllQuizzes] = useState<Quiz[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [allResults, setAllResults] = useState<Result[]>([])
  const [resultsCache, setResultsCache] = useState<Result[] | null>(null) // Fetched once, filtered client-side
  const [loading, setLoading] = useState(true)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  
  // Side menu state
  const storageScope = embedInHub ? "hub" : embedInDashboard ? "dash" : "legacy"
  const [activeMenu, setActiveMenu] = usePersistedState<string>(
    `${userType}-results-menu-${storageScope}`,
    "quizzes",
    "local"
  )

  useEffect(() => {
    if (embedInHub && activeMenu === "analytics") {
      setActiveMenu("all")
    }
  }, [embedInHub, activeMenu, setActiveMenu])

  // Filter state (localStorage survives refresh and navigation away from this page)
  const [selectedSession, setSelectedSession] = usePersistedState<string>(
    `${userType}-results-session-${storageScope}`,
    "all",
    "local"
  )
  const [availableSessions, setAvailableSessions] = useState<string[]>([])
  const canvasExportSyncSection = useMemo(() => {
    if (selectedSession === "all") return "All"
    return unifySessionForFilterDropdown(selectedSession, catalogCodeSet)
  }, [selectedSession, catalogCodeSet])
  const [selectedAssessmentType, setSelectedAssessmentType] = usePersistedState<string>(
    `${userType}-results-type-${storageScope}`,
    "all",
    "local"
  )
  const [selectedQuiz, setSelectedQuiz] = usePersistedState<string>(
    `${userType}-results-quiz-${storageScope}`,
    "all",
    "local"
  )
  const [viewMode, setViewMode] = usePersistedState<"card" | "list">(
    `${userType}-results-view-${storageScope}`,
    "list",
    "local"
  )
  const [showRetakes, setShowRetakes] = usePersistedState(`${userType}-results-retakes-${storageScope}`, false, "local")
  const [settingFinalAttemptId, setSettingFinalAttemptId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = usePersistedState<string>(
    `${userType}-results-flagged-search-${storageScope}`,
    "",
    "local"
  )
  
  // Dialog state
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportZipBusy, setExportZipBusy] = useState(false)
  const [bulkFinalizing, setBulkFinalizing] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [deleteAttemptId, setDeleteAttemptId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deletedResult, setDeletedResult] = useState<Result | null>(null)
  const [deletingAttemptId, setDeletingAttemptId] = useState<number | null>(null)
  const [canvasExportRefreshing, setCanvasExportRefreshing] = useState(false)
  const [canvasExportRefreshKey, setCanvasExportRefreshKey] = useState(0)

  useScrollRestoration(`${userType}-results-${embedInDashboard ? "dash" : "legacy"}`)
  const [totalResults, setTotalResults] = useState(0)
  const [filteredCount, setFilteredCount] = useState(0)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = usePersistedState<number>(
    `${userType}-results-items-per-page-${storageScope}`,
    20,
    "local"
  )

  // Sort state - column and direction (asc/desc)
  type SortColumn = "student" | "score" | "grade" | "status" | "date"
  const [sortColumn, setSortColumn] = usePersistedState<SortColumn>(
    `${userType}-results-sort-column-${storageScope}`,
    "date",
    "local"
  )
  const [sortDirection, setSortDirection] = usePersistedState<"asc" | "desc">(
    `${userType}-results-sort-direction-${storageScope}`,
    "desc",
    "local"
  )

  usePreventBack(userType === "admin" ? "/admin/login" : "/instructor/login")

  const apiPrefix = useMemo(() => userType === "admin" ? "/api/admin" : "/api/instructor", [userType])

  const normalizeQuizAssessmentType = (raw: unknown): Quiz["assessment_type"] => {
    const t = String(raw ?? "quiz").toLowerCase()
    if (t === "midsem" || t === "mid_semester") return "mid_semester"
    if (t === "finals" || t === "final") return "final"
    if (t === "homework") return "homework"
    return "quiz"
  }

  const fetchQuizzes = useCallback(async (signal?: AbortSignal) => {
    try {
      const instructorId = userType === 'admin' ? '1' : localStorage.getItem('instructorId') || '1'
      const instructorHeaders: Record<string, string> =
        userType === "instructor" ? buildInstructorAuthorizedApiHeaders() : {}
      
      const allQuizzesData: Quiz[] = []
      
      if (userType === "instructor") {
        const response = await instructorApiFetch("/api/instructor/quizzes", {
          headers: instructorHeaders,
          signal,
        })
        if (signal?.aborted) return
        if (!response.ok) {
          console.error("[Results Viewer] quizzes fetch failed:", response.status)
          return
        }
        const data = await response.json()
        const list = data.quizzes || []
        for (const q of list) {
          allQuizzesData.push({
            ...q,
            assessment_type: normalizeQuizAssessmentType(q.assessment_type),
            session_access: q.session_access || {},
          })
        }
      } else {
        // Admin: use assessment-specific list routes
        const assessmentTypeMap: Record<string, string> = {
          'quiz': 'quiz',
          'mid_semester': 'midsem',
          'homework': 'homework',
          'final': 'final'
        }
        for (const [displayType, apiType] of Object.entries(assessmentTypeMap)) {
          try {
            const response = await fetch(`/api/${apiType}/list?instructorId=${instructorId}`, { signal })
            if (signal?.aborted) return
            const data = await response.json()
            if (data.assessments && data.assessments.length > 0) {
              const typedAssessments = data.assessments.map((q: any) => ({
                ...q,
                assessment_type: displayType
              }))
              allQuizzesData.push(...typedAssessments)
            }
          } catch (error) {
            if (signal?.aborted) return
            console.error(`Failed to fetch ${apiType}:`, error)
          }
        }
      }
      
      if (signal?.aborted) return
      setAllQuizzes(allQuizzesData)
      setQuizzes(allQuizzesData)
    } catch (error) {
      if (signal?.aborted) return
      console.error("[v0] Failed to fetch quizzes:", error)
    }
  }, [userType])

  const filterQuizzes = useCallback(() => {
    let filtered = [...allQuizzes]

    if (selectedSession !== "all") {
      filtered = filtered.filter((quiz) => {
        if (quiz.session_access) {
          for (const [k, v] of Object.entries(quiz.session_access)) {
            if (v && sectionsMatchForFilter(k, selectedSession, catalogCodeSet)) return true
          }
        }
        if (quiz.section && sectionsMatchForFilter(quiz.section, selectedSession, catalogCodeSet)) {
          return true
        }
        return false
      })
    }

    const effectiveType = getResultsFilterAssessmentType(activeMenu, selectedAssessmentType)
    if (effectiveType !== "all") {
      filtered = filtered.filter((quiz) => quiz.assessment_type === effectiveType)
    }

    setQuizzes(filtered)
  }, [allQuizzes, selectedSession, selectedAssessmentType, activeMenu, catalogCodeSet])

  // Union DB catalog with sections seen in results / quiz metadata (Canvas export + filters)
  useEffect(() => {
    if (userType === "instructor" && embedInDashboard) {
      setAvailableSessions([...catalogCodes].filter(Boolean).sort((a, b) => a.localeCompare(b)))
      return
    }
    const base = new Set<string>(catalogCodes)
    if (resultsCache && resultsCache.length > 0) {
      for (const r of resultsCache) {
        if (r.section) base.add(unifySessionForFilterDropdown(r.section, catalogCodeSet))
      }
    } else if (allQuizzes.length > 0) {
      for (const q of allQuizzes) {
        if (q.session_access) {
          for (const [k, v] of Object.entries(q.session_access)) {
            if (v) base.add(unifySessionForFilterDropdown(k, catalogCodeSet))
          }
        }
        if (q.section) base.add(unifySessionForFilterDropdown(q.section, catalogCodeSet))
      }
    }
    setAvailableSessions(Array.from(base).filter(Boolean).sort((a, b) => a.localeCompare(b)))
  }, [resultsCache, allQuizzes, catalogCodes, catalogCodeSet, userType, embedInDashboard])

  // Migrate persisted filter from legacy short codes (e.g. E1301P01) to canonical DB codes
  useEffect(() => {
    if (selectedSession === "all" || catalogCodes.length === 0) return
    const canon = SESSION_LEGACY_TO_CANONICAL[selectedSession]
    if (canon && catalogCodes.includes(canon)) {
      setSelectedSession(canon)
    }
  }, [catalogCodes, selectedSession, setSelectedSession])

  // Fetch ALL results once (all 4 types) - no refetch on menu/filter change
  const fetchAllResultsOnce = useCallback(async (): Promise<{ ok: boolean; count: number }> => {
    setLoading(true)
    try {
      const headers: Record<string, string> =
        userType === "instructor"
          ? buildInstructorAuthorizedApiHeaders()
          : {}
      if (userType === "admin") {
        const adminSession = sessionStorage.getItem("adminSession") || ""
        const adminId = sessionStorage.getItem("adminId") || ""
        if (adminSession) headers["Authorization"] = adminSession
        if (adminId) headers["x-admin-id"] = adminId
      }

      const typeMap: Record<string, string> = {
        'quiz': 'quiz',
        'mid_semester': 'midsem',
        'homework': 'homework',
        'final': 'final'
      }
      const entries = Object.entries(typeMap) as [string, string][]

      // Fetch all 4 types in parallel with showRetakes=true (get all attempts for client-side filtering)
      const urls = entries.map(([displayType, apiType]) =>
        userType === "instructor"
          ? `${apiPrefix}/results?assessment_type=${displayType}&showRetakes=true`
          : `/api/${apiType}/results?showRetakes=true`
      )

      const responses = await Promise.all(
        urls.map((url) => fetch(url, { headers, cache: "no-store" })),
      )
      let allResults: Result[] = []

      for (let i = 0; i < responses.length; i++) {
        const res = responses[i]
        const [displayType] = entries[i]
        if (!res.ok) continue
        const data = await res.json()
        if (data.error || !data.results) continue
        const typed = (data.results || []).map((r: any) => ({
          ...r,
          assessment_type: displayType,
          quiz_title: r.assessment_title || r.quiz_title || r.title
        }))
        allResults.push(...typed)
      }

      const unique = Array.from(new Map(allResults.map(r => [r.attempt_id, r])).values())
      setResultsCache(unique)
      setAllResults(unique)
      return { ok: true, count: unique.length }
    } catch (error) {
      console.error("[Results Viewer] Failed to fetch results:", error)
      setResultsCache([])
      setAllResults([])
      return { ok: false, count: 0 }
    } finally {
      setLoading(false)
    }
  }, [apiPrefix, userType])

  const handleCanvasExportRefresh = useCallback(async () => {
    setCanvasExportRefreshing(true)
    try {
      await fetchQuizzes()
      setResultsCache(null)
      await fetchAllResultsOnce()
      setCanvasExportRefreshKey((k) => k + 1)
    } catch (e) {
      console.error("[Results Viewer] Canvas export refresh failed:", e)
      toast({
        title: "Refresh failed",
        description: e instanceof Error ? e.message : "Could not reload export data.",
        variant: "destructive",
      })
    } finally {
      setCanvasExportRefreshing(false)
    }
  }, [fetchQuizzes, fetchAllResultsOnce, toast])

  // Filter from cache - no fetch. Runs when cache, menu, or filters change.
  const applyFiltersFromCache = useCallback(() => {
    const cache = resultsCache
    if (!cache) return

    const expectedType = getResultsFilterAssessmentType(activeMenu, selectedAssessmentType)

    let filtered = cache

    // Filter by flagged (PND, failed grading, requires_review — via API is_flagged — or violation_log)
    if (activeMenu === "flagged") {
      filtered = filtered.filter((r) => isAttemptFlaggedForReview(r))
      if (expectedType !== "all") {
        filtered = filtered.filter((r) => resultMatchesAssessmentType(r.assessment_type, expectedType))
      }
    }

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      filtered = filtered.filter((r) => {
        const name = (r.student_name || "").toLowerCase()
        const id = (r.student_id || "").toLowerCase()
        const title = ((r.quiz_title || r.assessment_title || "") || "").toLowerCase()
        return name.includes(q) || id.includes(q) || title.includes(q)
      })
    }

    // Filter by assessment type (menu) - for non-flagged menus
    if (expectedType && expectedType !== 'all' && expectedType !== 'flagged') {
      filtered = filtered.filter((r) => resultMatchesAssessmentType(r.assessment_type, expectedType))
    }

    // Filter by session
    if (selectedSession !== "all") {
      filtered = filtered.filter((r) => sectionsMatchForFilter(r.section, selectedSession, catalogCodeSet))
    }

    // Filter by assessment (quiz)
    if (selectedQuiz !== "all") {
      const quizId = Number(selectedQuiz)
      filtered = filtered.filter(
        (r) => Number(r.assessment_id ?? (r as { quiz_id?: number }).quiz_id) === quizId,
      )
    }

    // Filter by showRetakes (client-side: show only final grade when false)
    if (!showRetakes) {
      filtered = filtered.filter(r => r.is_final_grade === true)
    } else {
      filtered = filtered.map((r) => ({
        ...r,
        is_retake: r.is_final_grade !== true,
      }))
    }

    const unique = Array.from(new Map(filtered.map(r => [r.attempt_id, r])).values())
    setResults(unique)
    setTotalResults(unique.length)
    setFilteredCount(unique.length)
  }, [resultsCache, activeMenu, selectedAssessmentType, selectedSession, selectedQuiz, showRetakes, searchQuery, catalogCodeSet])

  const hiddenRetakeCount = useMemo(() => {
    if (!resultsCache || showRetakes) return 0

    const expectedType = getResultsFilterAssessmentType(activeMenu, selectedAssessmentType)
    let filtered = resultsCache

    if (activeMenu === "flagged") {
      filtered = filtered.filter((r) => isAttemptFlaggedForReview(r))
      if (expectedType !== "all") {
        filtered = filtered.filter((r) => resultMatchesAssessmentType(r.assessment_type, expectedType))
      }
    }

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      filtered = filtered.filter((r) => {
        const name = (r.student_name || "").toLowerCase()
        const id = (r.student_id || "").toLowerCase()
        const title = ((r.quiz_title || r.assessment_title || "") || "").toLowerCase()
        return name.includes(q) || id.includes(q) || title.includes(q)
      })
    }

    if (expectedType && expectedType !== "all" && expectedType !== "flagged") {
      filtered = filtered.filter((r) => resultMatchesAssessmentType(r.assessment_type, expectedType))
    }

    if (selectedSession !== "all") {
      filtered = filtered.filter((r) => sectionsMatchForFilter(r.section, selectedSession, catalogCodeSet))
    }

    if (selectedQuiz !== "all") {
      const quizId = Number(selectedQuiz)
      filtered = filtered.filter(
        (r) => Number(r.assessment_id ?? (r as { quiz_id?: number }).quiz_id) === quizId,
      )
    }

    return filtered.filter((r) => r.is_final_grade !== true).length
  }, [
    resultsCache,
    showRetakes,
    activeMenu,
    selectedAssessmentType,
    selectedSession,
    selectedQuiz,
    searchQuery,
    catalogCodeSet,
  ])

  // Legacy fetchResults for deleted/clear/restore flows - refetches all
  const fetchResults = useCallback(() => fetchAllResultsOnce(), [fetchAllResultsOnce])

  const handleRefreshResults = useCallback(async () => {
    if (loading) return
    setRefreshError(null)
    const outcome = await fetchAllResultsOnce()
    if (!outcome.ok) {
      setRefreshError("Could not refresh")
      window.setTimeout(() => setRefreshError(null), 4000)
    }
  }, [loading, fetchAllResultsOnce])

  const handleSetFinalGrade = useCallback(
    async (attemptId: number) => {
      if (settingFinalAttemptId != null) return
      setSettingFinalAttemptId(attemptId)
      try {
        const res = await instructorApiFetch("/api/instructor/results/select-final-attempt", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(userType === "instructor" ? buildInstructorAuthorizedApiHeaders() : {}),
            ...(userType === "admin"
              ? {
                  Authorization: sessionStorage.getItem("adminSession") || "",
                  "x-admin-id": sessionStorage.getItem("adminId") || "",
                }
              : {}),
          },
          body: JSON.stringify({ attemptId }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data.error || "Failed to set grade attempt")
        }
        toast({
          title: "Grade attempt updated",
          description: "The student's recorded score now uses this attempt.",
        })
        setResultsCache(null)
        await fetchAllResultsOnce()
      } catch (e) {
        toast({
          title: "Could not set grade attempt",
          description: e instanceof Error ? e.message : "Try again.",
          variant: "destructive",
        })
      } finally {
        setSettingFinalAttemptId(null)
      }
    },
    [userType, settingFinalAttemptId, fetchAllResultsOnce, toast],
  )


  const handleBulkFinalizeResults = useCallback(async () => {
    if (bulkFinalizing || userType === "admin") return
    const pendingIds = results
      .filter(
        (r) =>
          r.attempt_id &&
          !r.results_finalized &&
          !isAttemptInProgress(r) &&
          !isAttemptPaused(r) &&
          !resultShouldShowPnd(r),
      )
      .map((r) => Number(r.attempt_id))
      .filter((id) => Number.isFinite(id) && id > 0)
    if (pendingIds.length === 0) {
      toast({
        title: "Nothing to finalize",
        description: "All visible submitted results are already finalized or pending grading.",
      })
      return
    }
    setBulkFinalizing(true)
    try {
      const res = await instructorApiFetch("/api/instructor/results/bulk-finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildInstructorAuthorizedApiHeaders(),
        },
        body: JSON.stringify({ attemptIds: pendingIds }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Bulk finalize failed")
      toast({
        title: "Grades released",
        description: data.message || `Finalized ${data.finalized ?? pendingIds.length} results.`,
      })
      setResultsCache(null)
      await fetchAllResultsOnce()
    } catch (e) {
      toast({
        title: "Bulk finalize failed",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setBulkFinalizing(false)
    }
  }, [bulkFinalizing, userType, results, toast, fetchAllResultsOnce])

  const isManualRefresh = loading && resultsCache !== null

  // Initial data fetch - only once on mount (dashboard course-scope effect handles embedInDashboard)
  useEffect(() => {
    if (userType === "admin") {
      const adminId = sessionStorage.getItem("adminId")
      if (!adminId) {
        router.push("/admin/login")
        return
      }
    } else {
      const instructorSession = localStorage.getItem("instructorSession")
      if (!instructorSession) {
        router.push("/instructor/login")
        return
      }
    }

    if (userType === "instructor" && embedInDashboard) return

    const controller = new AbortController()
    void fetchQuizzes(controller.signal)
    return () => controller.abort()
  }, [router, userType, embedInDashboard, fetchQuizzes])

  useEffect(() => {
    if (userType !== "instructor" || !embedInDashboard) return
    if (courseScopeVersion === 0) return
    setResultsCache(null)
    setAllResults([])
    setResults([])
    setSelectedSession("all")
    setSelectedQuiz("all")
    const controller = new AbortController()
    void fetchQuizzes(controller.signal)
    return () => controller.abort()
  }, [
    courseScopeVersion,
    userType,
    embedInDashboard,
    fetchQuizzes,
    setSelectedSession,
    setSelectedQuiz,
  ])

  useEffect(() => {
    if (userType !== "instructor" || !embedInDashboard || catalogCodes.length === 0) return
    if (selectedSession === "all") return
    const canon = unifySessionForFilterDropdown(selectedSession, catalogCodeSet)
    if (!catalogCodes.includes(selectedSession) && !catalogCodes.includes(canon)) {
      setSelectedSession("all")
    }
  }, [catalogCodes, selectedSession, catalogCodeSet, userType, embedInDashboard, setSelectedSession])

  useEffect(() => {
    if (activeMenu === "canvas-export" && userType !== "instructor") {
      setActiveMenu("all")
    }
  }, [activeMenu, userType])
  
  // Update assessment type filter when menu changes
  // Use startTransition to mark this as non-urgent to prevent blocking UI
  useEffect(() => {
    startTransition(() => {
      if (activeMenu === "quizzes") {
        setSelectedAssessmentType("quiz")
      } else if (activeMenu === "homeworks") {
        setSelectedAssessmentType("homework")
      } else if (activeMenu === "mid-semester") {
        setSelectedAssessmentType("mid_semester")
      } else if (activeMenu === "finals") {
        setSelectedAssessmentType("final")
      } else if (activeMenu === "all") {
        setSelectedAssessmentType("all")
      } else if (activeMenu === "flagged") {
        setSelectedAssessmentType("all")
      }
      // Reset quiz selection when menu changes
      setSelectedQuiz("all")
      // Reset to page 1 when menu changes
      setCurrentPage(1)
    })
  }, [activeMenu])
  
  // Reset to page 1 when filters or sort change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedSession, selectedQuiz, showRetakes, itemsPerPage, sortColumn, sortDirection, searchQuery, selectedAssessmentType])

  // Filter quizzes when session, menu, or assessment type changes (UI only, no fetch)
  useEffect(() => {
    startTransition(() => {
      filterQuizzes()
    })
  }, [selectedSession, selectedAssessmentType, activeMenu, allQuizzes, filterQuizzes])

  // Clear stale assessment selection when it is not in the filtered list for the active menu
  useEffect(() => {
    if (selectedQuiz === "all") return
    const quizId = Number(selectedQuiz)
    if (!Number.isFinite(quizId)) {
      setSelectedQuiz("all")
      return
    }
    if (!quizzes.some((q) => Number(q.id) === quizId)) {
      setSelectedQuiz("all")
    }
  }, [quizzes, selectedQuiz, setSelectedQuiz])

  // Reset quiz selection when session or assessment type changes (but not when menu changes)
  useEffect(() => {
    if (activeMenu !== "analytics" && activeMenu !== "deleted" && activeMenu !== "canvas-export") {
      startTransition(() => {
        setSelectedQuiz("all")
      })
    }
  }, [selectedSession, selectedAssessmentType, activeMenu])

  const fetchDeletedResults = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedSession !== "all") params.append("section", selectedSession)
      if (selectedAssessmentType !== "all") params.append("assessmentType", selectedAssessmentType)
      
      const response = await fetch(`${apiPrefix}/results/deleted?${params.toString()}`, {
        headers: userType === "instructor" ? buildInstructorAuthorizedApiHeaders() : undefined,
      })
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      const deletedResults = (data.results || []).map((r: any) => ({
        ...r,
        quiz_title: r.assessment_title || r.quiz_title || r.title,
        assessment_type: r.assessment_type || 'quiz',
        is_deleted: true
      }))
      
      // Deduplicate deleted results by attempt_id to prevent duplicate key errors
      const uniqueDeletedResults = Array.from(
        new Map(deletedResults.map(r => [r.attempt_id, r])).values()
      )
      
      setResults(uniqueDeletedResults)
      setTotalResults(uniqueDeletedResults.length)
      setFilteredCount(uniqueDeletedResults.length)
    } catch (error) {
      console.error("[Results Viewer] Failed to fetch deleted results:", error)
      setResults([])
      setTotalResults(0)
      setFilteredCount(0)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch deleted results",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [selectedSession, selectedAssessmentType, apiPrefix, toast, userType])

  const handleRestoreResult = async (attemptId: number) => {
    try {
      const response = await fetch(`${apiPrefix}/results/deleted`, {
        method: "POST",
        headers:
          userType === "instructor"
            ? { ...buildInstructorAuthorizedApiHeaders(), "Content-Type": "application/json" }
            : { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to restore result")
      }

      toast({
        title: "✅ Result restored",
        description: "The result has been restored and is now visible in the results list.",
      })

      // Refresh deleted results
      fetchDeletedResults()
      // Also refresh main results to show the restored item
      fetchResults()
    } catch (error) {
      console.error("[Results Viewer] Failed to restore result:", error)
      toast({
        title: "❌ Restore failed",
        description: error instanceof Error ? error.message : "Failed to restore result",
        variant: "destructive",
      })
    }
  }

  // Initial fetch: load all results once (independent of quiz metadata for filters)
  useEffect(() => {
    if (activeMenu === "analytics" || activeMenu === "deleted" || activeMenu === "canvas-export") return
    if (resultsCache !== null) return // Already fetched
    void fetchAllResultsOnce()
  }, [activeMenu, resultsCache, fetchAllResultsOnce])

  // Deleted menu: fetch when switching to deleted
  useEffect(() => {
    if (activeMenu === "deleted") fetchDeletedResults()
  }, [activeMenu, fetchDeletedResults])

  // Apply filters from cache when cache or filters change (no refetch)
  useEffect(() => {
    if (activeMenu === "analytics" || activeMenu === "deleted" || activeMenu === "canvas-export") return
    applyFiltersFromCache()
  }, [activeMenu, applyFiltersFromCache])

  const exportAuthHeaders = useCallback((): HeadersInit => {
    if (userType === "instructor") {
      return buildInstructorAuthorizedApiHeaders()
    }
    const h: HeadersInit = {}
    if (userType === "admin") {
      const id = typeof window !== "undefined" ? sessionStorage.getItem("adminId") : null
      if (id) h["x-admin-id"] = id
    }
    return h
  }, [userType])

  const computeExportBasenames = useCallback(() => {
    const sessionPart =
      selectedSession === "all"
        ? "all-sessions"
        : unifySessionForFilterDropdown(selectedSession, catalogCodeSet)
    const assessmentTitle =
      selectedQuiz === "all"
        ? "all-assessments"
        : quizzes.find((q) => String(q.id) === selectedQuiz)?.title ||
          results[0]?.quiz_title ||
          "assessment"
    const fileBase = buildSessionAssessmentExportBasename(sessionPart, assessmentTitle)
    return { sessionPart, assessmentTitle, fileBase }
  }, [selectedSession, catalogCodeSet, selectedQuiz, quizzes, results])

  /** CSV + ZIP use the same filtered row set as the table; requires explicit section + assessment picks. */
  const exportFiltersReady = selectedSession !== "all" && selectedQuiz !== "all"

  const handleExportCsv = () => {
    if (!exportFiltersReady) {
      toast({
        title: "Choose filters first",
        description: "Select a section and one assessment in Filters so the file matches what you see in the table.",
        variant: "destructive",
      })
      return
    }
    if (results.length === 0) {
      toast({
        title: "Nothing to export",
        description: "No attempts match the current filters. Adjust Filters or enable retakes if needed.",
        variant: "destructive",
      })
      return
    }
    try {
      const csv = `\ufeff${buildFilteredResultsCsv(results)}`
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
      const { fileBase } = computeExportBasenames()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${fileBase}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Results exported",
        description: `Saved as ${fileBase}.csv (${results.length} row${results.length === 1 ? "" : "s"}, matches Filters).`,
      })
      setShowExportModal(false)
    } catch (error) {
      console.error("[v0] Failed to export results:", error)
      toast({
        title: "Failed to export results",
        description: error instanceof Error ? error.message : "An error occurred while exporting the results. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleExportZipWithPdfs = async () => {
    if (!exportFiltersReady) {
      toast({
        title: "Choose filters first",
        description: "Select a section and one assessment in Filters so the ZIP matches the table.",
        variant: "destructive",
      })
      return
    }
    if (results.length === 0) {
      toast({
        title: "Nothing to export",
        description: "No rows match the current filters.",
        variant: "destructive",
      })
      return
    }

    setExportZipBusy(true)
    try {
      const { fileBase, assessmentTitle } = computeExportBasenames()
      const JSZip = (await import("jszip")).default
      const zip = new JSZip()
      const pdfsFolder = zip.folder("pdfs")
      if (!pdfsFolder) throw new Error("Could not create zip folder")

      const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
      const manifestLines: string[] = [
        ["Student Name", "Student ID", "Session", "Assessment Name", "PDF File", "Attempt ID"].join(","),
      ]

      let ok = 0
      let failed = 0

      for (const row of results) {
        const attemptId = row.attempt_id
        try {
          const viewRes = await fetch(`${apiPrefix}/results/${attemptId}/view`, {
            headers: { ...exportAuthHeaders() },
            cache: "no-store",
          })
          const payload = await viewRes.json()
          if (!viewRes.ok) {
            failed++
            manifestLines.push(
              [
                esc(row.student_name),
                esc(row.student_id),
                esc(row.section),
                esc(assessmentTitle),
                esc("ERROR"),
                esc(attemptId),
              ].join(","),
            )
            continue
          }
          if (!payload.questions || !Array.isArray(payload.questions)) {
            payload.questions = []
          }
          const atype =
            row.assessment_type ??
            (selectedAssessmentType !== "all" ? selectedAssessmentType : "quiz")
          const pdfName = getResultsPdfFilenameForZip(payload, atype, row.attempt_id)
          const pdfBuf = await generateQuizResultsPdfArrayBuffer(payload, atype)
          pdfsFolder.file(pdfName, pdfBuf)
          ok++
          manifestLines.push(
            [
              esc(payload.student_name || row.student_name),
              esc(payload.student_id || row.student_id),
              esc(payload.section || row.section),
              esc(payload.quiz_title || assessmentTitle),
              esc(`pdfs/${pdfName}`),
              esc(attemptId),
            ].join(","),
          )
        } catch (e) {
          console.error("[Export ZIP] attempt", attemptId, e)
          failed++
          manifestLines.push(
            [
              esc(row.student_name),
              esc(row.student_id),
              esc(row.section),
              esc(assessmentTitle),
              esc("ERROR"),
              esc(attemptId),
            ].join(","),
          )
        }
      }

      zip.file("manifest.csv", manifestLines.join("\n"))
      const blob = await zip.generateAsync({ type: "blob" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${fileBase}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "ZIP downloaded",
        description: `${ok} PDF(s) packaged${failed ? `, ${failed} failed — see manifest.csv` : ""}. (${fileBase}.zip) Same rows as the filtered table.`,
      })
      setShowExportModal(false)
    } catch (error) {
      console.error("[Export ZIP] Failed:", error)
      toast({
        title: "ZIP export failed",
        description: error instanceof Error ? error.message : "Could not build the archive.",
        variant: "destructive",
      })
    } finally {
      setExportZipBusy(false)
    }
  }

  const handleDeleteResult = async (attemptId: number) => {
    setDeleting(true)
    setDeletingAttemptId(attemptId)

    const resultToDelete = results.find(r => r.attempt_id === attemptId)
    if (resultToDelete) {
      setDeletedResult(resultToDelete)
    }

    // Optimistic update - remove from UI and cache
    setResults(prevResults => prevResults.filter(r => r.attempt_id !== attemptId))
    setAllResults(prevResults => prevResults.filter(r => r.attempt_id !== attemptId))
    setResultsCache(prev => prev ? prev.filter(r => r.attempt_id !== attemptId) : null)

    try {
      const response = await fetch(`${apiPrefix}/results/${attemptId}`, {
        method: "DELETE",
        headers: userType === "instructor" ? buildInstructorAuthorizedApiHeaders() : undefined,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete result")
      }

      toast({
        title: "✅ Result moved to trash",
        description: `${resultToDelete?.student_name}'s result has been moved to trash. You can restore it from the Deleted Items menu.`,
      })

      setDeleteAttemptId(null)
      
      // No need to refetch - optimistic update is sufficient
      // Only refetch if we need to sync with server (e.g., for counts)
      // But since we're updating allResults, menu counts will update automatically
      
      setTimeout(() => {
        setDeletedResult(null)
      }, 5000)
    } catch (error) {
      console.error("[v0] Failed to delete result:", error)
      // Restore the result if deletion failed
      if (resultToDelete) {
        setResults(prevResults => [...prevResults, resultToDelete])
        setAllResults(prevResults => [...prevResults, resultToDelete])
      }
      
      toast({
        title: "❌ Failed to delete result",
        description: error instanceof Error ? error.message : "An error occurred while deleting the result.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
      setDeletingAttemptId(null)
    }
  }

  const handleClearAllResults = async () => {
    setClearing(true)

    try {
      // "Clear All" should clear ALL results, ignoring current filters
      // Only include filters if the dialog text indicates filtered clearing
      const params = new URLSearchParams()
      // Don't send any filters - clear ALL results regardless of current view
      
      const queryString = params.toString()
      const url = `${apiPrefix}/results/clear${queryString ? `?${queryString}` : ''}`
      
      console.log('[Clear All Results] Frontend - Starting clear operation')
      console.log('[Clear All Results] Frontend - Current results count:', results.length)
      console.log('[Clear All Results] Frontend - Clearing ALL results (ignoring filters)')
      console.log('[Clear All Results] Frontend - Request URL:', url)
      
      const response = await fetch(url, {
        method: "DELETE",
        headers: userType === "instructor" ? buildInstructorAuthorizedApiHeaders() : undefined,
      })

      const data = await response.json()
      
      console.log('[Clear All Results] Frontend - Response status:', response.status)
      console.log('[Clear All Results] Frontend - Response data:', data)

      if (!response.ok) {
        throw new Error(data.error || "Failed to clear results")
      }

      console.log('[Clear All Results] Frontend - Success! Deleted count:', data.deletedCount)
      console.log('[Clear All Results] Frontend - Soft deleted:', data.softDeleted)

      toast({
        title: data.softDeleted ? "✅ Results moved to trash" : "✅ Results deleted",
        description: data.softDeleted 
          ? `${data.deletedCount} result(s) have been moved to trash. You can restore them from the Deleted Items menu.`
          : `${data.deletedCount} result(s) have been permanently deleted.`,
      })

      setShowClearDialog(false)
      
      // Clear local state and cache
      const previousCount = results.length
      setResults([])
      setAllResults([])
      setResultsCache(null)
      setTotalResults(0)
      setFilteredCount(0)
      
      // Refetch to verify deletion
      console.log('[Clear All Results] Frontend - Refetching results to verify deletion')
      console.log('[Clear All Results] Frontend - Previous results count:', previousCount)
      await fetchResults()
      console.log('[Clear All Results] Frontend - Refetch complete. Check results state for new count.')
    } catch (error) {
      console.error("[Clear All Results] Frontend - Failed to clear results:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to clear results",
        variant: "destructive",
      })
    } finally {
      setClearing(false)
    }
  }

  // Get menu item counts - count results by assessment type, respecting showRetakes
  // When showRetakes is false, count only is_final_grade so count matches displayed list
  const menuCounts = useMemo(() => {
    const resultsToCount = allResults.length > 0 ? allResults : results
    const filtered = !showRetakes
      ? resultsToCount.filter((r) => r.is_final_grade === true)
      : resultsToCount

    const counts = {
      quizzes: 0,
      homeworks: 0,
      'mid-semester': 0,
      finals: 0,
      flagged: 0,
    }
    filtered.forEach((result) => {
      const type = result.assessment_type
      if (type === 'quiz') counts.quizzes++
      else if (type === 'homework') counts.homeworks++
      else if (type === 'mid_semester' || type === 'midsem') counts['mid-semester']++
      else if (type === 'final') counts.finals++
      if (isAttemptFlaggedForReview(result)) counts.flagged++
    })
    return counts
  }, [allResults, results, showRetakes])

  // Render results content - extracted from IIFE to fix JSX parsing issues
  const renderResultsContent = () => {
    if (activeMenu === "canvas-export") return null

    // Loading state: show in table area, not at top
    if (loading) {
      return (
        <div className="bg-white/80 dark:bg-white/[0.02] backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.08] rounded-xl sm:rounded-2xl shadow-sm overflow-hidden min-w-0 max-w-full min-h-[320px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 py-12">
            <div className={`relative w-10 h-10 ${embedInDashboard ? "border-teal-200 dark:border-teal-500/30 border-2 border-t-transparent" : "border-blue-200 border-2 border-t-transparent"} rounded-full animate-spin`} />
            <p className="text-sm text-slate-600 dark:text-slate-400">Loading results...</p>
          </div>
        </div>
      )
    }

    // Filter results by active menu to ensure correct assessment type
    const expectedType = getResultsFilterAssessmentType(activeMenu, selectedAssessmentType)
    let filteredResults =
      expectedType === "all"
        ? results
        : results.filter((r) => resultMatchesAssessmentType(r.assessment_type, expectedType))
    
    // Deduplicate filtered results by attempt_id to prevent duplicate key errors
    filteredResults = Array.from(
      new Map(filteredResults.map(r => [r.attempt_id, r])).values()
    )

    // Sort results — when showing all attempts, group by student + assessment + attempt #
    const retakeGroupCompare = (a: Result, b: Result) => {
      const nameCmp = (a.student_name || "").localeCompare(b.student_name || "", undefined, {
        sensitivity: "base",
      })
      if (nameCmp !== 0) return nameCmp
      const quizA = Number(a.assessment_id ?? (a as { quiz_id?: number }).quiz_id ?? 0)
      const quizB = Number(b.assessment_id ?? (b as { quiz_id?: number }).quiz_id ?? 0)
      if (quizA !== quizB) return quizA - quizB
      return (a.attempt_number ?? 0) - (b.attempt_number ?? 0)
    }

    const sorted = [...filteredResults].sort((a, b) => {
      if (showRetakes) {
        const grouped = retakeGroupCompare(a, b)
        if (grouped !== 0) return grouped
      }
      const mult = sortDirection === "asc" ? 1 : -1
      switch (sortColumn) {
        case "student":
          return mult * (a.student_name || "").localeCompare(b.student_name || "", undefined, { sensitivity: "base" })
        case "score":
          return mult * ((a.score ?? 0) - (b.score ?? 0))
        case "grade": {
          const pndA = resultShouldShowPnd(a)
          const pndB = resultShouldShowPnd(b)
          if (pndA !== pndB) {
            if (sortDirection === "asc") return pndA ? -1 : 1
            return pndA ? 1 : -1
          }
          return mult * ((Number(a.percentage ?? 0) - Number(b.percentage ?? 0)))
        }
        case "status":
          return (
            mult *
            (RESULT_STATUS_SORT_RANK[getResultReviewStatus(a)] -
              RESULT_STATUS_SORT_RANK[getResultReviewStatus(b)])
          )
        case "date": {
          const ta = a.completed_at ? new Date(a.completed_at).getTime() : 0
          const tb = b.completed_at ? new Date(b.completed_at).getTime() : 0
          return mult * (ta - tb)
        }
        default:
          return 0
      }
    })
    filteredResults = sorted

    // Pagination calculations
    const totalPages = Math.ceil(filteredResults.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedResults = filteredResults.slice(startIndex, endIndex)
    
    if (!loading && filteredResults.length === 0) {
      return (
        <div className="bg-white/80 dark:bg-white/[0.02] backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.08] rounded-xl sm:rounded-2xl shadow-sm p-12 text-center">
          <div className={`p-4 rounded-2xl w-20 h-20 mx-auto mb-4 flex items-center justify-center ${embedInDashboard ? fp.iconBg : fp.iconBg}`}>
            <TrendingUp className={`h-10 w-10 ${embedInDashboard ? "text-teal-600 dark:text-teal-400" : "text-blue-600"}`} />
          </div>
          <p className="text-slate-600 dark:text-slate-400 mb-4">No results found for {activeMenu === 'all' ? 'all assessment types' : activeMenu === 'flagged' ? 'flagged attempts' : activeMenu}</p>
        </div>
      )
    }

    // Persisted viewMode can be corrupted; avoid returning null and blanking the page
    const safeViewMode: "card" | "list" = viewMode === "card" || viewMode === "list" ? viewMode : "list"

    const allAttemptsHelp =
      showRetakes && filteredResults.length > 0 ? (
        <div className="mb-4 rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-3 text-sm text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/25 dark:text-amber-100">
          <strong className="font-semibold">All attempts view.</strong> Rows tagged{" "}
          <span className="font-medium text-emerald-700 dark:text-emerald-300">Grade</span> are what Canvas and the
          gradebook use. PND% on <span className="font-medium">Extra</span> attempts does not change the recorded
          score unless you click the star to use that attempt for the grade, or open the attempt and use{" "}
          <span className="font-medium">Use for grade</span> there.
        </div>
      ) : !showRetakes && hiddenRetakeCount > 0 ? (
        <div className="mb-4 rounded-xl border border-sky-200/70 bg-sky-50/60 px-4 py-3 text-sm text-sky-950 dark:border-sky-800/50 dark:bg-sky-950/25 dark:text-sky-100">
          <strong className="font-semibold">{hiddenRetakeCount} extra attempt{hiddenRetakeCount === 1 ? "" : "s"} hidden.</strong>{" "}
          Switch to <span className="font-medium">All</span> to compare retakes and choose which attempt counts for
          each student&apos;s grade.
        </div>
      ) : null

    if (!loading && safeViewMode === "card") {
      return (
        <>
          {allAttemptsHelp}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedResults.map((result) => (
              <div 
                key={result.attempt_id} 
                className={`bg-white/80 dark:bg-white/[0.02] backdrop-blur-sm border rounded-xl sm:rounded-2xl shadow-sm transition-all group ${
                  result.is_retake 
                    ? "border-slate-300/60 dark:border-white/10 opacity-60 hover:border-slate-400 hover:opacity-80" 
                    : `border-slate-200/60 dark:border-white/[0.08] hover:shadow-lg ${embedInDashboard ? "hover:border-teal-300 dark:hover:border-teal-500/50" : "hover:border-blue-300"}`
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${embedInDashboard ? fp.iconBg : fp.iconBg}`}>
                        <Users className={`h-5 w-5 transition-all ${embedInDashboard ? "text-teal-600 dark:text-teal-400 group-hover:text-white" : "text-blue-600 dark:text-blue-400 group-hover:text-white"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 truncate">{result.student_name}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{result.student_id}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
                      <Badge className={`border-0 rounded-lg px-2.5 py-1 text-xs font-medium ${embedInDashboard ? cn(fp.softBg, fp.iconText) : cn(fp.softBg, fp.iconText)}`}>
                        {getSectionColumnHeading(result.section, labelByCode)}
                      </Badge>
                      <Badge className={`border-0 rounded-lg px-2.5 py-1 text-xs font-medium ${
                        showRetakes && result.is_final_grade
                          ? "bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-950/40 dark:to-emerald-950/40 text-green-700 dark:text-green-300"
                          : showRetakes && !result.is_final_grade
                          ? "bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-950/40 dark:to-amber-950/40 text-orange-700 dark:text-orange-300"
                          : result.is_final_grade 
                          ? "bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-950/40 dark:to-emerald-950/40 text-green-700 dark:text-green-300"
                          : result.is_retake
                          ? "bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-950/40 dark:to-amber-950/40 text-orange-700 dark:text-orange-300"
                          : "bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-950/40 dark:to-pink-950/40 text-purple-700 dark:text-purple-300"
                      }`}>
                        {showRetakes && result.is_final_grade
                          ? `Grade · Attempt ${result.attempt_number || 1}`
                          : showRetakes && !result.is_final_grade
                          ? `Extra · Attempt ${result.attempt_number || 1}`
                          : result.attempt_label || `Attempt ${result.attempt_number || 1}`}
                      </Badge>
                    </div>
                  </div>

                  <div className="mb-4 pb-4 border-b border-slate-100 dark:border-white/[0.08]">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{result.quiz_title}</p>
                  </div>

                    <div className={`rounded-xl p-4 mb-4 ${embedInDashboard ? fp.softBg : fp.softBg}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Score</p>
                        <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                          {Number(result.score || 0).toFixed(2)}/{result.total_possible_points ?? result.total_questions}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Grade</p>
                        <p
                          className={`text-2xl font-bold ${resultsViewerGradeColorClass(result)}`}
                        >
                          {formatResultsViewerGradePercent(result)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-600 dark:text-slate-400">Status</p>
                      <ResultStatusBadge result={result} />
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <Calendar className={`h-3.5 w-3.5 ${embedInDashboard ? "text-teal-500 dark:text-teal-400" : "text-blue-500"}`} />
                      <span>{formatAttemptStatusLabel(result)}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    <AttemptResultActions
                      result={result}
                      resultsBase={resultsBase}
                      embedInDashboard={embedInDashboard}
                      onDelete={setDeleteAttemptId}
                      compact
                      canSetFinalGrade={showRetakes}
                      onSetFinalGrade={handleSetFinalGrade}
                      settingFinalAttemptId={settingFinalAttemptId}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Pagination for Card View */}
          {filteredResults.length > 0 && (
            <div className="mt-6 px-4 py-4 bg-white/80 dark:bg-white/[0.02] backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.08] rounded-xl sm:rounded-2xl shadow-sm">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
                  <div className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredResults.length)} of {filteredResults.length} results
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">Show:</span>
                    <Select
                      value={itemsPerPage.toString()}
                      onValueChange={(value) => {
                        setItemsPerPage(Number.parseInt(value))
                        setCurrentPage(1)
                      }}
                    >
                      <SelectTrigger className="w-20 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {totalPages > 1 && (
                  <Pagination className="w-full sm:w-auto">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)
                        ) {
                          return (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => setCurrentPage(page)}
                                isActive={currentPage === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          )
                        } else if (page === currentPage - 2 || page === currentPage + 2) {
                          return (
                            <PaginationItem key={page}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )
                        }
                        return null
                      })}
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </div>
            </div>
          )}
        </>
      )
    }

    // Default: list view (safeViewMode is only "card" | "list" here)
    return (
      <>
        {allAttemptsHelp}
        <div className="bg-white/80 dark:bg-white/[0.02] backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.08] rounded-xl sm:rounded-2xl shadow-sm overflow-hidden min-w-0 max-w-full">
          <div className="min-w-0 w-full max-w-full overflow-x-auto">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="bg-slate-50/80 dark:bg-white/[0.04] hover:bg-slate-50/80 dark:hover:bg-white/[0.04]">
                  <TableHead
                    className="font-semibold text-slate-700 dark:text-slate-300 px-4 py-3 cursor-pointer select-none hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors"
                    onClick={() => {
                      if (sortColumn === "student") {
                        setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                      } else {
                        setSortColumn("student")
                        setSortDirection("asc")
                      }
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      Student
                      {sortColumn === "student" ? (sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : <ChevronDown className="h-4 w-4 opacity-30" />}
                    </div>
                  </TableHead>
                  <TableHead
                    className="font-semibold text-slate-700 dark:text-slate-300 px-4 py-3 cursor-pointer select-none hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors"
                    onClick={() => {
                      if (sortColumn === "score") {
                        setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                      } else {
                        setSortColumn("score")
                        setSortDirection("desc")
                      }
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      Score
                      {sortColumn === "score" ? (sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : <ChevronDown className="h-4 w-4 opacity-30" />}
                    </div>
                  </TableHead>
                  <TableHead
                    className="font-semibold text-slate-700 dark:text-slate-300 px-3 sm:px-4 py-3 cursor-pointer select-none hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors min-w-[5.5rem]"
                    onClick={() => {
                      if (sortColumn === "grade") {
                        setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                      } else {
                        setSortColumn("grade")
                        setSortDirection("desc")
                      }
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      Grade
                      {sortColumn === "grade" ? (sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : <ChevronDown className="h-4 w-4 opacity-30" />}
                    </div>
                  </TableHead>
                  <TableHead
                    className="font-semibold text-slate-700 dark:text-slate-300 px-3 sm:px-4 py-3 cursor-pointer select-none hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors min-w-[6.5rem]"
                    onClick={() => {
                      if (sortColumn === "status") {
                        setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                      } else {
                        setSortColumn("status")
                        setSortDirection("asc")
                      }
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="hidden sm:inline">Status</span>
                      <span className="sm:hidden">Stat.</span>
                      {sortColumn === "status" ? (sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : <ChevronDown className="h-4 w-4 opacity-30" />}
                    </div>
                  </TableHead>
                  <TableHead
                    className="font-semibold text-slate-700 dark:text-slate-300 px-3 sm:px-4 py-3 cursor-pointer select-none hover:bg-slate-100/80 dark:hover:bg-slate-800/50 transition-colors hidden md:table-cell"
                    onClick={() => {
                      if (sortColumn === "date") {
                        setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                      } else {
                        setSortColumn("date")
                        setSortDirection("desc")
                      }
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      Date
                      {sortColumn === "date" ? (sortDirection === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : <ChevronDown className="h-4 w-4 opacity-30" />}
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold text-slate-700 dark:text-slate-300 px-3 sm:px-4 py-3 w-[4.5rem]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedResults.map((result) => (
                  <Tooltip key={result.attempt_id}>
                    <TooltipTrigger asChild>
                  <TableRow 
                    className={`${result.is_retake ? "opacity-60" : ""} hover:bg-slate-50/50 dark:hover:bg-white/[0.03] transition-colors cursor-default`}
                  >
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${embedInDashboard ? fp.iconBg : fp.iconBg}`}>
                          <Users className={`h-4 w-4 ${embedInDashboard ? "text-teal-600 dark:text-teal-400" : "text-blue-600 dark:text-blue-400"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{result.student_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-slate-500 dark:text-slate-400">{result.student_id}</p>
                            <Badge className={`border-0 rounded-md px-1.5 py-0 text-xs ${embedInDashboard ? cn(fp.softBg, fp.iconText) : cn(fp.softBg, fp.iconText)}`}>
                              {getSectionColumnHeading(result.section, labelByCode)}
                            </Badge>
                            <GradeAttemptBadge result={result} showRetakes={showRetakes} />
                            {!showRetakes && result.is_retake && (
                              <Badge className="bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-950/40 dark:to-amber-950/40 text-orange-700 dark:text-orange-300 border-0 rounded-md px-1.5 py-0 text-xs">
                                Retake
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-100">
                        {Number(result.score || 0).toFixed(2)}/{result.total_possible_points ?? result.total_questions}
                      </div>
                    </TableCell>
                    <TableCell className="px-3 sm:px-4 py-3">
                      <div
                        className={`font-semibold tabular-nums whitespace-nowrap ${resultsViewerGradeColorClass(result)}`}
                      >
                        {formatResultsViewerGradePercent(result)}
                      </div>
                    </TableCell>
                    <TableCell className="px-3 sm:px-4 py-3">
                      <ResultStatusBadge result={result} compact />
                    </TableCell>
                    <TableCell className="px-3 sm:px-4 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        <Calendar className={`h-3.5 w-3.5 shrink-0 ${embedInDashboard ? "text-teal-500 dark:text-teal-400" : "text-blue-500"}`} />
                        <span>{formatAttemptStatusLabel(result)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-3 sm:px-4 py-3 w-[4.5rem]">
                      <AttemptResultActions
                        result={result}
                        resultsBase={resultsBase}
                        embedInDashboard={embedInDashboard}
                        onDelete={setDeleteAttemptId}
                        canSetFinalGrade={showRetakes}
                        onSetFinalGrade={handleSetFinalGrade}
                        settingFinalAttemptId={settingFinalAttemptId}
                      />
                    </TableCell>
                  </TableRow>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      align="start"
                      sideOffset={8}
                      className="max-w-[300px] border border-[var(--border)] bg-[var(--popover)] p-3 shadow-lg"
                    >
                      <ResultAssessmentTooltipContent result={result} />
                    </TooltipContent>
                  </Tooltip>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination for List View */}
          {filteredResults.length > 0 && (
            <div className="px-6 py-4 border-t border-slate-200/60 dark:border-white/[0.08]">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
                  <div className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredResults.length)} of {filteredResults.length} results
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">Show:</span>
                    <Select
                      value={itemsPerPage.toString()}
                      onValueChange={(value) => {
                        setItemsPerPage(Number.parseInt(value))
                        setCurrentPage(1)
                      }}
                    >
                      <SelectTrigger className="w-20 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {totalPages > 1 && (
                  <Pagination className="w-full sm:w-auto justify-center sm:justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)
                        ) {
                          return (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => setCurrentPage(page)}
                                isActive={currentPage === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          )
                        } else if (page === currentPage - 2 || page === currentPage + 2) {
                          return (
                            <PaginationItem key={page}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )
                        }
                        return null
                      })}
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </div>
            </div>
          )}
        </div>
      </>
    )
  }

  // Don't show full page loading - show inline loading instead
  // This prevents the "page reload" feeling when switching menus

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden space-y-6">
      {!embedInDashboard && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-3 rounded-xl bg-teal-500 dark:bg-teal-600 shadow-lg shrink-0">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 truncate">
                Student Results
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                View and analyze assessment performance data
              </p>
            </div>
          </div>
          <Link href={userType === "admin" ? "/admin/dashboard" : "/instructor/dashboard"}>
            <Button variant="outline" className="border-slate-200 dark:border-white/10 rounded-xl shrink-0">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      )}

      <FacultyModuleSplitLayout
        menu={
          <FacultyModuleSideMenu
            moduleId="results"
            title={embedInHub ? "Manage Results" : "Results & Analytics"}
            activeId={activeMenu}
            onSelect={setActiveMenu}
            items={[
              { id: "all", label: "All Results", icon: FileText },
              { id: "quizzes", label: "Quizzes", icon: ClipboardList, badge: menuCounts.quizzes },
              { id: "homeworks", label: "Homeworks", icon: BookOpen, badge: menuCounts.homeworks },
              { id: "mid-semester", label: "Mid-Semester", icon: GraduationCap, badge: menuCounts["mid-semester"] },
              { id: "finals", label: "Finals", icon: Award, badge: menuCounts.finals },
              { id: "flagged", label: "Flagged", icon: Flag, badge: menuCounts.flagged, tone: "warning" },
              ...(userType === "instructor"
                ? [{ id: "canvas-export", label: "Export to Canvas", icon: Upload }]
                : []),
              ...(embedInHub ? [] : [{ id: "analytics", label: "Analytics", icon: BarChart3 }]),
              { id: "deleted", label: "Deleted Items", icon: TrashIcon, tone: "destructive" as const },
            ]}
          />
        }
      >
        {/* Main Content Area */}
        <div className="flex-1 min-w-0 overflow-x-hidden space-y-6">
          {activeMenu === "analytics" && !embedInHub ? (
            <InstructorAdvancedAnalytics embedInDashboard={embedInDashboard} />
          ) : activeMenu === "canvas-export" && userType === "instructor" ? (
            <CanvasExportPanel
              quizzes={[
                ...CANVAS_EXTRA_EXPORT_COLUMNS.map((c) => ({ id: c.id, title: c.title })),
                ...allQuizzes.map((q) => ({ id: q.id, title: q.title })),
              ]}
              sections={availableSessions}
              sessionCatalog={sessionCatalogEntries.map((e) => ({ id: e.id, code: e.code }))}
              syncSectionFilter={canvasExportSyncSection}
              refreshKey={canvasExportRefreshKey}
              onRefresh={handleCanvasExportRefresh}
              isRefreshing={canvasExportRefreshing}
            />
          ) : activeMenu === "deleted" ? (
            <div className="space-y-6">
              <Card className="border border-slate-200/60 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.02] backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-sm overflow-hidden">
                <CardHeader className="bg-red-50/50 dark:bg-red-950/20 border-b border-slate-200/60 dark:border-white/[0.08]">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold text-slate-800 dark:text-slate-200">Deleted Results</CardTitle>
                      <CardDescription className="text-slate-600 dark:text-slate-400 mt-1">
                        View and restore soft-deleted student results
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      onClick={fetchDeletedResults}
                      disabled={loading}
                      className="rounded-xl"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-red-600" />
                    </div>
                  ) : results.length === 0 ? (
                    <div className="text-center py-12">
                      <Trash2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-600 dark:text-slate-400">No deleted results found</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-amber-800 dark:text-amber-200 mb-1">Soft-Deleted Results</p>
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                              These results have been moved to trash. They can be restored or will be permanently deleted after 24 hours.
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
                        {results.map((result) => {
                          const scorePercentage = Math.round(result.percentage || 0)
                          const scoreColor = resultShouldShowPnd(result)
                            ? "text-amber-600 dark:text-amber-400"
                            : scorePercentage >= 90
                              ? "text-green-600 dark:text-green-400"
                              : scorePercentage >= 70
                                ? embedInDashboard
                                  ? "text-teal-600 dark:text-teal-400"
                                  : "text-blue-600 dark:text-blue-400"
                                : scorePercentage >= 50
                                  ? "text-yellow-600 dark:text-yellow-400"
                                  : "text-red-600 dark:text-red-400"
                          
                          const assessmentTypeColors: Record<string, { bg: string; border: string; text: string }> = {
                            quiz: embedInDashboard 
                              ? { bg: "bg-teal-50/50 dark:bg-teal-950/20", border: "border-teal-200 dark:border-teal-800", text: "text-teal-700 dark:text-teal-300" }
                              : { bg: "bg-blue-50 dark:bg-blue-950/20", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300" },
                            homework: { bg: "bg-purple-50 dark:bg-purple-950/20", border: "border-purple-200 dark:border-purple-800", text: "text-purple-700 dark:text-purple-300" },
                            mid_semester: { bg: "bg-orange-50 dark:bg-orange-950/20", border: "border-orange-200 dark:border-orange-800", text: "text-orange-700 dark:text-orange-300" },
                            final: { bg: "bg-red-50 dark:bg-red-950/20", border: "border-red-200 dark:border-red-800", text: "text-red-700 dark:text-red-300" }
                          }
                          
                          const typeColors = assessmentTypeColors[result.assessment_type] || assessmentTypeColors.quiz
                          
                          return (
                            <Card key={result.attempt_id} className={`${typeColors.bg} ${typeColors.border} border-2 shadow-sm hover:shadow-md transition-all duration-200 rounded-xl overflow-hidden`}>
                              <CardContent className="p-5">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    {/* Assessment Type Badge */}
                                    <div className="flex items-center gap-2 mb-3">
                                      <Badge variant="outline" className={`${typeColors.text} ${typeColors.border} border font-medium text-xs px-2 py-0.5 rounded-full`}>
                                        {result.assessment_type === 'mid_semester' ? 'Mid-Semester' 
                                          : result.assessment_type === 'final' ? 'Final Exam'
                                          : result.assessment_type === 'homework' ? 'Homework'
                                          : 'Quiz'}
                                      </Badge>
                                      <Badge variant="outline" className="border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-xs px-2 py-0.5 rounded-full">
                                        <Trash2 className="h-3 w-3 mr-1" />
                                        Deleted
                                      </Badge>
                                    </div>
                                    
                                    {/* Assessment Title */}
                                    <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-base mb-3 line-clamp-2">
                                      {result.quiz_title || result.assessment_title || 'Untitled Assessment'}
                                    </h3>
                                    
                                    {/* Student Info */}
                                    <div className="flex items-center gap-2 mb-3">
                                      <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                        <Users className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate">
                                          {result.student_name}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                          {result.student_id} • {getSectionColumnHeading(result.section, labelByCode)}
                                        </p>
                                      </div>
                                    </div>
                                    
                                    {/* Score and Stats */}
                                    <div className="grid grid-cols-3 gap-3 mb-3">
                                      <div className="bg-white/60 dark:bg-slate-800/60 rounded-lg p-2.5 text-center">
                                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Score</p>
                                        <p className={`font-bold text-lg ${scoreColor}`}>
                                          {Number(result.score || 0).toFixed(2)}/{(result.total_possible_points ?? result.total_questions) || 0}
                                        </p>
                                      </div>
                                      <div className="bg-white/60 dark:bg-slate-800/60 rounded-lg p-2.5 text-center">
                                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Grade</p>
                                        <p className={`font-bold text-lg ${scoreColor}`}>
                                          {formatResultsViewerGradePercent(result)}
                                        </p>
                                      </div>
                                      <div className="bg-white/60 dark:bg-slate-800/60 rounded-lg p-2.5 text-center">
                                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Attempt</p>
                                        <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                                          #{result.attempt_number || 1}
                                        </p>
                                      </div>
                                    </div>
                                    
                                    {/* Deleted Date */}
                                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
                                      <Clock className="h-3.5 w-3.5" />
                                      <span>Deleted: {result.deleted_at ? new Date(result.deleted_at).toLocaleString('en-US', { 
                                        month: 'short', 
                                        day: 'numeric', 
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      }) : 'Unknown'}</span>
                                    </div>
                                  </div>
                                  
                                  {/* Restore Button */}
                                  <div className="flex-shrink-0">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleRestoreResult(result.attempt_id)}
                                      className="border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-950/30 hover:border-green-400 dark:hover:border-green-600 text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 rounded-lg shadow-sm hover:shadow transition-all duration-200"
                                    >
                                      <RotateCcw className="h-4 w-4 mr-2" />
                                      Restore
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              {embedInHub ? (
                <FacultyIntegratedToolbar
                  moduleId="results"
                  searchCompact
                  search={searchQuery}
                  onSearchChange={setSearchQuery}
                  onSearchClear={() => setSearchQuery("")}
                  searchPlaceholder="Search"
                  filters={
                    <>
                      <Select value={selectedSession} onValueChange={setSelectedSession}>
                        <SelectTrigger className={facultyToolbarSelectTriggerClass(selectedSession !== "all")}>
                          <SelectValue placeholder="Session" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sessions</SelectItem>
                          {availableSessions.map((session) => (
                            <SelectItem key={session} value={session}>
                              {getSectionColumnHeading(session, labelByCode)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={selectedQuiz} onValueChange={setSelectedQuiz}>
                        <SelectTrigger className={facultyToolbarSelectTriggerClass(selectedQuiz !== "all")}>
                          <SelectValue placeholder="Quiz" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          {quizzes.map((quiz) => {
                            const n = Number(quiz.total_attempts ?? 0)
                            return (
                              <SelectItem key={quiz.id} value={quiz.id.toString()}>
                                {quiz.title} (#{quiz.id}, {n})
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                      {activeMenu === "flagged" ? (
                        <Select value={selectedAssessmentType} onValueChange={setSelectedAssessmentType}>
                          <SelectTrigger className={facultyToolbarSelectTriggerClass(selectedAssessmentType !== "all")}>
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Flagged</SelectItem>
                            <SelectItem value="quiz">Quizzes</SelectItem>
                            <SelectItem value="homework">Homeworks</SelectItem>
                            <SelectItem value="mid_semester">Mid-Semester</SelectItem>
                            <SelectItem value="final">Finals</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : null}
                      <div
                        className="inline-flex h-9 shrink-0 items-center rounded-lg bg-[var(--sidebar-accent)]/40 p-0.5"
                        role="group"
                        aria-label="Attempt visibility"
                      >
                        <button
                          type="button"
                          onClick={() => setShowRetakes(false)}
                          className={cn(
                            "h-full whitespace-nowrap rounded-md px-2 text-[11px] font-medium transition-colors sm:px-2.5 sm:text-xs",
                            !showRetakes
                              ? "bg-[var(--sidebar-accent)] text-[var(--cc-text)] shadow-sm"
                              : "text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]",
                          )}
                        >
                          Final
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowRetakes(true)}
                          className={cn(
                            "inline-flex h-full items-center gap-1 whitespace-nowrap rounded-md px-2 text-[11px] font-medium transition-colors sm:px-2.5 sm:text-xs",
                            showRetakes
                              ? "bg-[var(--sidebar-accent)] text-[var(--cc-text)] shadow-sm"
                              : "text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]",
                          )}
                        >
                          All
                          {!showRetakes && hiddenRetakeCount > 0 ? (
                            <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[10px] font-semibold leading-none text-amber-700 dark:text-amber-300">
                              {hiddenRetakeCount}
                            </span>
                          ) : null}
                        </button>
                      </div>
                    </>
                  }
                  viewMode={viewMode === "card" ? "grid" : "list"}
                  onViewModeChange={(mode) => setViewMode(mode === "grid" ? "card" : "list")}
                  meta={
                    <p className={AN_META}>
                      {filteredCount} results
                      {selectedSession !== "all" ? ` · ${getSectionColumnHeading(selectedSession, labelByCode)}` : ""}
                      {selectedQuiz !== "all" ? ` · filtered assessment` : ""}
                      {isManualRefresh ? " · refreshing…" : ""}
                      {refreshError ? (
                        <span className="text-red-600 dark:text-red-400"> · {refreshError}</span>
                      ) : null}
                    </p>
                  }
                  trailing={
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleRefreshResults()}
                        disabled={loading}
                        className={facultyToolbarIconButtonClass(isManualRefresh)}
                        aria-label={isManualRefresh ? "Refreshing results" : "Refresh results"}
                        title={isManualRefresh ? "Refreshing…" : "Refresh"}
                      >
                        <RefreshCw className={cn("h-3.5 w-3.5 opacity-70", isManualRefresh && "animate-spin")} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => void handleBulkFinalizeResults()}
                        disabled={bulkFinalizing || userType === "admin"}
                        className={facultyToolbarIconButtonClass()}
                        aria-label="Release grades to students"
                        title={bulkFinalizing ? "Finalizing…" : "Release grades"}
                      >
                        <ShieldCheck className={cn("h-3.5 w-3.5 opacity-70", bulkFinalizing && "animate-pulse")} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowExportModal(true)}
                        className={facultyToolbarIconButtonClass()}
                        aria-label="Export results"
                        title="Export"
                      >
                        <Download className="h-3.5 w-3.5 opacity-70" />
                      </Button>
                      {results.length > 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowClearDialog(true)}
                          className={cn(facultyToolbarIconButtonClass(), "text-red-600 dark:text-red-400")}
                          aria-label="Clear all results"
                          title="Clear"
                        >
                          <Trash2 className="h-3.5 w-3.5 opacity-70" />
                        </Button>
                      ) : null}
                    </>
                  }
                />
              ) : null}
              {!embedInHub ? (
              <div className="bg-white/80 dark:bg-white/[0.02] backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.08] rounded-xl sm:rounded-2xl shadow-sm overflow-hidden">
                <div className={`border-b border-slate-200 dark:border-white/[0.08] px-6 py-4 ${embedInDashboard ? fp.softBg : fp.softBg}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${embedInDashboard ? fp.cta : fp.cta}`}>
                        <FilterIcon className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Filters & Export</h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Filter results and export data</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleRefreshResults()}
                        className={`border-slate-200 dark:border-white/10 transition-all rounded-xl ${embedInDashboard ? "hover:bg-teal-50 dark:hover:bg-teal-500/10 hover:border-teal-300 dark:hover:border-teal-500/50 hover:text-teal-600 dark:hover:text-teal-400" : "hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"}`}
                        disabled={loading}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isManualRefresh ? "animate-spin" : ""}`} />
                        {isManualRefresh ? "Refreshing…" : "Refresh"}
                      </Button>
                      <div className="flex items-center gap-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-1.5 rounded-xl shadow-sm">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewMode("card")}
                          className={`rounded-lg transition-all ${
                            viewMode === "card"
                              ? embedInDashboard ? fp.cta : fp.cta
                              : "hover:bg-slate-100 dark:hover:bg-white/5"
                          }`}
                        >
                          <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewMode("list")}
                          className={`rounded-lg transition-all ${
                            viewMode === "list"
                              ? embedInDashboard ? fp.cta : fp.cta
                              : "hover:bg-slate-100 dark:hover:bg-white/5"
                          }`}
                        >
                          <List className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button 
                        onClick={() => setShowExportModal(true)} 
                        variant="outline"
                        className="border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 hover:border-slate-300 dark:hover:border-white/20 transition-all rounded-xl"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  {/* Flagged view: Assessment Type filter + Search + View organizer */}
                  {activeMenu === "flagged" && (
                    <div className="mb-6 p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40">
                      <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-2">Flagged Attempts — Filter & Search</p>
                      <p className="text-xs text-amber-800/90 dark:text-amber-200/80 mb-3 leading-relaxed">
                        <strong>Flagged</strong> includes (1) pending grade / review (grade column shows <strong>PND%</strong>) and/or (2) anti-cheat thresholds: tab switches &gt; 3, copy-paste &gt; 2, or mouse-leave &gt; 5. Rows with a normal % and full points are usually (2)—scores are final; review the attempt for integrity signals.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
                        <div className="space-y-2 min-w-[160px]">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Assessment Type</label>
                          <Select value={selectedAssessmentType} onValueChange={setSelectedAssessmentType}>
                            <SelectTrigger className="w-full border-slate-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 h-11">
                              <SelectValue placeholder="All Flagged" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Flagged</SelectItem>
                              <SelectItem value="quiz">Quizzes Flagged</SelectItem>
                              <SelectItem value="homework">Homeworks Flagged</SelectItem>
                              <SelectItem value="mid_semester">Mid-Semester Flagged</SelectItem>
                              <SelectItem value="final">Finals Flagged</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 flex-1 min-w-[200px]">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Search</label>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                              placeholder="Student name, ID, or assessment title..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-9 h-11 rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-white/5"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">View</label>
                          <div className="flex gap-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-1.5 rounded-xl">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewMode("card")}
                              className={`rounded-lg h-9 ${
                                viewMode === "card"
                                  ? embedInDashboard ? "bg-teal-600 dark:bg-teal-500 text-white" : "bg-blue-600 text-white"
                                  : "hover:bg-slate-100 dark:hover:bg-white/5"
                              }`}
                            >
                              <LayoutGrid className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewMode("list")}
                              className={`rounded-lg h-9 ${
                                viewMode === "list"
                                  ? embedInDashboard ? "bg-teal-600 dark:bg-teal-500 text-white" : "bg-blue-600 text-white"
                                  : "hover:bg-slate-100 dark:hover:bg-white/5"
                              }`}
                            >
                              <List className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-end gap-4">
                    <div className={`flex-1 grid gap-4 ${results.length > 0 ? "grid-cols-1 md:grid-cols-4" : "grid-cols-1 md:grid-cols-3"}`}>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Session</label>
                        <Select value={selectedSession} onValueChange={setSelectedSession}>
                          <SelectTrigger className="w-full border-slate-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-slate-900 dark:text-slate-100 h-11 min-h-[2.75rem]">
                            <SelectValue placeholder="All Sessions" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Sessions</SelectItem>
                            {availableSessions.map((session) => (
                              <SelectItem key={session} value={session}>
                                {getSectionColumnHeading(session, labelByCode)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Assessment</label>
                        <Select value={selectedQuiz} onValueChange={setSelectedQuiz}>
                          <SelectTrigger className="w-full border-slate-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-slate-900 dark:text-slate-100 h-11 min-h-[2.75rem]">
                            <SelectValue placeholder={quizzes.length === 0 ? "No assessments available" : "All Assessments"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Assessments</SelectItem>
                            {quizzes.map((quiz) => {
                              const n = Number(quiz.total_attempts ?? 0)
                              const label = `${quiz.title} (#${quiz.id}, ${n} attempt${n !== 1 ? "s" : ""})`
                              return (
                                <SelectItem key={quiz.id} value={quiz.id.toString()}>
                                  {label}
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Retake Display</label>
                        <Button
                          variant={showRetakes ? "default" : "outline"}
                          onClick={() => setShowRetakes(!showRetakes)}
                          className={`w-full transition-all rounded-xl h-11 min-h-[2.75rem] ${
                            showRetakes 
                              ? embedInDashboard ? fp.cta : fp.cta
                              : "border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 hover:border-slate-300 dark:hover:border-white/20"
                          }`}
                        >
                          <FilterIcon className="h-4 w-4 mr-2" />
                          {showRetakes ? "Hide Retakes" : "Show All Attempts"}
                        </Button>
                      </div>
                      {results.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Clear</label>
                          <Button 
                            variant="outline"
                            onClick={() => setShowClearDialog(true)}
                            className="w-full border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-300 dark:hover:border-red-700 transition-all rounded-xl h-11 min-h-[2.75rem]"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Clear All
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
              ) : null}

              {/* Results Display - Only show when not loading */}
              {renderResultsContent()}
            </>
          )}
        </div>
      </FacultyModuleSplitLayout>

      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="flex max-h-[min(90vh,720px)] w-full max-w-[calc(100vw-2rem)] flex-col gap-4 overflow-hidden sm:max-w-md rounded-2xl border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950">
          <DialogHeader className="min-w-0 shrink-0 space-y-2 text-left">
            <DialogTitle className="text-slate-900 dark:text-slate-100">Export results</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              Pick a <span className="font-medium text-slate-800 dark:text-slate-200">section</span> and{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">one assessment</span> in Filters first —
              CSV and ZIP include exactly the rows shown in the table (same filters, including retakes and flagged views).
              ZIP adds <span className="font-medium text-slate-800 dark:text-slate-200">manifest.csv</span> plus a{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">pdfs/</span> folder (student-style report per row).
              Archive base name:{" "}
              <span className="break-all font-mono text-xs">{computeExportBasenames().fileBase}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 min-w-0 flex flex-col gap-3 overflow-y-auto py-0.5">
            <Button
              variant="outline"
              className="h-auto min-w-0 max-w-full shrink-0 justify-start whitespace-normal rounded-xl border-slate-200 px-4 py-3 text-left dark:border-white/10 [&_svg]:shrink-0"
              disabled={!exportFiltersReady || results.length === 0}
              onClick={handleExportCsv}
            >
              <Download className="mt-0.5 mr-3 size-4 shrink-0" />
              <span className="min-w-0 text-left">
                <span className="font-medium block text-slate-900 dark:text-slate-100">CSV</span>
                <span className="text-xs leading-snug text-slate-600 dark:text-slate-400">
                  Summary for every row in the table — sections, scores, attempt IDs — ends in .csv
                </span>
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-auto min-w-0 max-w-full shrink-0 justify-start whitespace-normal rounded-xl border-slate-200 px-4 py-3 text-left dark:border-white/10 [&_svg]:shrink-0"
              onClick={handleExportZipWithPdfs}
              disabled={exportZipBusy || !exportFiltersReady || results.length === 0}
            >
              {exportZipBusy ? (
                <Loader2 className="mt-0.5 mr-3 size-4 shrink-0 animate-spin" />
              ) : (
                <Archive className="mt-0.5 mr-3 size-4 shrink-0" />
              )}
              <span className="min-w-0 text-left">
                <span className="font-medium block text-slate-900 dark:text-slate-100">ZIP</span>
                <span className="text-xs leading-snug text-slate-600 dark:text-slate-400">
                  manifest.csv + pdfs/ — one PDF per table row (filenames include attempt id when there are retakes).
                </span>
              </span>
            </Button>
          </div>
          <DialogFooter className="mt-auto shrink-0 flex-col gap-2 border-t border-slate-100 pt-4 dark:border-white/10 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:space-x-0">
            <p className="min-w-0 text-xs text-amber-700 dark:text-amber-400/90">
              {!exportFiltersReady
                ? "Select a section and one assessment in Filters — exports match the table only after both are set."
                : results.length === 0
                  ? "No rows match these filters — adjust Filters or enable retakes."
                  : `${results.length} row(s) — ZIP builds one PDF per row below.`}
            </p>
            <Button type="button" variant="ghost" className="shrink-0 rounded-xl sm:ml-auto" onClick={() => setShowExportModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialogs */}
      <AlertDialog open={deleteAttemptId !== null} onOpenChange={(open) => !open && setDeleteAttemptId(null)}>
        <AlertDialogContent className="rounded-2xl border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-red-100 to-pink-100 dark:from-red-950/40 dark:to-pink-950/30">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <AlertDialogTitle className="text-xl font-semibold text-slate-800 dark:text-slate-100">Delete Result</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              Are you sure you want to delete this quiz attempt? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 dark:text-slate-200 rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAttemptId && handleDeleteResult(deleteAttemptId)}
              disabled={deleting}
              className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white rounded-xl"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent className="rounded-2xl border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-red-100 to-pink-100 dark:from-red-950/40 dark:to-pink-950/30">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <AlertDialogTitle className="text-xl font-semibold text-slate-800 dark:text-slate-100">Clear All Results</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              Are you sure you want to {selectedQuiz !== 'all' || selectedSession !== 'all' || selectedAssessmentType !== 'all' ? 'delete the FILTERED' : 'delete ALL'} quiz results?
              <br/><br/>
              <strong>This will move {results.length} quiz attempt(s) to trash (recoverable for 24 hours)</strong>
              {selectedQuiz !== 'all' && (
                <>
                  <br/>
                  • Quiz: {quizzes.find(q => q.id === Number(selectedQuiz))?.title}
                </>
              )}
              {selectedSession !== 'all' && (
                <>
                  <br/>
                  • Session: {getSectionColumnHeading(selectedSession, labelByCode)}
                </>
              )}
              {selectedAssessmentType !== 'all' && (
                <>
                  <br/>
                  • Type: {selectedAssessmentType}
                </>
              )}
              <br/>
              Items can be restored from the trash within 24 hours.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 dark:text-slate-200 rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAllResults}
              disabled={clearing}
              className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white rounded-xl"
            >
              {clearing ? "Clearing..." : "Clear All Results"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
