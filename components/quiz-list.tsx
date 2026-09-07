"use client"

import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TouchFriendlySelect } from "@/components/ui/touch-friendly-select"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Clock,
  CheckCircle2,
  Lightbulb,
  ShieldCheck,
  LayoutGrid,
  List,
  FolderOpen,
  Folder,
  Search,
  X,
  Filter,
  SortAsc,
  Zap,
  Pause,
  AlertCircle,
  Award,
  Timer,
  Calendar,
} from "lucide-react"
import { usePreventBack } from "@/hooks/use-prevent-back"
import { usePersistedState, useScrollRestoration } from "@/hooks/use-persisted-state"
import { useAssessmentType, configForType, resolveAssessmentTypeKey } from "@/context/assessment-type-context"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { getStudentNavGroupTheme } from "@/lib/student-module-themes"
import {
  portalViewOrganizerActiveClass,
  portalViewOrganizerContainerClass,
  portalViewOrganizerInactiveClass,
} from "@/lib/portal-module-themes"
import { formatCentralDateTime } from "@/lib/timezone"
import { useNotification } from "@/components/notification-provider"
import { RetakeUpgradeModal } from "@/components/retake-upgrade-modal"
import { RetakeForfeitAlert } from "@/components/retake-forfeit-alert"
import { RolloverUpgradeModal } from "@/components/rollover-upgrade-modal"
import { RolloverConfirmModal, type RolloverPolicyForModal } from "@/components/rollover-confirm-modal"
import { AssessmentActionButtons } from "@/components/assessment-action-buttons"
import { EmbeddedAssessmentCard } from "@/components/student/dashboard-v2/EmbeddedAssessmentCard"
import { ExtendSelfServiceClosedBanner } from "@/components/student/ExtendSelfServiceClosedBanner"
import { stripAssessmentInstructions } from "@/lib/student-assessment-hub"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { studentResultsPdfGateSatisfied } from "@/lib/student-results-pdf-gate"
import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

const HUB_ITEMS_PER_PAGE_LIST = 8
const HUB_ITEMS_PER_PAGE_GRID = 6

function quizDisplayPercent(quiz: {
  display_percentage?: number
  score?: number
  total_questions?: number
  grade_status?: "finalized" | "pending" | null
  grade_released?: boolean
}): number | null {
  if (quiz.grade_status === "pending" || quiz.grade_released === false) return null
  if (quiz.display_percentage != null && Number.isFinite(quiz.display_percentage)) {
    return Math.round(quiz.display_percentage * 10) / 10
  }
  if (quiz.score != null && quiz.total_questions != null && quiz.total_questions > 0) {
    if (quiz.total_questions === 100) return Math.round(quiz.score)
    return Math.round((quiz.score / quiz.total_questions) * 100)
  }
  return null
}

function quizDisplayScoreLine(quiz: {
  display_percentage?: number
  score?: number
  total_questions?: number
  grade_status?: "finalized" | "pending" | null
  grade_released?: boolean
}): string | null {
  if (quiz.grade_status === "pending" || quiz.grade_released === false) {
    return "Under review"
  }
  const pct = quizDisplayPercent(quiz)
  if (pct == null || quiz.score == null || quiz.total_questions == null) return null
  return `${quiz.score}/${quiz.total_questions} (${pct}%)`
}

function isSingleSittingAssessmentType(type: string) {
  return type === "final" || type === "mid_semester"
}

function quizTimerLabel(quiz: Quiz) {
  return quiz.timer_display_label ?? `${quiz.time_per_question}s`
}

interface Quiz {
  id: number
  title: string
  description: string
  is_active: boolean
  time_per_question: number
  question_count: number
  attempted: boolean
  attempt_id?: number
  score?: number
  total_questions?: number
  display_percentage?: number
  grade_status?: "finalized" | "pending" | null
  grade_released?: boolean
  quiz_type: "admin" | "practice"
  completed?: boolean
  can_take?: boolean
  saved_for_later?: boolean
  in_progress_attempt_id?: number | null
  can_retake?: boolean
  attempts_remaining?: number | null
  /** Past due without rollover: paid retakes no longer apply */
  calendar_retake_perks_expired?: boolean
  /** How many tier retakes expired when the deadline passed (null = unlimited / not counted) */
  expired_retake_slots?: number | null
  attempts_used?: number
  /** Explorer / Trailblazer: can apply membership rollover on past-due assessment */
  can_apply_rollover?: boolean
  /** Scholar: show Extend CTA but prompt to upgrade on click */
  rollover_requires_upgrade?: boolean
  /** Active extension window */
  rollover_active?: boolean
  rollover_expires_at?: string | null
  rollover_hours?: number
  rollover_membership_applies_used?: number
  rollover_membership_applies_max?: number
  available_from?: string | null
  available_until?: string | null
  created_at?: string | null
  /** Instructor enabled this quiz for the student's session (quiz_session_access). */
  session_access_active?: boolean
  /** Current time is within available_from / available_until (from API). */
  calendar_open?: boolean
  /** Server: semester concluded — secondary close after per-assessment due dates. */
  semester_assessments_closed?: boolean
  /** Final with restrict access: student sees the row but is not on the instructor allowlist yet. */
  final_access_pending_allowlist?: boolean
  timer_display_label?: string
  description?: string | null
}

function formatPostedOrDue(value: string | null | undefined): string {
  if (!value) return "—"
  try {
    return formatCentralDateTime(value, "MMM d, h:mm a")
  } catch {
    return "—"
  }
}

/** True when the quiz's due date has passed (matches server calendar window end). */
function isPastCalendarDeadline(quiz: Quiz): boolean {
  if (!quiz.available_until) return false
  return new Date(quiz.available_until).getTime() < Date.now()
}

/** Closed for display: per-assessment due passed (primary), or semester concluded (secondary). */
function isAssessmentClosedForDisplay(quiz: Quiz): boolean {
  if (quiz.semester_assessments_closed === true) return true
  return isPastCalendarDeadline(quiz)
}

/** True when the quiz is not yet open (before available_from). */
function isBeforeOpenWindow(quiz: Quiz): boolean {
  if (!quiz.available_from) return false
  return new Date(quiz.available_from).getTime() > Date.now()
}

/**
 * Show Start only when the server allows it AND we are not past the calendar deadline
 * unless the student is in a rollover/extension window or the API marks calendar_open (beta date bypass).
 * Relying on client `available_until` alone fixes cases where API flags disagree or fields are missing.
 */
function canShowStartAssessment(quiz: Quiz): boolean {
  if (!quiz.can_take || !(quiz.is_active || quiz.rollover_active)) return false
  if (quiz.rollover_active) return true
  if (!isPastCalendarDeadline(quiz)) return true
  // Past due: never Start except beta bypass (calendar_open true from /api/student/quizzes)
  return quiz.calendar_open === true
}

/** After the calendar due instant, show "Open …" instead of "Start …" (extension/rollover or beta). */
function primaryOpenAfterDueLabel(
  quiz: Quiz,
  canShowStart: boolean,
  savedForLater: boolean,
  displayName: string,
): string | undefined {
  if (!canShowStart || savedForLater || !isPastCalendarDeadline(quiz)) return undefined
  return `Open ${displayName.toLowerCase()}`
}

function buildQuizActionConfig(
  quiz: Quiz,
  assessmentDisplayName: string,
  handlers: {
    handleViewReport: (attemptId: number) => void
    handleRetakeClick: (quizId: number) => void
    handleStartQuiz: (quizId: number) => void
    handleApplyRollover: (quiz: Quiz) => void
    setFinalAllowlistModalOpen: (open: boolean) => void
    applyingRollover: number | null
  },
) {
  const hasReport = !!(quiz.attempted && quiz.attempt_id && quiz.completed)
  const savedForLater = !!(quiz.saved_for_later && (quiz.is_active || quiz.rollover_active))
  const canExtend = !!((quiz.can_apply_rollover || quiz.rollover_requires_upgrade) && !quiz.rollover_active)
  const canStart = canShowStartAssessment(quiz)
  const pendingFinalAllowlist = !!quiz.final_access_pending_allowlist && quiz.is_active
  const startLabelAfterDue = primaryOpenAfterDueLabel(
    quiz,
    canStart,
    savedForLater,
    assessmentDisplayName,
  )
  const noPrimaryAction = !hasReport && !savedForLater && !canExtend && !canStart
  const closedByDeadline =
    noPrimaryAction && !quiz.rollover_active && isAssessmentClosedForDisplay(quiz)
  const lockedNotAvailable = noPrimaryAction && !closedByDeadline

  return {
    onViewReport: quiz.attempt_id ? () => handlers.handleViewReport(quiz.attempt_id!) : undefined,
    onRetake:
      hasReport &&
      quiz.can_retake &&
      (quiz.is_active || quiz.rollover_active) &&
      !quiz.final_access_pending_allowlist
        ? () => handlers.handleRetakeClick(quiz.id)
        : undefined,
    onContinue: savedForLater ? () => handlers.handleStartQuiz(quiz.id) : undefined,
    onExtend: canExtend ? () => handlers.handleApplyRollover(quiz) : undefined,
    extending: handlers.applyingRollover === quiz.id,
    extendLabel: quiz.rollover_requires_upgrade
      ? "Extend (Upgrade)"
      : `Extend (${quiz.rollover_hours ?? 24}h${
          quiz.rollover_membership_applies_max != null &&
          quiz.rollover_membership_applies_max > 1
            ? ` · ${Math.max(
                0,
                (quiz.rollover_membership_applies_max ?? 0) -
                  (quiz.rollover_membership_applies_used ?? 0),
              )} left`
            : ""
        })`,
    onStart: canStart ? () => handlers.handleStartQuiz(quiz.id) : undefined,
    startLabel: startLabelAfterDue,
    lockedLabel: pendingFinalAllowlist
      ? "Access pending — tap for details"
      : lockedNotAvailable && isBeforeOpenWindow(quiz)
        ? `Opens ${formatPostedOrDue(quiz.available_from)}`
        : undefined,
    onLockedInfo: pendingFinalAllowlist
      ? () => handlers.setFinalAllowlistModalOpen(true)
      : undefined,
    show: {
      report: hasReport,
      retake:
        hasReport &&
        !!quiz.can_retake &&
        !!(quiz.is_active || quiz.rollover_active) &&
        !quiz.final_access_pending_allowlist &&
        !quiz.calendar_retake_perks_expired,
      continue: savedForLater,
      extend: !hasReport && !savedForLater && canExtend,
      start: !hasReport && !savedForLater && !canExtend && canStart,
      closed: closedByDeadline,
      locked: lockedNotAvailable,
    },
  }
}

export type QuizHubMeta = {
  total: number
  official: number
  practice: number
  filtered: number
  openIssues?: number
  closedIssues?: number
  refreshFailed?: boolean
}

export type QuizHubFilters = {
  searchQuery: string
  filterType: "all" | "admin" | "practice"
  filterStatus: "all" | "active" | "completed" | "locked"
  viewMode: "grid" | "list"
  sortBy: "title" | "status" | "newest"
}

export function QuizList({
  assessmentType = "quiz",
  embedInDashboard = false,
  hubLayout = false,
  hubFilters,
  onHubMetaChange,
}: {
  assessmentType?: string
  embedInDashboard?: boolean
  hubLayout?: boolean
  hubFilters?: QuizHubFilters
  onHubMetaChange?: (meta: QuizHubMeta) => void
}) {
  const router = useRouter()
  const { toast } = useNotification()
  usePreventBack("/student/login")
  
  // Use context for colors and terminology (with fallback for quiz pages without provider)
  let assessmentConfig
  try {
    assessmentConfig = useAssessmentType()
  } catch {
    assessmentConfig = configForType(resolveAssessmentTypeKey(assessmentType))
  }

  const assessmentsTheme = getStudentNavGroupTheme("assessments")

  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const [studentName, setStudentName] = useState("")
  const [studentSection, setStudentSection] = useState("")
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showForfeitAlert, setShowForfeitAlert] = useState(false)
  const [showRolloverUpgradeModal, setShowRolloverUpgradeModal] = useState(false)
  const [retakeAccess, setRetakeAccess] = useState<{ hasAccess: boolean } | null>(null)
  const [applyingRollover, setApplyingRollover] = useState<number | null>(null)
  const [rolloverPolicy, setRolloverPolicy] = useState<RolloverPolicyForModal | null>(null)
  const [rolloverConfirmQuiz, setRolloverConfirmQuiz] = useState<Quiz | null>(null)
  const [finalAllowlistModalOpen, setFinalAllowlistModalOpen] = useState(false)

  // Persist filters per assessment type so e.g. "Practice" on Homework does not hide all Finals (API uses quiz_type "admin" for finals).
  const filterPersistId = assessmentType || "quiz"
  const hubControlled = hubLayout && hubFilters != null
  const [internalViewMode, setInternalViewMode] = usePersistedState<"grid" | "list">("student-quiz-view", "list")
  const [internalSearchQuery, setInternalSearchQuery] = usePersistedState(
    `student-quiz-search-${filterPersistId}`,
    "",
  )
  const [internalFilterType, setInternalFilterType] = usePersistedState<"all" | "admin" | "practice">(
    `student-quiz-filter-type-${filterPersistId}`,
    "all",
  )
  const [internalFilterStatus, setInternalFilterStatus] = usePersistedState<
    "all" | "active" | "completed" | "locked"
  >(`student-quiz-filter-status-${filterPersistId}`, "all")
  const [internalSortBy, setInternalSortBy] = usePersistedState<"title" | "status" | "newest">(
    `student-quiz-sort-${filterPersistId}`,
    "title",
  )
  const viewMode = hubControlled ? hubFilters.viewMode : internalViewMode
  const setViewMode = hubControlled ? () => {} : setInternalViewMode
  const searchQuery = hubControlled ? hubFilters.searchQuery : internalSearchQuery
  const setSearchQuery = hubControlled ? () => {} : setInternalSearchQuery
  const filterType = hubControlled ? hubFilters.filterType : internalFilterType
  const setFilterType = hubControlled ? () => {} : setInternalFilterType
  const filterStatus = hubControlled ? hubFilters.filterStatus : internalFilterStatus
  const setFilterStatus = hubControlled ? () => {} : setInternalFilterStatus
  const sortBy = hubControlled ? hubFilters.sortBy : internalSortBy
  const setSortBy = hubControlled ? () => {} : setInternalSortBy
  const [searchOpen, setSearchOpen] = useState(() => searchQuery.trim() !== "")
  const [hubPage, setHubPage] = usePersistedState(`student-quiz-hub-page-${filterPersistId}`, 1)
  const hubListScrollRef = useRef<HTMLDivElement>(null)

  // Restore scroll position
  useScrollRestoration("student-quiz-list")

  const fetchQuizzes = useCallback(
    async (studentIdOrDbId: string, useDatabaseId = false) => {
      const param = useDatabaseId ? `studentDatabaseId=${studentIdOrDbId}` : `studentId=${studentIdOrDbId}`
      const url = `/api/student/quizzes?${param}&type=${assessmentType}`
      // Retry once: long-running `next dev --turbo` often restarts on memory pressure and
      // drops in-flight fetches with TypeError: Failed to fetch.
      const maxAttempts = 2
      try {
        let lastError: unknown = null
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            if (attempt > 0) {
              await new Promise((r) => setTimeout(r, 600))
            }
            const response = await fetch(url)
            if (!response.ok) {
              console.error(`[QuizList] API error: ${response.status} ${response.statusText}`)
              setQuizzes([])
              return
            }
            const data = await response.json()
            if (data.error) {
              console.error(`[QuizList] API returned error:`, data.error)
              setQuizzes([])
              return
            }
            if (Array.isArray(data.quizzes)) {
              setQuizzes(data.quizzes)
            } else if (Array.isArray(data.assessments)) {
              setQuizzes(data.assessments)
            } else {
              setQuizzes([])
            }
            if (data.rollover_policy && typeof data.rollover_policy === "object") {
              setRolloverPolicy(data.rollover_policy as RolloverPolicyForModal)
            }
            return
          } catch (error) {
            lastError = error
            const isNetwork =
              error instanceof TypeError &&
              (String(error.message).includes("Failed to fetch") ||
                String(error.message).includes("NetworkError") ||
                String(error.message).includes("fetch"))
            if (!isNetwork || attempt === maxAttempts - 1) throw error
          }
        }
        if (lastError) throw lastError
      } catch (error) {
        console.error("[QuizList] Failed to fetch quizzes:", error)
        setQuizzes([])
      } finally {
        setLoading(false)
      }
    },
    [assessmentType]
  )

  useEffect(() => {
    const name = sessionStorage.getItem("studentName")
    const section = sessionStorage.getItem("studentSection")
    const studentId = sessionStorage.getItem("studentId")
    const studentDatabaseId = sessionStorage.getItem("studentDatabaseId")
    const legacyView = localStorage.getItem("quizViewMode")
    if (legacyView === "list" || legacyView === "grid") {
      setViewMode(legacyView)
      localStorage.removeItem("quizViewMode")
    }

    if (!studentId && !studentDatabaseId) {
      router.push("/student/login")
      return
    }
    setStudentName(name || "")
    setStudentSection(section || "")
    // Prefer studentDatabaseId for consistency with Trade Center and rollover APIs
    if (studentDatabaseId) {
      fetchQuizzes(studentDatabaseId, true)
    } else if (studentId) {
      fetchQuizzes(studentId, false)
    }

    if (studentDatabaseId) {
      studentApiFetch(`/api/student/retake-access?studentId=${studentDatabaseId}`)
        .then((res) => res.json())
        .then((data) => setRetakeAccess(data))
        .catch(() => {})
    }
  }, [router, fetchQuizzes])

  // Refetch when tab becomes visible or when rollover is granted from Trade Center
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const studentDatabaseId = sessionStorage.getItem("studentDatabaseId")
        const studentId = sessionStorage.getItem("studentId")
        if (studentDatabaseId) {
          fetchQuizzes(studentDatabaseId, true)
        } else if (studentId) {
          fetchQuizzes(studentId, false)
        }
      }
    }
    const onRolloverGranted = () => {
      const studentDatabaseId = sessionStorage.getItem("studentDatabaseId")
      const studentId = sessionStorage.getItem("studentId")
      if (studentDatabaseId) {
        fetchQuizzes(studentDatabaseId, true)
      } else if (studentId) {
        fetchQuizzes(studentId, false)
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("trade-center-rollover-granted", onRolloverGranted)
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("trade-center-rollover-granted", onRolloverGranted)
    }
  }, [fetchQuizzes])

  const handleStartQuiz = (quizId: number) => {
    const q = quizzes.find((x) => x.id === quizId)
    if (q?.final_access_pending_allowlist) {
      setFinalAllowlistModalOpen(true)
      return
    }
    const path = assessmentType === "homework"
      ? `/student/homework/${quizId}`
      : assessmentType === "midsem"
      ? `/student/mid-semester/${quizId}`
      : assessmentType === "final"
      ? `/student/final/${quizId}`
      : `/student/quiz/${quizId}`
    router.push(path)
  }

  const executeApplyRollover = async (quiz: Quiz): Promise<boolean> => {
    const studentDatabaseId = sessionStorage.getItem("studentDatabaseId")
    if (!studentDatabaseId) return false
    setApplyingRollover(quiz.id)
    try {
      const res = await studentApiFetch("/api/student/rollover/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: Number(studentDatabaseId),
          quizId: quiz.id,
          acknowledgedRules: true,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast({
          title: "Extension applied",
          description:
            typeof data.message === "string"
              ? data.message
              : `You have ${quiz.rollover_hours ?? 24}h to complete this assessment.`,
        })
        const studentDatabaseIdForRefresh = sessionStorage.getItem("studentDatabaseId")
        const studentIdForRefresh = sessionStorage.getItem("studentId")
        if (studentDatabaseIdForRefresh) fetchQuizzes(studentDatabaseIdForRefresh, true)
        else if (studentIdForRefresh) fetchQuizzes(studentIdForRefresh, false)
        return true
      }
      if (res.status === 403 && data.upgradeRequired) {
        setRolloverConfirmQuiz(null)
        setShowRolloverUpgradeModal(true)
        return false
      }
      if (res.status === 403 && data.rolloverApplyClosed) {
        setRolloverPolicy((prev) =>
          prev ? { ...prev, self_service_open: false } : prev,
        )
        toast({
          title: "Extend closed for this semester",
          description:
            typeof data.error === "string"
              ? data.error
              : "Contact your instructor if you still need access.",
          variant: "destructive",
        })
        return false
      }
      toast({
        title: "Could not apply extension",
        description: typeof data.error === "string" ? data.error : "Try again later.",
        variant: "destructive",
      })
      console.error("[QuizList] Rollover apply failed:", data.error)
      return false
    } catch (e) {
      console.error("[QuizList] Rollover apply error:", e)
      return false
    } finally {
      setApplyingRollover(null)
    }
  }

  const handleApplyRollover = (quiz: Quiz) => {
    if (quiz.rollover_requires_upgrade) {
      setShowRolloverUpgradeModal(true)
      return
    }
    if (rolloverPolicy && !rolloverPolicy.self_service_open) {
      toast({
        title: "Extend closed for grade finalization",
        description: `Self-service Extend ended after ${formatPostedOrDue(rolloverPolicy.apply_deadline_iso)}. Contact your instructor.`,
        variant: "destructive",
      })
      return
    }
    setRolloverConfirmQuiz(quiz)
  }

  const confirmApplyRollover = async () => {
    if (!rolloverConfirmQuiz) return
    const ok = await executeApplyRollover(rolloverConfirmQuiz)
    if (ok) setRolloverConfirmQuiz(null)
  }
  
  const handleViewReport = async (attemptId: number) => {
    if (!attemptId || isNaN(attemptId)) {
      return
    }
    const typeParam = assessmentType === "mid_semester" || assessmentType === "final" || assessmentType === "homework" ? `?type=${assessmentType}` : ""
    const navPath = `/student/results/${attemptId}${typeParam}`
    // Check PDF download status before navigating
    try {
      const response = await studentApiFetch(`/api/student/results/${attemptId}`, {
        headers: getStudentAuthHeaders(),
      })
      
      if (response.ok) {
        const data = await response.json()
        const hasDownloaded = studentResultsPdfGateSatisfied(data)
        
        if (!hasDownloaded) {
          sessionStorage.setItem('pendingReportNavigation', navPath)
          sessionStorage.setItem('pendingReportAttemptId', attemptId.toString())
        } else {
          sessionStorage.removeItem('pendingReportNavigation')
          sessionStorage.removeItem('pendingReportAttemptId')
        }
      } else {
        sessionStorage.setItem('pendingReportNavigation', navPath)
        sessionStorage.setItem('pendingReportAttemptId', attemptId.toString())
      }
    } catch (error) {
      sessionStorage.setItem('pendingReportNavigation', navPath)
      sessionStorage.setItem('pendingReportAttemptId', attemptId.toString())
    }
    
    router.push(navPath)
  }
  
  const handleRetakeClick = async (quizId: number) => {
    // Check per-quiz retake access
    try {
      let studentDatabaseId = sessionStorage.getItem("studentDatabaseId")
      
      // If missing, try to fetch from API instead of immediately redirecting
      if (!studentDatabaseId) {
        const studentId = sessionStorage.getItem("studentId")
        
        if (!studentId) {
          router.push("/student/login")
          return
        }

        try {
          // Fetch student info to get missing value
          const infoResponse = await studentApiFetch(`/api/student/info?student_id=${studentId}`)
          const infoData = await infoResponse.json()

          if (!infoResponse.ok) {
            throw new Error(infoData.error || "Failed to fetch student info")
          }

          // Update missing value
          if (infoData.student?.id) {
            studentDatabaseId = infoData.student.id.toString()
            sessionStorage.setItem("studentDatabaseId", studentDatabaseId)
          }

          // If still missing after fetch, then redirect
          if (!studentDatabaseId) {
            throw new Error("Could not retrieve session information")
          }
        } catch (error) {
          console.error("[v0] Failed to retrieve session data:", error)
          router.push("/student/login")
          return
        }
      }
      
      const response = await studentApiFetch(`/api/student/retake-access?studentId=${studentDatabaseId}&quizId=${quizId}`)
      
      if (!response.ok) {
        console.error("Retake access API returned error:", response.status, response.statusText)
        // Show upgrade modal on API error
        setShowUpgradeModal(true)
        return
      }
      
      const data = await response.json()
      
      if (data.canRetake === true) {
        handleStartQuiz(quizId)
        return
      }
      
      // canRetake is false: show custom alert based on retakeBlockReason
      if (data.retakeBlockReason === "retake_forfeited") {
        setShowForfeitAlert(true)
        return
      }
      if (data.retakeBlockReason === "retake_calendar_expired") {
        const slots = data.expiredRetakeSlots
        toast({
          title: "Retakes expired after due date",
          description:
            typeof slots === "number" && slots > 0
              ? `${slots} unused retake${slots !== 1 ? "s" : ""} expired when the deadline passed. Apply Extend (rollover) during an active window to finish.`
              : data.reason ||
                "Membership retakes for this assessment expired with the deadline. Use Extend when eligible, or contact your instructor.",
          variant: "default",
        })
        return
      }
      if (data.retakeBlockReason === "retake_max_attempts" || data.hasRetakeAccess === true) {
        toast({ title: "Maximum attempts reached", description: "You've used all attempts for this assessment.", variant: "default" })
        return
      }
      
      // No retake access (Scholar, etc.) — show upgrade modal
      setShowUpgradeModal(true)
    } catch (error) {
      console.error("Failed to check retake access:", error)
      // On error, show upgrade modal to be safe
      setShowUpgradeModal(true)
    }
  }

  const handleViewModeChange = (mode: "grid" | "list") => {
    setViewMode(mode)
  }


  // For homework, "Sort by Status" is redundant with the Status filter; use title as effective sort when status was selected
  const effectiveSortBy = assessmentType === "homework" && sortBy === "status" ? "title" : sortBy

  const filteredQuizzes = useMemo(() => {
    // Ensure quizzes is always an array
    if (!Array.isArray(quizzes)) {
      console.error("[QuizList] quizzes is not an array:", quizzes)
      return []
    }
    let list = [...quizzes]

    // Finals (and mid-semester) list only "admin" rows from the API — Official vs Practice does not apply.
    const effectiveFilterType = assessmentType === "final" || assessmentType === "mid_semester" ? "all" : filterType
    if (effectiveFilterType !== "all") list = list.filter((q) => q.quiz_type === effectiveFilterType)
    if (filterStatus === "active") list = list.filter((q) => q.is_active)
    else if (filterStatus === "completed") list = list.filter((q) => q.attempted)
    else if (filterStatus === "locked") list = list.filter((q) => !q.is_active && !q.attempted)

    if (searchQuery.trim() !== "")
      list = list.filter(
        (q) =>
          q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (q.description ?? "").toLowerCase().includes(searchQuery.toLowerCase())
      )

    if (effectiveSortBy === "title") list.sort((a, b) => a.title.localeCompare(b.title))
    else if (effectiveSortBy === "status") list.sort((a, b) => Number(b.is_active) - Number(a.is_active))
    else if (effectiveSortBy === "newest") list.sort((a, b) => b.id - a.id)

    return list
  }, [quizzes, searchQuery, filterType, filterStatus, effectiveSortBy, assessmentType])

  const hubItemsPerPage = viewMode === "grid" ? HUB_ITEMS_PER_PAGE_GRID : HUB_ITEMS_PER_PAGE_LIST
  const hubTotalPages = hubLayout ? Math.max(1, Math.ceil(filteredQuizzes.length / hubItemsPerPage)) : 1
  const hubSafePage = hubLayout ? Math.min(hubPage, hubTotalPages) : 1

  const paginatedQuizzes = useMemo(() => {
    if (!hubLayout) return filteredQuizzes
    const start = (hubSafePage - 1) * hubItemsPerPage
    return filteredQuizzes.slice(start, start + hubItemsPerPage)
  }, [filteredQuizzes, hubLayout, hubSafePage, hubItemsPerPage])

  const displayedQuizzes = hubLayout ? paginatedQuizzes : filteredQuizzes
  const showHubPagination = hubLayout && filteredQuizzes.length > hubItemsPerPage
  const hubRangeStart = filteredQuizzes.length === 0 ? 0 : (hubSafePage - 1) * hubItemsPerPage + 1
  const hubRangeEnd = Math.min(hubSafePage * hubItemsPerPage, filteredQuizzes.length)

  useEffect(() => {
    if (!hubLayout) return
    setHubPage(1)
  }, [searchQuery, filterStatus, filterType, sortBy, viewMode, hubLayout])

  useEffect(() => {
    if (!hubLayout) return
    if (hubPage > hubTotalPages) setHubPage(hubTotalPages)
  }, [hubPage, hubTotalPages, hubLayout])

  useEffect(() => {
    if (!hubLayout) return
    hubListScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
  }, [hubSafePage, hubLayout])

  useEffect(() => {
    if (!onHubMetaChange || loading) return
    onHubMetaChange({
      total: quizzes.length,
      official: quizzes.filter((q) => q.quiz_type === "admin").length,
      practice: quizzes.filter((q) => q.quiz_type === "practice").length,
      filtered: filteredQuizzes.length,
    })
  }, [quizzes, filteredQuizzes.length, onHubMetaChange, loading])

  if (loading) {
    if (hubLayout) return null
    return (
      <div className="flex items-center justify-center py-20">
        <div className={cn(embedInDashboard ? "text-[var(--cc-text-muted)]" : "text-slate-600 dark:text-slate-400")}>
          Loading {assessmentConfig.pluralName.toLowerCase()}...
        </div>
      </div>
    )
  }

  const useEmbedCards = embedInDashboard || hubLayout

  return (
    <div
      className={cn(
        "overflow-x-hidden",
        hubLayout
          ? "flex h-full min-h-0 w-full flex-1 flex-col"
          : "mx-auto max-w-full",
        embedInDashboard && !hubLayout && "overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--muted)]/25",
      )}
    >
      {!embedInDashboard && !hubLayout ? (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-6 sm:gap-4">
          <h2 className={cn("text-lg sm:text-xl md:text-2xl font-bold tracking-tight break-words", assessmentConfig.colors.primary)}>
            <span className="sm:hidden">{assessmentConfig.displayName}s</span>
            <span className="hidden sm:inline">{assessmentConfig.pluralName} Library</span>
          </h2>
      </div>
      ) : null}

      {/* Extend cutoff banner lives in AssessmentDashboardShell when embedInDashboard. */}
      {!embedInDashboard && !hubLayout &&
        rolloverPolicy &&
        !rolloverPolicy.self_service_open &&
        rolloverPolicy.show_closed_notice !== false &&
        assessmentType !== "final" && (
          <ExtendSelfServiceClosedBanner policy={rolloverPolicy} className="mb-4" />
        )}

      {/* Filters Toolbar */}
      {!hubLayout ? (
      <div
        className={cn(
          embedInDashboard
            ? "flex items-center gap-2 overflow-x-auto border-b border-[var(--border)] px-3 py-3 sm:px-4"
            : "flex items-center gap-2 flex-nowrap overflow-x-auto p-3 sm:p-4 rounded-2xl mb-4 sm:mb-6 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 sm:rounded-2xl md:p-6",
        )}
      >
        <div className={cn(embedInDashboard ? "flex min-w-0 flex-1 items-center gap-2" : "contents")}>
          {embedInDashboard ? (
            <div className="relative min-w-[10rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
              <Input
                placeholder={`Search ${assessmentConfig.pluralName.toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 pl-9 pr-9 shadow-none focus-visible:ring-1 focus-visible:ring-[var(--cc-accent)]/30"
              />
              {searchQuery.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          ) : searchOpen ? (
            <div className="relative flex items-center shrink-0 w-[140px] sm:w-[200px] md:w-[240px] min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <Input
                autoFocus
                placeholder={`Search ${assessmentConfig.pluralName.toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearchOpen(false)
                    setSearchQuery("")
                  }
                }}
                className="h-9 sm:h-10 min-h-[36px] pl-9 pr-9 rounded-xl text-xs sm:text-sm touch-manipulation w-full bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 placeholder:text-slate-500 dark:placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Close search"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSearchOpen(true)}
              className={cn(
                "h-9 w-9 shrink-0 rounded-xl touch-manipulation bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-300",
                searchQuery.trim() && "text-cyan-600 dark:text-cyan-400 border-cyan-200/80 dark:border-cyan-500/30",
              )}
              aria-label={`Search ${assessmentConfig.pluralName.toLowerCase()}`}
              title="Search"
            >
              <Search className="h-4 w-4" />
            </Button>
          )}

          <div className={cn("flex shrink-0 items-center gap-1.5", embedInDashboard && "ml-auto")}>
        {assessmentType === "quiz" ? (
        <TouchFriendlySelect
          value={filterType}
          onValueChange={(v) => setFilterType(v as typeof filterType)}
          options={[
            { value: "all", label: "All Types" },
            { value: "admin", label: "Official" },
            { value: "practice", label: "Practice" },
          ]}
          placeholder="Type"
          triggerClassName={cn(
            "w-[108px] sm:w-[120px] shrink-0 h-9 sm:h-10 min-h-[36px] text-xs sm:text-sm touch-manipulation text-foreground dark:text-slate-100",
            embedInDashboard
              ? "rounded-xl border-[var(--border)] bg-[var(--muted)]/40"
              : "rounded-full bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60",
          )}
          contentClassName="dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
          icon={<Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5 text-slate-600 dark:text-slate-400 shrink-0" />}
        />
        ) : null}

        <TouchFriendlySelect
          value={filterStatus}
          onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "completed", label: "Completed" },
            { value: "locked", label: "Locked" },
          ]}
          placeholder="Status"
          triggerClassName={cn(
            "w-[96px] sm:w-[112px] shrink-0 h-9 sm:h-10 min-h-[36px] text-xs sm:text-sm touch-manipulation text-foreground dark:text-slate-100",
            embedInDashboard
              ? "rounded-xl border-[var(--border)] bg-[var(--muted)]/40"
              : "rounded-full bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60",
          )}
          contentClassName="dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
          icon={<ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5 text-slate-600 dark:text-slate-400 shrink-0" />}
        />

        {assessmentType !== "homework" && !embedInDashboard && (
          <TouchFriendlySelect
            value={effectiveSortBy}
            onValueChange={(v) => setSortBy(v as typeof sortBy)}
            options={[
              { value: "title", label: "Title" },
              { value: "status", label: "Status" },
              { value: "newest", label: "Newest" },
            ]}
            placeholder="Sort"
            triggerClassName={cn(
              "w-[96px] sm:w-[112px] shrink-0 h-9 sm:h-10 min-h-[36px] text-xs sm:text-sm touch-manipulation text-foreground dark:text-slate-100",
              embedInDashboard
                ? "rounded-xl border-[var(--border)] bg-[var(--muted)]/40"
                : "rounded-full bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60",
            )}
            contentClassName="dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
            icon={<SortAsc className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5 text-slate-600 dark:text-slate-400 shrink-0" />}
          />
        )}

        <div
          className={cn(
            "shrink-0",
            embedInDashboard
              ? portalViewOrganizerContainerClass()
              : "flex items-center gap-1 p-1 rounded-full bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 ml-auto",
          )}
          role="group"
          aria-label="View organizer"
        >
          <Button
            variant="ghost"
            onClick={() => handleViewModeChange("grid")}
            size="icon"
            className={cn(
              "transition-all touch-manipulation shadow-none",
              embedInDashboard
                ? viewMode === "grid"
                  ? portalViewOrganizerActiveClass(assessmentsTheme)
                  : portalViewOrganizerInactiveClass()
                : cn(
                    "h-8 w-8 rounded-lg",
                    viewMode === "grid"
                      ? cn(assessmentConfig.colors.gradient, "hover:opacity-90 text-white shadow-sm")
                      : "text-slate-500 dark:text-slate-400",
                  ),
            )}
            aria-label="Grid view"
            aria-pressed={viewMode === "grid"}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => handleViewModeChange("list")}
            size="icon"
            className={cn(
              "transition-all touch-manipulation shadow-none",
              embedInDashboard
                ? viewMode === "list"
                  ? portalViewOrganizerActiveClass(assessmentsTheme)
                  : portalViewOrganizerInactiveClass()
                : cn(
                    "h-8 w-8 rounded-lg",
                    viewMode === "list"
                      ? cn(assessmentConfig.colors.gradient, "hover:opacity-90 text-white shadow-sm")
                      : "text-slate-500 dark:text-slate-400",
                  ),
            )}
            aria-label="List view"
            aria-pressed={viewMode === "list"}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
          </div>
        </div>
      </div>
      ) : null}

      {/* Practice Hub - standalone quiz page only (not in dashboard-v2 / native assessments list) */}
      {assessmentType === "quiz" && !embedInDashboard && !hubLayout && (
      <div className={cn(
        "rounded-2xl overflow-hidden border",
        embedInDashboard ? "mb-4 sm:mb-5" : "mb-6 sm:mb-8",
        embedInDashboard
          ? "border-amber-200/60 dark:border-amber-500/20 bg-amber-50/60 dark:bg-amber-950/30"
          : "border-amber-200/60 dark:border-slate-700/60 bg-amber-50/80 dark:bg-slate-800/85 backdrop-blur-sm hover:shadow-[0_8px_25px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_8px_25px_rgba(0,0,0,0.4)] transition-all duration-300"
      )}>
        <div className={embedInDashboard ? "p-4 sm:p-5" : "p-6 sm:p-8"}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className={cn(
                "h-11 w-11 sm:h-14 sm:w-14 rounded-2xl flex items-center justify-center shrink-0",
                embedInDashboard ? "bg-amber-500/25 dark:bg-amber-500/30 text-amber-600 dark:text-amber-400" : "bg-amber-100/80 dark:bg-blue-900/80 shadow-sm"
              )}>
                <Lightbulb className={cn("h-5 w-5 sm:h-7 sm:w-7", embedInDashboard ? "text-amber-600 dark:text-amber-400" : "text-amber-700 dark:text-blue-400")} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-xl font-semibold text-slate-900 dark:text-white">Practice Hub</h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                  Create personalized practice sessions from the question bank
                </p>
              </div>
            </div>
            <Link href={embedInDashboard ? "/student/dashboard-v2/practice" : "/student/practice"} className="w-full sm:w-auto sm:shrink-0">
              <Button className={cn(
                "w-full sm:min-w-[180px] rounded-2xl font-semibold min-h-[48px] touch-manipulation shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all",
                embedInDashboard
                  ? "bg-[#eaaa00] hover:bg-amber-500 text-white border-0"
                  : "bg-amber-500 dark:bg-blue-600 hover:bg-amber-600 dark:hover:bg-blue-700 text-white"
              )}>
                Start Practicing
              </Button>
            </Link>
          </div>
        </div>
      </div>
      )}

      {/* Quizzes/Homework List */}
      {filteredQuizzes.length === 0 ? (
        <div className={cn(
          "flex flex-col items-center justify-center text-center space-y-4",
          hubLayout
            ? "h-full flex-1 py-10"
            : cn("py-16 sm:py-20", useEmbedCards && "rounded-2xl border border-[var(--border)] bg-[var(--muted)]/30 py-10"),
        )}>
          <div className={cn(
            "flex size-14 items-center justify-center rounded-2xl",
            useEmbedCards ? "bg-[var(--cc-accent-soft)]" : "bg-slate-100/80 dark:bg-slate-700/80 p-4 rounded-2xl"
          )}>
            <FolderOpen className={cn("h-7 w-7", useEmbedCards ? "text-[var(--cc-accent)]" : "text-slate-400 dark:text-slate-500")} />
          </div>
          <p className={cn("text-base sm:text-lg font-medium", useEmbedCards ? "text-[var(--cc-text)]" : "text-slate-600 dark:text-slate-400")}>
            No {assessmentConfig.pluralName.toLowerCase()} match your filters.
          </p>
          {useEmbedCards ? (
            <p className="text-sm text-[var(--cc-text-muted)]">Try another search, status filter, or browse category.</p>
          ) : null}
        </div>
      ) : (
        <div className={cn("relative min-w-0 w-full", hubLayout && "flex min-h-0 flex-1 flex-col")}>
          <div
            ref={hubListScrollRef}
            className={cn("min-w-0 w-full", hubLayout && "min-h-0 flex-1 overflow-y-auto p-3 sm:p-4")}
          >
          <div
            className={cn(
              "min-w-0 w-full",
              useEmbedCards
                ? cn(
                    viewMode === "grid"
                      ? "grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-1"
                      : "flex w-full flex-col gap-2",
                  )
                : cn(
                    "overflow-y-auto overflow-x-hidden pr-2 scrollbar-modern",
                    viewMode === "grid"
                      ? "grid grid-cols-1 sm:grid-cols-2 auto-rows-max gap-3 sm:gap-4"
                      : "space-y-3 sm:space-y-4",
                  ),
            )}
            style={useEmbedCards ? undefined : { maxHeight: "min(80vh, 800px)" }}
          >
          {displayedQuizzes.map((quiz) => {
            const actionConfig = buildQuizActionConfig(quiz, assessmentConfig.displayName, {
              handleViewReport,
              handleRetakeClick,
              handleStartQuiz,
              handleApplyRollover,
              setFinalAllowlistModalOpen,
              applyingRollover,
            })

            if (useEmbedCards) {
              return (
                <EmbeddedAssessmentCard
                  key={quiz.id}
                  quiz={quiz}
                  viewMode={viewMode}
                  assessmentLabel={assessmentConfig.displayName}
                  assessmentType={assessmentType}
                  startGradient={assessmentConfig.colors.gradient}
                  formatDate={formatPostedOrDue}
                  displayPercent={quizDisplayPercent(quiz)}
                  isClosed={isAssessmentClosedForDisplay(quiz)}
                  isBeforeOpen={isBeforeOpenWindow(quiz)}
                  {...actionConfig}
                />
              )
            }

            return (
            <Card
              key={quiz.id}
              className={cn(
                "flex overflow-hidden transition-all duration-300 min-w-0",
                viewMode === "list"
                  ? "flex-col sm:flex-row sm:items-center sm:h-auto"
                  : "flex-col justify-between",
                viewMode === "list"
                  ? embedInDashboard ? "" : "md:h-32"
                  : embedInDashboard ? "min-h-[160px] sm:min-h-[180px]" : "min-h-[200px] sm:min-h-[220px]",
                embedInDashboard
                  ? "border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] hover:shadow-[0_6px_24px_rgba(59,130,246,0.12)] dark:hover:shadow-[0_8px_32px_rgba(59,130,246,0.2)] rounded-2xl"
                  : "border border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)] rounded-xl sm:rounded-2xl"
              )}
            >
              {viewMode === "list" ? (
                // List View - Professional Horizontal Layout
                <div className={cn(
                  "flex w-full min-w-0 gap-3",
                  embedInDashboard ? "flex-col" : "flex-col sm:flex-row sm:items-center sm:gap-0",
                  embedInDashboard ? "p-3 sm:p-4" : "p-4 sm:p-5 md:p-6"
                )}>
                  {/* Status Indicator - Left Edge */}
                  <div className={cn("hidden sm:flex flex-shrink-0", embedInDashboard ? "sm:mr-3" : "sm:mr-4")}>
                    <div className={cn(
                      "w-1 rounded-full",
                      embedInDashboard ? "h-12 sm:h-14" : "h-14 sm:h-16",
                      quiz.saved_for_later
                        ? "bg-blue-500"
                        : quiz.attempted
                        ? "bg-emerald-500"
                        : quiz.is_active
                        ? assessmentType === "homework"
                          ? "bg-teal-500"
                          : "bg-purple-500"
                        : "bg-slate-300"
                    )} />
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 min-w-0 sm:py-2">
                    {/* Header Row */}
                    <div className={cn(
                      "flex items-start justify-between",
                      embedInDashboard ? "mb-2 sm:mb-2" : "mb-2 sm:mb-3"
                    )}>
                      <div className={cn("flex-1 min-w-0", embedInDashboard ? "sm:pr-3" : "sm:pr-4")}>
                        <h3 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-200 break-words sm:truncate">
                          {quiz.title}
                        </h3>
                        {stripAssessmentInstructions(quiz.description) ? (
                          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                            {stripAssessmentInstructions(quiz.description)}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {/* Details Row */}
                    <div className={cn(
                      "flex min-w-0",
                      embedInDashboard
                        ? "flex-col gap-3"
                        : "flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0"
                    )}>
                      <div className={cn(
                        "flex items-center flex-wrap",
                        embedInDashboard ? "gap-2 sm:gap-2" : "gap-2 sm:gap-3 md:gap-4"
                      )}>
                        {/* Quiz Type & Status */}
                        <div className="flex items-center gap-3">
                          {/* Official Badge */}
                          {quiz.quiz_type === "admin" && (
                            <div className="flex items-center gap-1.5">
                              <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded-md">
                                <ShieldCheck className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                              </div>
                              <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Official</span>
                            </div>
                          )}

                          {/* Status Badge with Icon */}
                          {quiz.saved_for_later ? (
                            <div className="flex items-center gap-1.5">
                              <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded-md">
                                <Clock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                              </div>
                              <span className="text-xs font-medium text-blue-700 dark:text-blue-400">In Progress</span>
                            </div>
                          ) : quiz.attempted ? (
                            <div className="flex items-center gap-1.5">
                              <div className="p-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-md">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Completed</span>
                            </div>
                          ) : quiz.rollover_active ? (
                            <div className="flex items-center gap-1.5">
                              <div className="p-1 bg-amber-100 dark:bg-amber-900/30 rounded-md">
                                <Timer className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                              </div>
                              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Rollover Active</span>
                            </div>
                          ) : quiz.final_access_pending_allowlist && quiz.is_active ? (
                            <div className="flex items-center gap-1.5">
                              <div className="p-1 bg-amber-100 dark:bg-amber-900/30 rounded-md">
                                <AlertCircle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                              </div>
                              <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
                                Access pending
                              </span>
                            </div>
                          ) : quiz.is_active ? (
                            <div className="flex items-center gap-1.5">
                              <div className={cn("p-1 rounded-md", assessmentsTheme.page.softBg)}>
                                <Zap className={cn("h-3 w-3", assessmentsTheme.page.iconText)} />
                              </div>
                              <span className={cn("text-xs font-medium", assessmentsTheme.page.iconText)}>Active</span>
                            </div>
                          ) : (quiz.can_apply_rollover || quiz.rollover_requires_upgrade) ? (
                            <div className="flex items-center gap-1.5">
                              <div className="p-1 bg-amber-100 dark:bg-amber-900/30 rounded-md">
                                <Timer className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                              </div>
                              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Past Due – Extend</span>
                            </div>
                          ) : isAssessmentClosedForDisplay(quiz) ? (
                            <div className="flex items-center gap-1.5">
                              <div className="p-1 bg-red-100 dark:bg-red-900/30 rounded-md">
                                <AlertCircle className="h-3 w-3 text-red-600 dark:text-red-400" />
                              </div>
                              <span className="text-xs font-medium text-red-700 dark:text-red-400">Closed</span>
                            </div>
                          ) : quiz.session_access_active === false ? (
                            <div className="flex items-center gap-1.5">
                              <div className="p-1 bg-slate-100 dark:bg-slate-700 rounded-md">
                                <Pause className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                              </div>
                              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Inactive</span>
                            </div>
                          ) : isBeforeOpenWindow(quiz) ? (
                            <div className="flex items-center gap-1.5">
                              <div className="p-1 bg-slate-100 dark:bg-slate-700 rounded-md">
                                <Calendar className="h-3 w-3 text-slate-600 dark:text-slate-400" />
                              </div>
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Not yet open</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <div className="p-1 bg-slate-100 dark:bg-slate-700 rounded-md">
                                <Pause className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                              </div>
                              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Inactive</span>
                            </div>
                          )}
                        </div>

                        {/* Question Count */}
                        <div className="flex items-center gap-1.5">
                          <div className="p-1 bg-slate-100 dark:bg-slate-700 rounded-md">
                            <Lightbulb className="h-3 w-3 text-slate-600 dark:text-slate-400" />
                          </div>
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {quiz.question_count} Qs
                          </span>
                        </div>

                        {/* Time Limit */}
                        <div className="flex items-center gap-1.5">
                          <div className="p-1 bg-amber-100 dark:bg-amber-900/30 rounded-md">
                            <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                          </div>
                          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                            {quizTimerLabel(quiz)}
                          </span>
                        </div>

                        {/* Posted & Deadline */}
                        {(quiz.available_from || quiz.available_until) && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className="p-1 bg-slate-100 dark:bg-slate-700 rounded-md">
                              <Calendar className="h-3 w-3 text-slate-600 dark:text-slate-400" />
                            </div>
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                              Posted: {formatPostedOrDue(quiz.available_from ?? quiz.created_at)}
                            </span>
                            {quiz.available_until && (
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                · Due: {formatPostedOrDue(quiz.available_until)}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Score (if attempted and completed) */}
                        {quiz.attempted && quiz.completed && (
                          <div
                            className={cn(
                              "flex gap-1.5",
                              embedInDashboard ? "flex-col items-start" : "items-center",
                            )}
                          >
                            <div className="flex items-center gap-1.5">
                              <div className="p-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-md">
                                <Award className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                {quizDisplayPercent(quiz) ?? 0}%
                              </span>
                            </div>
                            {quiz.calendar_retake_perks_expired ? (
                              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                {quiz.expired_retake_slots != null && quiz.expired_retake_slots > 0
                                  ? `${quiz.expired_retake_slots} retake${quiz.expired_retake_slots !== 1 ? "s" : ""} expired (grace period ended)`
                                  : "Retakes expired (grace period ended)"}
                              </span>
                            ) : (
                              !isSingleSittingAssessmentType(assessmentType) &&
                              quiz.can_retake &&
                              quiz.attempts_remaining != null &&
                              quiz.attempts_remaining > 0 && (
                                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                  {quiz.attempts_remaining} retake{quiz.attempts_remaining !== 1 ? "s" : ""} left
                                </span>
                              )
                            )}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className={cn(
                        "w-full min-w-0",
                        embedInDashboard
                          ? "pt-1 border-t border-slate-200/60 dark:border-white/10 [&_button]:w-full"
                          : "sm:w-auto sm:ml-4"
                      )}>
                        {(() => {
                          const hasReport = !!(quiz.attempted && quiz.attempt_id && quiz.completed)
                          const savedForLater = !!(quiz.saved_for_later && (quiz.is_active || quiz.rollover_active))
                          const canExtend = !!((quiz.can_apply_rollover || quiz.rollover_requires_upgrade) && !quiz.rollover_active)
                          const canStart = canShowStartAssessment(quiz)
                          const pendingFinalAllowlist =
                            !!quiz.final_access_pending_allowlist && quiz.is_active
                          const startLabelAfterDue = primaryOpenAfterDueLabel(
                            quiz,
                            canStart,
                            savedForLater,
                            assessmentConfig.displayName,
                          )
                          const noPrimaryAction =
                            !hasReport && !savedForLater && !canExtend && !canStart
                          // Past due with no primary action = closed (even if section session is inactive).
                          const closedByDeadline =
                            noPrimaryAction &&
                            !quiz.rollover_active &&
                            isAssessmentClosedForDisplay(quiz)
                          const lockedNotAvailable = noPrimaryAction && !closedByDeadline
                          return (
                            <AssessmentActionButtons
                              layout={embedInDashboard ? "stacked" : "horizontal"}
                              compact
                              assessmentLabel={assessmentConfig.displayName}
                              startGradient={assessmentConfig.colors.gradient}
                              onViewReport={quiz.attempt_id ? () => handleViewReport(quiz.attempt_id!) : undefined}
                              onRetake={
                                hasReport &&
                                (quiz.is_active || quiz.rollover_active) &&
                                !quiz.final_access_pending_allowlist
                                  ? () => handleRetakeClick(quiz.id)
                                  : undefined
                              }
                              onContinue={savedForLater ? () => handleStartQuiz(quiz.id) : undefined}
                              onExtend={canExtend ? () => handleApplyRollover(quiz) : undefined}
                              extending={applyingRollover === quiz.id}
                              extendLabel={
                                quiz.rollover_requires_upgrade
                                  ? "Extend (Upgrade)"
                                  : `Extend (${quiz.rollover_hours ?? 24}h${
                                      quiz.rollover_membership_applies_max != null &&
                                      quiz.rollover_membership_applies_max > 1
                                        ? ` · ${Math.max(
                                            0,
                                            (quiz.rollover_membership_applies_max ?? 0) -
                                              (quiz.rollover_membership_applies_used ?? 0),
                                          )} left`
                                        : ""
                                    })`
                              }
                              onStart={canStart ? () => handleStartQuiz(quiz.id) : undefined}
                              startLabel={startLabelAfterDue}
                              closedLabel="Closed"
                              lockedLabel={
                                pendingFinalAllowlist
                                  ? "Access pending — tap for details"
                                  : lockedNotAvailable && isBeforeOpenWindow(quiz)
                                    ? `Opens ${formatPostedOrDue(quiz.available_from)}`
                                    : undefined
                              }
                              onLockedInfo={
                                pendingFinalAllowlist ? () => setFinalAllowlistModalOpen(true) : undefined
                              }
                              show={{
                                report: hasReport,
                                retake:
                                  hasReport &&
                                  !!quiz.can_retake &&
                                  !!(quiz.is_active || quiz.rollover_active) &&
                                  !quiz.final_access_pending_allowlist,
                                continue: savedForLater,
                                extend: !hasReport && !savedForLater && canExtend,
                                start: !hasReport && !savedForLater && !canExtend && canStart,
                                closed: closedByDeadline,
                                locked: lockedNotAvailable,
                              }}
                              fullWidthMobile
                            />
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Grid View - Original Layout
                <>
                  {/* Header */}
                  <CardHeader className={cn(
                    "pb-2 sm:pb-3 space-y-2 sm:space-y-3",
                    embedInDashboard ? "p-3 sm:p-4" : "p-4 sm:p-5"
                  )}>
                    {/* Row 1: Title + Status */}
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <CardTitle className="text-base sm:text-lg font-bold tracking-tight text-slate-800 dark:text-slate-200 leading-tight line-clamp-2 flex-1 break-words">
                        {quiz.title}
                      </CardTitle>

                      {quiz.saved_for_later ? (
                        <Badge
                          variant="outline"
                          className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 whitespace-nowrap rounded-full px-3 py-1"
                        >
                          <Clock className="h-3 w-3 mr-1" /> In Progress
                        </Badge>
                      ) : quiz.attempted ? (
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 whitespace-nowrap rounded-full px-3 py-1"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Done
                        </Badge>
                      ) : quiz.rollover_active ? (
                        <Badge className="bg-amber-600 hover:bg-amber-700 text-white whitespace-nowrap rounded-full shadow-sm px-3 py-1">
                          Rollover Active
                        </Badge>
                      ) : quiz.final_access_pending_allowlist && quiz.is_active ? (
                        <Badge
                          variant="outline"
                          className="whitespace-nowrap rounded-full border-amber-400 dark:border-amber-500 text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 px-3 py-1"
                        >
                          Access pending
                        </Badge>
                      ) : quiz.is_active ? (
                        <Badge className={cn(assessmentsTheme.page.cta, "border-0 whitespace-nowrap rounded-full shadow-sm px-3 py-1")}>
                          Active
                        </Badge>
                      ) : (quiz.can_apply_rollover || quiz.rollover_requires_upgrade) ? (
                        <Badge variant="outline" className="whitespace-nowrap rounded-full border-amber-400 dark:border-amber-500 text-amber-700 dark:text-amber-400 px-3 py-1">
                          Past Due – Extend
                        </Badge>
                      ) : isAssessmentClosedForDisplay(quiz) ? (
                        <Badge variant="outline" className="whitespace-nowrap rounded-full border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 px-3 py-1">
                          Closed
                        </Badge>
                      ) : quiz.session_access_active === false ? (
                        <Badge variant="outline" className="whitespace-nowrap rounded-full border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 px-3 py-1">
                          Inactive
                        </Badge>
                      ) : isBeforeOpenWindow(quiz) ? (
                        <Badge variant="outline" className="whitespace-nowrap rounded-full border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 px-3 py-1">
                          Not yet open
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="whitespace-nowrap rounded-full border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 px-3 py-1">
                          Inactive
                        </Badge>
                      )}
                    </div>

                    {stripAssessmentInstructions(quiz.description) ? (
                      <CardDescription className="text-xs sm:text-sm line-clamp-3 leading-relaxed">
                        {stripAssessmentInstructions(quiz.description)}
                      </CardDescription>
                    ) : null}

                    {/* Row 2: Type Badges */}
                    <div className="flex items-center gap-3">
                      {quiz.quiz_type === "admin" && (
                        <Badge
                          variant="outline"
                          className="text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 rounded-full text-sm font-medium px-3 py-1"
                        >
                          <ShieldCheck className="h-4 w-4 mr-1.5" /> Official
                        </Badge>
                      )}
                      {quiz.quiz_type === "practice" && (
                        <Badge
                          variant="outline"
                          className={cn("rounded-full text-sm font-medium px-3 py-1 border", assessmentsTheme.page.badge)}
                        >
                          <Lightbulb className="h-4 w-4 mr-1.5" /> Practice
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  {/* Body */}
                  <CardContent className={cn(
                    "flex-grow pb-2 sm:pb-3",
                    embedInDashboard ? "px-3 sm:px-4" : "px-4 sm:px-5"
                  )}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-2 sm:mb-3">
                      <span className="flex items-center gap-1.5 sm:gap-2">
                        <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                        <span className="break-words">{quizTimerLabel(quiz)}{quiz.timer_display_label ? "" : "/question"}</span>
                      </span>
                      <span className="font-medium">{quiz.question_count} Questions</span>
                    </div>
                    {(quiz.available_from || quiz.available_until) && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-2">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          Posted: {formatPostedOrDue(quiz.available_from ?? quiz.created_at)}
                          {quiz.available_until && (
                            <> · Due: {formatPostedOrDue(quiz.available_until)}</>
                          )}
                        </span>
                      </div>
                    )}

                    {quiz.attempted && quiz.completed && (
                      <div className="mt-2 sm:mt-3 bg-slate-50/80 dark:bg-slate-700/80 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm border border-slate-200/50 dark:border-slate-600/50">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          Score:{" "}
                          {quizDisplayScoreLine(quiz) ??
                            (quiz.grade_status === "pending" || quiz.grade_released === false
                              ? "Under review"
                              : quiz.score != null && quiz.total_questions != null
                                ? `${quiz.score}/${quiz.total_questions}`
                                : "—")}
                        </p>
                        {quiz.calendar_retake_perks_expired ? (
                          <p className="mt-1 text-amber-700 dark:text-amber-400 font-medium">
                            {quiz.expired_retake_slots != null && quiz.expired_retake_slots > 0
                              ? `${quiz.expired_retake_slots} retake${quiz.expired_retake_slots !== 1 ? "s" : ""} expired after the due date`
                              : "Retakes expired after the due date"}
                          </p>
                        ) : (
                          !isSingleSittingAssessmentType(assessmentType) &&
                          quiz.can_retake &&
                          quiz.attempts_remaining != null &&
                          quiz.attempts_remaining > 0 && (
                            <p className="mt-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              {quiz.attempts_remaining} retake{quiz.attempts_remaining !== 1 ? "s" : ""} left
                            </p>
                          )
                        )}
                      </div>
                    )}
                  </CardContent>

                  {/* Footer */}
                  <CardFooter className={cn(
                    "mt-auto pt-0 flex justify-end",
                    embedInDashboard ? "p-3 sm:p-4" : "p-4 sm:p-5"
                  )}>
                {(() => {
                  const hasReport = !!(quiz.attempted && quiz.attempt_id && quiz.completed)
                  const savedForLater = !!(quiz.saved_for_later && (quiz.is_active || quiz.rollover_active))
                  const canExtend = !!((quiz.can_apply_rollover || quiz.rollover_requires_upgrade) && !quiz.rollover_active)
                  const canStart = canShowStartAssessment(quiz)
                  const pendingFinalAllowlist =
                    !!quiz.final_access_pending_allowlist && quiz.is_active
                  const startLabelAfterDue = primaryOpenAfterDueLabel(
                    quiz,
                    canStart,
                    savedForLater,
                    assessmentConfig.displayName,
                  )
                  const noPrimaryAction =
                    !hasReport && !savedForLater && !canExtend && !canStart
                  const closedByDeadline =
                    noPrimaryAction &&
                    !quiz.rollover_active &&
                    isAssessmentClosedForDisplay(quiz)
                  const lockedNotAvailable = noPrimaryAction && !closedByDeadline
                  return (
                    <AssessmentActionButtons
                      layout="horizontal"
                      align="right"
                      assessmentLabel={assessmentConfig.displayName}
                      startGradient={assessmentConfig.colors.gradient}
                      onViewReport={quiz.attempt_id ? () => handleViewReport(quiz.attempt_id) : undefined}
                      onRetake={
                        hasReport &&
                        (quiz.is_active || quiz.rollover_active) &&
                        !quiz.final_access_pending_allowlist
                          ? () => handleRetakeClick(quiz.id)
                          : undefined
                      }
                      onContinue={savedForLater ? () => handleStartQuiz(quiz.id) : undefined}
                      onExtend={canExtend ? () => handleApplyRollover(quiz) : undefined}
                      extending={applyingRollover === quiz.id}
                      extendLabel={
                        quiz.rollover_requires_upgrade
                          ? "Extend (Upgrade)"
                          : `Extend (${quiz.rollover_hours ?? 24}h${
                              quiz.rollover_membership_applies_max != null &&
                              quiz.rollover_membership_applies_max > 1
                                ? ` · ${Math.max(
                                    0,
                                    (quiz.rollover_membership_applies_max ?? 0) -
                                      (quiz.rollover_membership_applies_used ?? 0),
                                  )} left`
                                : ""
                            })`
                      }
                      onStart={canStart ? () => handleStartQuiz(quiz.id) : undefined}
                      startLabel={startLabelAfterDue}
                      closedLabel="Closed"
                      lockedLabel={
                        pendingFinalAllowlist
                          ? "Access pending — tap for details"
                          : lockedNotAvailable && isBeforeOpenWindow(quiz)
                            ? `Opens ${formatPostedOrDue(quiz.available_from)}`
                            : undefined
                      }
                      onLockedInfo={
                        pendingFinalAllowlist ? () => setFinalAllowlistModalOpen(true) : undefined
                      }
                      show={{
                        report: hasReport,
                        retake:
                          hasReport &&
                          !!quiz.can_retake &&
                          !!(quiz.is_active || quiz.rollover_active) &&
                          !quiz.final_access_pending_allowlist,
                        continue: savedForLater,
                        extend: !hasReport && !savedForLater && canExtend,
                        start: !hasReport && !savedForLater && !canExtend && canStart,
                        closed: closedByDeadline,
                        locked: lockedNotAvailable,
                      }}
                      fullWidthMobile
                    />
                  )
                })()}
              </CardFooter>
                </>
              )}
            </Card>
          )})}
          </div>

          {/* Scroll Indicator — legacy standalone / embed lists only */}
          {!hubLayout && filteredQuizzes.length > 8 && (
            <div className="mt-6 flex justify-center">
              <div className={cn(
                "flex items-center gap-2 rounded-xl border px-4 py-2",
                embedInDashboard ? "border-slate-200/80 bg-slate-50/50 dark:border-white/10 dark:bg-white/5" : "border-slate-200/60 bg-slate-100/80 dark:border-slate-700/60 dark:bg-slate-700/80"
              )}>
                <div className="h-2 w-2 animate-pulse rounded-full bg-slate-400 dark:bg-slate-500" />
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Scroll to see more {assessmentConfig.pluralName.toLowerCase()}
                </span>
              </div>
            </div>
          )}
          </div>

          {showHubPagination ? (
            <div className="flex shrink-0 flex-col gap-2 border-t border-[var(--border)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <p className="text-center text-xs text-[var(--cc-text-muted)] sm:text-left">
                Showing {hubRangeStart}–{hubRangeEnd} of {filteredQuizzes.length}
              </p>
              <Pagination className="mx-0 w-auto justify-center sm:justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(event) => {
                        event.preventDefault()
                        if (hubSafePage > 1) setHubPage(hubSafePage - 1)
                      }}
                      className={
                        hubSafePage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
                      }
                      aria-disabled={hubSafePage <= 1}
                    />
                  </PaginationItem>
                  {Array.from({ length: hubTotalPages }, (_, i) => i + 1).map((page) => (
                    <PaginationItem key={page} className="hidden sm:list-item">
                      <PaginationLink
                        href="#"
                        onClick={(event) => {
                          event.preventDefault()
                          setHubPage(page)
                        }}
                        isActive={hubSafePage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(event) => {
                        event.preventDefault()
                        if (hubSafePage < hubTotalPages) setHubPage(hubSafePage + 1)
                      }}
                      className={
                        hubSafePage >= hubTotalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                      aria-disabled={hubSafePage >= hubTotalPages}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          ) : null}
        </div>
      )}

      {embedInDashboard && !hubLayout ? (
        <div className="border-t border-[var(--border)] px-3 py-2.5 sm:px-4">
          <p className="text-xs text-[var(--cc-text-muted)]">
            {assessmentConfig.pluralName}
            <span className="text-[var(--cc-text)]"> · {filteredQuizzes.length} shown</span>
          </p>
        </div>
      ) : null}
      
      <AlertDialog open={finalAllowlistModalOpen} onOpenChange={setFinalAllowlistModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Final exam access</AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <span className="block">
                Your instructor is using a manual access list for this final. You can see it on your schedule,
                but you cannot start until your name is added to that list.
              </span>
              <span className="block font-medium text-foreground">
                Please contact your instructor if you believe you should have access.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setFinalAllowlistModalOpen(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Retake Upgrade Modal */}
      <RetakeUpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        assessmentType={assessmentConfig.displayName}
      />
      {/* Retake Forfeit Alert: shown when student viewed report and forfeited retake */}
      <RetakeForfeitAlert
        open={showForfeitAlert}
        onClose={() => setShowForfeitAlert(false)}
        assessmentLabel={assessmentConfig.displayName.toLowerCase()}
      />
      {/* Rollover Upgrade Modal: shown when non-Trailblazer clicks Extend on missed assessment */}
      <RolloverUpgradeModal
        open={showRolloverUpgradeModal}
        onClose={() => setShowRolloverUpgradeModal(false)}
      />
      <RolloverConfirmModal
        open={rolloverConfirmQuiz != null}
        onOpenChange={(open) => {
          if (!open && applyingRollover == null) setRolloverConfirmQuiz(null)
        }}
        quizTitle={rolloverConfirmQuiz?.title ?? ""}
        rolloverHours={rolloverConfirmQuiz?.rollover_hours ?? 24}
        membershipAppliesUsed={rolloverConfirmQuiz?.rollover_membership_applies_used ?? 0}
        membershipAppliesMax={rolloverConfirmQuiz?.rollover_membership_applies_max ?? 1}
        policy={rolloverPolicy}
        onConfirm={() => void confirmApplyRollover()}
        confirming={
          rolloverConfirmQuiz != null && applyingRollover === rolloverConfirmQuiz.id
        }
      />
    </div>
  )
}
