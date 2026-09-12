"use client"

import { useEffect, useState, useMemo, Fragment } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
import { useToast } from "@/components/ui/use-toast"
import {
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  AlertTriangle,
  AlertCircle,
  Eye,
  Bookmark,
  BookmarkCheck,
  Copy,
  RefreshCw,
  CheckCircle2,
  Gift,
  FileText,
  Save,
  MessageSquare,
  ArrowRight,
  Calendar,
  Clock,
  Users,
  BarChart3,
  Settings,
  Target,
  Zap,
  Brain,
  Database,
  Shield,
  TrendingUp,
  Award,
  Lightbulb,
  CheckCircle,
  XCircle,
  Info,
  Download,
  Bot,
  MoreVertical,
  Mail,
  Loader2,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { usePreventBack } from "@/hooks/use-prevent-back"
import { usePersistedState, useScrollRestoration } from "@/hooks/use-persisted-state"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CreateQuizFromBankWizard } from "@/components/create-quiz-from-bank-wizard"
import { AdminQuizIssues } from "@/components/admin-quiz-issues"
import { InstructorQuizIssues } from "@/components/instructor-quiz-issues"
import { AssessmentResultsViewer } from "@/components/assessment-results-viewer"
import { AssessmentAnalytics } from "@/components/assessment-analytics"
import { useAssessment } from "@/context/assessment-context"
import { InstructorAiEvaluationManager } from "@/components/instructor-ai-evaluation-manager"
import { AssessmentBulkReevaluateModal } from "@/components/assessment-bulk-reevaluate-modal"
import { BulkReevaluateAttemptsPanel } from "@/components/bulk-reevaluate-attempts-panel"
import { InstructorMembershipDisclaimerBanner } from "@/components/governance/InstructorMembershipDisclaimerBanner"
import type { AssessmentBulkReevaluateScope } from "@/hooks/use-bulk-reevaluate-attempts"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui/pagination"
import { cn } from "@/lib/utils"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { buildQuizReleaseTargets, lectureReleaseTargets } from "@/lib/quiz-release-targets"
import { buildAdminApiHeaders } from "@/lib/admin-api-headers"
import { getPortalConfig } from "@/lib/portal-config"
import { instructorQuizzesAssessmentTypeParam } from "@/lib/instructor-quizzes-api-params"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import {
  InstructorAssessmentListToolbar,
  filterAndSortAssessments,
  type AssessmentListSort,
  type AssessmentListStatusFilter,
  type AssessmentListViewMode,
} from "@/components/instructor-assessment-list-toolbar"
import {
  InstructorAssessmentCard,
  type InstructorAssessmentCardQuiz,
} from "@/components/instructor-assessment-card"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import {
  AM_EMPTY,
  AM_EMPTY_FILL,
  AM_LIST_ROW,
  AM_PANEL,
  AM_PANEL_FILL,
  AM_PANEL_SCROLL,
  AM_PANEL_SECTION,
  AM_ROW,
  AM_STAT_BOX,
  AM_STATUS_PILL,
  AM_TILE,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/assessments/assessment-management-surface-classes"
import { portalListStripe } from "@/lib/portal-module-themes"

import { useAppConfirm } from "@/components/providers/app-confirm-provider"
const ASSESSMENTS_PAGE_SIZE = 8

/** Short sidebar label for the primary "all items" tab (avoids wrapping long plural names). */
function allAssessmentsMenuLabel(type: string, pluralLabel: string): string {
  switch (type) {
    case "homework":
      return "All Homework"
    case "mid_semester":
      return "All Mid-Semester"
    case "final":
      return "All Finals"
    default:
      return `All ${pluralLabel}`
  }
}

function formatDeletedCountdown(deletedAt: string) {
  const elapsed = Date.now() - new Date(deletedAt).getTime()
  const hoursRemaining = 24 - Math.floor(elapsed / (1000 * 60 * 60))
  const minutesRemaining = Math.floor(((24 * 60 * 60 * 1000) - elapsed) / (1000 * 60)) % 60

  if (hoursRemaining <= 0) {
    return {
      label: "Grace period expired — restore now",
      className: cn(AM_STATUS_PILL, "bg-[var(--cc-sem-danger)]/10 text-[var(--cc-sem-danger)]"),
    }
  }
  if (hoursRemaining <= 3) {
    return {
      label: `${hoursRemaining}h ${minutesRemaining}m until permanent deletion`,
      className: cn(AM_STATUS_PILL, "bg-[var(--cc-sem-warning)]/10 text-[var(--cc-sem-warning)]"),
    }
  }
  return {
    label: `${hoursRemaining}h ${minutesRemaining}m until permanent deletion`,
    className: cn(AM_STATUS_PILL, "bg-muted/60 text-[var(--cc-text-muted)]"),
  }
}

/** Re-evaluate tab: uniform full-width selects on theme surfaces. */
const REEVAL_TAB_SELECT_TRIGGER =
  "min-h-10 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm shadow-none !h-10"

interface Quiz {
  id: number
  title: string
  description: string
  is_active: boolean
  is_saved: boolean
  time_per_question: number
  question_count: number
  created_at: string
  available_from?: string | null
  available_until?: string | null
  is_public?: boolean
  session_access?: {
    P01?: boolean
    P02?: boolean
    P05?: boolean
    [key: string]: boolean | undefined
  }
  ta_session_access?: Record<string, boolean | undefined>
  ta_content_visible?: boolean
  ta_content_restricted?: boolean
  unfinalized_count?: number
  total_attempts?: number
}

interface Session {
  id: number
  code: string
  description: string
}

interface InstructorQuizManagementProps {
  /** When true, renders for dashboard-v2 (hides Back button, uses v2 base path) */
  embedInDashboard?: boolean
}

function v2AssessmentSegment(rawAssessmentType: string): string {
  if (rawAssessmentType === "homework") return "homework"
  if (rawAssessmentType === "quiz") return "quizzes"
  if (rawAssessmentType === "mid_semester") return "mid-semester"
  if (rawAssessmentType === "final") return "finals"
  return "quizzes"
}

export function InstructorQuizManagement({ embedInDashboard }: InstructorQuizManagementProps = {}) {
  const router = useRouter()
  const { confirm } = useAppConfirm()
  const pathname = usePathname()
  const { courseScopeVersion, basePath, loginPath, portal, hasPermission, staffRoleForCourse } =
    useInstructorDashboardV2()
  const portalCfg = getPortalConfig(portal)
  const isAdminPortal = portal === "admin"
  usePreventBack(loginPath)
  const { toast } = useToast()
  const assessment = useAssessment()
  const rawAssessmentType = assessment.type
  const facultyModuleId =
    rawAssessmentType === "homework"
      ? "homeworks"
      : rawAssessmentType === "mid_semester"
        ? "mid-semester"
        : rawAssessmentType === "final"
          ? "final-exams"
          : "quizzes"
  const chrome = facultyEmbedChrome(facultyModuleId)
  const fp = chrome.p
  
  // Normalize assessment type for API routes
  const typeMap: Record<string, string> = {
    'quiz': 'quiz',
    'homework': 'homework',
    'mid_semester': 'midsem',
    'midsem': 'midsem',
    'final': 'final'
  }
  const normalizedType = typeMap[rawAssessmentType] || 'quiz'
  const assessmentType = rawAssessmentType // Keep original for display
  const isHomeworkAssessment = rawAssessmentType === "homework"
  const canPublishToStudents = isHomeworkAssessment
    ? hasPermission("publish_homework")
    : hasPermission("publish_quizzes")
  const canEditAssessments = isHomeworkAssessment
    ? hasPermission("edit_homework")
    : hasPermission("edit_quizzes")
  const isSupervisingInstructor = staffRoleForCourse !== "TA"
  
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [savedQuizzes, setSavedQuizzes] = useState<Quiz[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [courseCode, setCourseCode] = useState("")
  const [loading, setLoading] = useState(true)
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [togglingKey, setTogglingKey] = useState<string | null>(null)
  const [savingQuizId, setSavingQuizId] = useState<number | null>(null)
  const [cloningQuizId, setCloningQuizId] = useState<number | null>(null)
  const [bulkReevalOpen, setBulkReevalOpen] = useState(false)
  const [bulkReevalQuiz, setBulkReevalQuiz] = useState<Quiz | null>(null)
  const [reevalTabQuizId, setReevalTabQuizId] = usePersistedState<string>(
    `instructor-reeval-tab-quiz-${assessmentType}`,
    "",
    "local"
  )
  const [reevalTabSessionCode, setReevalTabSessionCode] = usePersistedState<string>(
    `instructor-reeval-tab-session-${assessmentType}`,
    "",
    "local"
  )
  const [reevalTabScope, setReevalTabScope] = usePersistedState<AssessmentBulkReevaluateScope>(
    `instructor-reeval-tab-scope-${assessmentType}`,
    "pending",
    "local"
  )
  const [autoFinalizingQuizId, setAutoFinalizingQuizId] = useState<number | null>(null)
  const [emailingMissedQuizId, setEmailingMissedQuizId] = useState<number | null>(null)
  const [grantingBonus, setGrantingBonus] = useState(false)
  const [bonusPreviewLoading, setBonusPreviewLoading] = useState(false)
  const [bonusPreview, setBonusPreview] = useState<{
    affected_students: number | string
    affected_answers: number | string
    affected_quizzes: number | string
    affected_attempts: number | string
  } | null>(null)
  const [bonusSampleStudents, setBonusSampleStudents] = useState<
    Array<{
      attempt_id: number
      quiz_id: number
      quiz_title: string
      student_id: string
      student_name: string
      section: string
      null_answers_count: number | string
    }>
  >([])
  const [bonusResults, setBonusResults] = useState<any>(null)
  const [bonusQuizId, setBonusQuizId] = useState<string>("")
  const [bonusSection, setBonusSection] = useState<string>("")
  const [deletedItems, setDeletedItems] = useState<any[]>([])
  const [loadingDeleted, setLoadingDeleted] = useState(false)
  const [refreshingCounts, setRefreshingCounts] = useState(false)
  const [openIssuesCount, setOpenIssuesCount] = useState(0)
  const [analyticsQuizId, setAnalyticsQuizId] = usePersistedState<number | null>(
    `instructor-analytics-quiz-${assessmentType}`,
    null,
    "session",
  )
  const [analyticsRefreshNonce, setAnalyticsRefreshNonce] = useState(0)

  // Use persisted state to remember which tab was active
  const [activeTab, setActiveTab] = usePersistedState(`instructor-quiz-tab-${assessmentType}`, "quizzes")
  const [quizzesPage, setQuizzesPage] = useState(1)
  const [savedPage, setSavedPage] = useState(1)
  const [listSearch, setListSearch] = usePersistedState(
    `instructor-assessment-search-${assessmentType}`,
    "",
    "session",
  )
  const [listStatusFilter, setListStatusFilter] = usePersistedState<AssessmentListStatusFilter>(
    `instructor-assessment-status-${assessmentType}`,
    "all",
    "session",
  )
  const [listSessionFilter, setListSessionFilter] = usePersistedState(
    `instructor-assessment-session-${assessmentType}`,
    "all",
    "session",
  )
  const [listSort, setListSort] = usePersistedState<AssessmentListSort>(
    `instructor-assessment-sort-v2-${assessmentType}`,
    "title-asc",
    "session",
  )
  const [listViewMode, setListViewMode] = usePersistedState<AssessmentListViewMode>(
    `instructor-assessment-view-${assessmentType}`,
    "list",
    "session",
  )

  // Restore scroll position when returning to this page
  useScrollRestoration(`instructor-quiz-${assessmentType}`)

  useEffect(() => {
    setQuizzesPage(1)
    setSavedPage(1)
  }, [activeTab, listSearch, listStatusFilter, listSessionFilter, listSort])

  const listFilterOpts = useMemo(
    () => ({
      search: listSearch,
      statusFilter: listStatusFilter,
      sessionFilter: listSessionFilter,
      sort: listSort,
    }),
    [listSearch, listStatusFilter, listSessionFilter, listSort],
  )

  const filteredQuizzes = useMemo(
    () => filterAndSortAssessments(quizzes, listFilterOpts),
    [quizzes, listFilterOpts],
  )
  const filteredSavedQuizzes = useMemo(
    () => filterAndSortAssessments(savedQuizzes, listFilterOpts),
    [savedQuizzes, listFilterOpts],
  )

  const quizzesTotalPages = Math.max(1, Math.ceil(filteredQuizzes.length / ASSESSMENTS_PAGE_SIZE))
  const quizzesSafePage = Math.min(Math.max(1, quizzesPage), quizzesTotalPages)
  const paginatedQuizzes = useMemo(() => {
    const start = (quizzesSafePage - 1) * ASSESSMENTS_PAGE_SIZE
    return filteredQuizzes.slice(start, start + ASSESSMENTS_PAGE_SIZE)
  }, [filteredQuizzes, quizzesSafePage])

  const savedTotalPages = Math.max(1, Math.ceil(filteredSavedQuizzes.length / ASSESSMENTS_PAGE_SIZE))
  const savedSafePage = Math.min(Math.max(1, savedPage), savedTotalPages)
  const paginatedSavedQuizzes = useMemo(() => {
    const start = (savedSafePage - 1) * ASSESSMENTS_PAGE_SIZE
    return filteredSavedQuizzes.slice(start, start + ASSESSMENTS_PAGE_SIZE)
  }, [filteredSavedQuizzes, savedSafePage])

  const reevalTabQuizzesFiltered = useMemo(() => {
    if (!reevalTabSessionCode) return []
    return quizzes.filter((q) => q.session_access?.[reevalTabSessionCode] === true)
  }, [quizzes, reevalTabSessionCode])

  const reevalTabSelectedQuiz = useMemo(
    () => reevalTabQuizzesFiltered.find((x) => String(x.id) === reevalTabQuizId) ?? null,
    [reevalTabQuizzesFiltered, reevalTabQuizId]
  )

  const releaseTargets = useMemo(
    () => buildQuizReleaseTargets(sessions, courseCode),
    [sessions, courseCode],
  )
  const lectureTargets = useMemo(() => lectureReleaseTargets(releaseTargets), [releaseTargets])

  useEffect(() => {
    if (lectureTargets.length > 0 && !reevalTabSessionCode) {
      setReevalTabSessionCode(lectureTargets[0].sessionCode)
    }
  }, [lectureTargets, reevalTabSessionCode])

  useEffect(() => {
    if (!reevalTabQuizzesFiltered.length) {
      setReevalTabQuizId("")
      return
    }
    setReevalTabQuizId((prev) =>
      reevalTabQuizzesFiltered.some((q) => String(q.id) === prev)
        ? prev
        : String(reevalTabQuizzesFiltered[0].id)
    )
  }, [reevalTabQuizzesFiltered])

  const analyticsQuizOptions = useMemo(
    () => quizzes.map((q) => ({ id: q.id, title: q.title })),
    [quizzes],
  )

  useEffect(() => {
    if (quizzes.length === 0) {
      setAnalyticsQuizId(null)
      return
    }
    setAnalyticsQuizId((prev) => {
      if (prev && quizzes.some((q) => q.id === prev)) return prev
      return quizzes[0].id
    })
  }, [quizzes, setAnalyticsQuizId])

  useEffect(() => {
    const session = localStorage.getItem(portalCfg.sessionStorageKey)
    const actorId = localStorage.getItem(portalCfg.idStorageKey)

    if (!session || !actorId) {
      router.push(loginPath)
      return
    }

    const initializeData = async () => {
      await fetchData()
      await fetchDeletedItems() // Load deleted items count on initial load
    }

    initializeData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- courseScopeVersion refetches scoped data when switching courses on v2
  }, [router, assessmentType, courseScopeVersion, loginPath, portalCfg.sessionStorageKey, portalCfg.idStorageKey])

  const fetchData = async () => {
    try {
      const actorId = localStorage.getItem(portalCfg.idStorageKey)
      const scopedHeaders = isAdminPortal ? buildAdminApiHeaders() : buildInstructorApiHeaders()
      const hasCourseScope = Boolean(scopedHeaders["x-course-id"])

      let quizzesRes: Response
      let savedQuizzesRes: Response

      if (isAdminPortal) {
        const atParam = rawAssessmentType === "mid_semester" ? "midsem" : normalizedType
        const base = `${portalCfg.apiPrefix}/quizzes?assessment_type=${encodeURIComponent(atParam)}`
        ;[quizzesRes, savedQuizzesRes] = await Promise.all([
          fetch(base, { headers: scopedHeaders }),
          fetch(`${base}${base.includes("?") ? "&" : "?"}saved=true`, { headers: scopedHeaders }),
        ])
      } else if (hasCourseScope) {
        const atParam = instructorQuizzesAssessmentTypeParam(rawAssessmentType)
        const base = `/api/instructor/quizzes?assessmentType=${encodeURIComponent(atParam)}`
        ;[quizzesRes, savedQuizzesRes] = await Promise.all([
          fetch(base, { headers: scopedHeaders }),
          fetch(`${base}&saved=true`, { headers: scopedHeaders }),
        ])
      } else {
        const headers = {
          "x-instructor-id": actorId || "",
          Authorization: localStorage.getItem("instructorSession") || "",
        }
        const listPath = rawAssessmentType === "quiz" ? "quizzes" : normalizedType
        const apiUrl = `/api/${listPath}/list?instructorId=${actorId}`
        const savedApiUrl = `/api/${listPath}/list?instructorId=${actorId}&saved=true`
        ;[quizzesRes, savedQuizzesRes] = await Promise.all([
          fetch(apiUrl, { headers }),
          fetch(savedApiUrl, { headers }),
        ])
      }

      const sessionsApi = isAdminPortal ? `${portalCfg.apiPrefix}/sessions` : "/api/instructor/sessions"
      const issuesApi = isAdminPortal
        ? `${portalCfg.apiPrefix}/midsemester/issues?status=open`
        : `/api/instructor/issues?status=open&assessment_type=${encodeURIComponent(String(assessmentType))}`

      const sessionsRes = await fetch(sessionsApi, { headers: scopedHeaders })
      const issuesRes = await fetch(issuesApi, { headers: scopedHeaders })

      const quizzesData = await quizzesRes.json()
      const savedQuizzesData = await savedQuizzesRes.json()
      const sessionsData = await sessionsRes.json()
      const issuesData = await issuesRes.json()

      if (!quizzesRes.ok) {
        const message =
          typeof quizzesData?.error === "string"
            ? quizzesData.error
            : "Could not load assessments for the selected course."
        console.error("[Quiz Management] List API failed:", quizzesRes.status, quizzesData)
        toast({
          title: `Failed to load ${assessment.pluralLabel.toLowerCase()}`,
          description: message,
          variant: "destructive",
        })
      }

      const quizzesList = quizzesData.assessments || quizzesData.quizzes || []
      const savedQuizzesList = savedQuizzesData.assessments || savedQuizzesData.quizzes || []
      
      // Debug: Log homework 1 status (development only)
      if (process.env.NODE_ENV !== 'production' && normalizedType === 'homework') {
        const homework1 = quizzesList.find((q: any) => q.id === 65)
        if (homework1) {
          console.log(`[Quiz Management] 📊 Homework 1 (ID 65) status:`, {
            id: homework1.id,
            title: homework1.title,
            is_active: homework1.is_active,
            available_from: homework1.available_from,
            available_until: homework1.available_until,
            session_access: homework1.session_access
          })
        }
      }
      
      setQuizzes(quizzesList)
      setSavedQuizzes(savedQuizzesList)
      setSessions(sessionsData.sessions || [])
      setCourseCode(String(sessionsData.course?.course_code ?? ""))
      setOpenIssuesCount(issuesData.issues?.length || 0)
    } catch (error) {
      console.error("Failed to fetch data:", error)
      setQuizzes([])
      setSavedQuizzes([])
      setSessions([])
    } finally {
      setLoading(false)
    }
  }

  const fetchDeletedItems = async () => {
    try {
      setLoadingDeleted(true)
      const response = await fetch(
        `/api/instructor/deleted-items?type=${encodeURIComponent(String(assessmentType))}`,
        { headers: buildInstructorApiHeaders() },
      )
      const data = await response.json()
      if (response.ok) {
        const raw = data.deleted_items ?? data.deletedItems ?? data.items
        setDeletedItems(Array.isArray(raw) ? raw : [])
      } else {
        setDeletedItems([])
        toast({
          title: "❌ Failed to fetch deleted items",
          description: data.error || "An error occurred while fetching deleted items.",
          variant: "destructive",
        })
      }
    } catch (error) {
      setDeletedItems([])
      toast({
        title: "❌ Network Error",
        description: "Unable to connect to the server. Please check your connection and try again.",
        variant: "destructive",
      })
    } finally {
      setLoadingDeleted(false)
    }
  }

  // Centralized refresh function for all data
  const refreshAllData = async () => {
    setRefreshingCounts(true)
    try {
      await Promise.all([
        fetchData(),
        fetchDeletedItems()
      ])
    } finally {
      setRefreshingCounts(false)
    }
  }

  const handleRestoreItem = async (itemId: number) => {
    try {
      const response = await instructorApiFetch("/api/instructor/deleted-items", {
        method: "POST",
        headers: {
          ...buildInstructorApiHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quiz_id: itemId }),
      })

      const data = await response.json()
      if (response.ok) {
        toast({
          title: "✨ Item Restored Successfully",
          description: `${assessment.label} has been restored and is now available again.`,
          action: (
            <button
              onClick={() => {
                // Navigate back to main quizzes tab
                setActiveTab("quizzes")
                fetchData()
              }}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors duration-200"
            >
              View All
            </button>
          ),
          duration: 6000,
        })
        refreshAllData() // Refresh all data including counts
      } else {
        toast({
          title: "❌ Failed to Restore Item",
          description: data.error || "An error occurred while restoring the item.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Network Error",
        description: "Unable to connect to the server. Please check your connection and try again.",
        variant: "destructive",
      })
    }
  }

  const handlePermanentDelete = async (itemId: number) => {
    const ok = await confirm({
      title: "Permanently delete this item?",
      description: "This action cannot be undone.",
      confirmLabel: "Delete permanently",
      cancelLabel: "Cancel",
      variant: "destructive",
    })
    if (!ok) return

    try {
      const response = await instructorApiFetch("/api/instructor/deleted-items", {
        method: "DELETE",
        headers: {
          ...buildInstructorApiHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quiz_id: itemId }),
      })

      const data = await response.json()
      if (response.ok) {
        toast({
          title: "💥 Item Permanently Deleted",
          description: `${assessment.label} has been permanently removed from the system and cannot be recovered.`,
          variant: "destructive",
          duration: 5000,
        })
        fetchDeletedItems() // Refresh the deleted items list (permanent delete only affects deleted count)
      } else {
        toast({
          title: "❌ Failed to Delete Item",
          description: data.error || "An error occurred while deleting the item.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Network Error",
        description: "Unable to connect to the server. Please check your connection and try again.",
        variant: "destructive",
      })
    }
  }

  const handleToggleActive = async (quizId: number, sessionCode: string, currentStatus: boolean) => {
    const toggleKey = `${quizId}-${sessionCode}`
    if (togglingKey !== null) return

    const quiz = quizzes.find(q => q.id === quizId)
    if (!quiz) return
    
    setTogglingKey(toggleKey)
    const newStatus = !currentStatus

    // Optimistic update with is_active recalculation
    setQuizzes((prevQuizzes) =>
      prevQuizzes.map((quiz) => {
        if (quiz.id === quizId) {
          const updatedSessionAccess = {
            ...quiz.session_access,
            [sessionCode]: newStatus,
          }
          
          // Recalculate is_active: must have at least one active session AND be within date range
          const now = new Date()
          const hasActiveSession = Object.values(updatedSessionAccess).some((active) => active === true)
          const availableFromOk = !quiz.available_from || new Date(quiz.available_from) <= now
          const availableUntilOk = !quiz.available_until || new Date(quiz.available_until) >= now
          // Default is_public to true if not set (for backward compatibility)
          const isPublic = (quiz as any).is_public !== false
          const is_active = hasActiveSession && availableFromOk && availableUntilOk && isPublic
          
          return {
            ...quiz,
            session_access: updatedSessionAccess,
            is_active: is_active,
          }
        }
        return quiz
      }),
    )

    try {
      const response = await instructorApiFetch(`/api/instructor/quizzes/${quizId}/toggle-session`, {
        method: "PATCH",
        headers: {
          ...buildInstructorApiHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ session_code: sessionCode, is_active: newStatus }),
      })

      if (!response.ok) {
        throw new Error("Failed to toggle quiz")
      }

      toast({
        title: newStatus ? `✅ ${assessment.label} Activated` : `⏸️ ${assessment.label} Deactivated`,
        description: newStatus
          ? `"${quiz.title}" is now visible to all students in section ${sessionCode}. Students can now access and take this ${assessment.label.toLowerCase()}.`
          : `"${quiz.title}" has been hidden from section ${sessionCode}. Students in this section can no longer access this ${assessment.label.toLowerCase()}.`,
      })

      // Refetch data to ensure UI is in sync with database
      await fetchData()
    } catch (error) {
      console.error("Failed to toggle quiz status:", error)

      // Revert on error
      setQuizzes((prevQuizzes) =>
        prevQuizzes.map((quiz) =>
          quiz.id === quizId
            ? {
                ...quiz,
                session_access: {
                  ...quiz.session_access,
                  [sessionCode]: currentStatus,
                },
              }
            : quiz,
        ),
      )

      toast({
        title: `❌ Failed to Update ${assessment.label}`,
        description: `An error occurred while updating "${quiz.title}". Please try again or contact support if the issue persists.`,
        variant: "destructive",
      })
    } finally {
      setTogglingKey(null)
    }
  }

  const handleToggleTaVisible = async (quizId: number, currentStatus: boolean) => {
    const toggleKey = `ta-${quizId}`
    if (togglingKey !== null) return

    const quiz = quizzes.find((q) => q.id === quizId)
    if (!quiz) return

    setTogglingKey(toggleKey)
    const newStatus = !currentStatus

    setQuizzes((prev) =>
      prev.map((q) => {
        if (q.id !== quizId) return q
        const taMap = { ...(q.ta_session_access ?? {}) }
        for (const target of releaseTargets) {
          taMap[target.sessionCode] = newStatus
        }
        return {
          ...q,
          ta_session_access: taMap,
          ta_content_visible: newStatus,
          ta_content_restricted: false,
        }
      }),
    )

    try {
      const response = await instructorApiFetch(`/api/instructor/quizzes/${quizId}/toggle-session`, {
        method: "PATCH",
        headers: {
          ...buildInstructorApiHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ta_visible: newStatus }),
      })
      if (!response.ok) throw new Error("Failed to update TA visibility")
      toast({
        title: newStatus ? "TA can view questions" : "TA access hidden",
        description: newStatus
          ? "Teaching assistants with quiz access can view this assessment."
          : "Questions stay confidential from teaching assistants.",
      })
      await fetchData()
    } catch {
      setQuizzes((prev) =>
        prev.map((q) =>
          q.id === quizId
            ? {
                ...q,
                ta_content_visible: currentStatus,
                ta_content_restricted: !currentStatus,
              }
            : q,
        ),
      )
      toast({
        title: "Could not update TA visibility",
        variant: "destructive",
      })
    } finally {
      setTogglingKey(null)
    }
  }

  const handleToggleSaved = async (quizId: number, currentStatus: boolean) => {
    if (savingQuizId !== null) return

    setSavingQuizId(quizId)
    const newStatus = !currentStatus

    try {
      const response = await instructorApiFetch(`/api/instructor/quizzes/${quizId}/save`, {
        method: "PATCH",
        headers: {
          ...buildInstructorApiHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_saved: newStatus }),
      })

      if (!response.ok) {
        throw new Error("Failed to update quiz")
      }

      const quiz = quizzes.find(q => q.id === quizId) || savedQuizzes.find(q => q.id === quizId)
      toast({
        title: newStatus ? `📚 ${assessment.label} Saved as Template` : `🗑️ Template Removed`,
        description: newStatus
          ? `"${quiz?.title || 'This ' + assessment.label.toLowerCase()}" is now a reusable template. You can clone it anytime to create similar ${assessment.pluralLabel.toLowerCase()}.`
          : `"${quiz?.title || 'This ' + assessment.label.toLowerCase()}" has been removed from your saved templates library.`,
        action: newStatus ? (
          <button
            onClick={() => {
              // Navigate to saved templates tab
              setActiveTab("saved")
              fetchData()
            }}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors duration-200"
          >
            View Templates
          </button>
        ) : undefined,
        duration: newStatus ? 7000 : 4000,
      })

      // Refresh data
      fetchData()
    } catch (error) {
      console.error("Failed to toggle saved status:", error)
      const quiz = quizzes.find(q => q.id === quizId) || savedQuizzes.find(q => q.id === quizId)
      toast({
        title: `❌ Failed to Update Template Status`,
        description: `Could not update "${quiz?.title || 'the ' + assessment.label.toLowerCase()}". Please check your connection and try again.`,
        variant: "destructive",
      })
    } finally {
      setSavingQuizId(null)
    }
  }

  const handleCloneQuiz = async (quizId: number, quizTitle: string) => {
    if (cloningQuizId !== null) return

    setCloningQuizId(quizId)

    try {
      const response = await instructorApiFetch(`/api/instructor/quizzes/${quizId}/clone`, {
        method: "POST",
        headers: buildInstructorApiHeaders(),
      })

      if (!response.ok) {
        throw new Error("Failed to clone quiz")
      }

      const data = await response.json()

      toast({
        title: `🎯 ${assessment.label} Cloned Successfully`,
        description: `A duplicate of "${quizTitle}" has been created and you're being redirected to customize it.`,
        action: (
          <button
            onClick={() => {
              const editPath = embedInDashboard
                ? `${basePath}/assessments/${v2AssessmentSegment(rawAssessmentType)}/${data.quizId}/edit`
                : `${isAdminPortal ? "/admin" : "/instructor"}/${routeMap[assessmentType] || "quizzes"}/${data.quizId}/edit`
              router.push(editPath)
            }}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors duration-200"
          >
            Edit Now
          </button>
        ),
        duration: 7000,
      })

      // Redirect to edit the new assessment (instructor version)
      const editPath = embedInDashboard
        ? `${basePath}/assessments/${v2AssessmentSegment(rawAssessmentType)}/${data.quizId}/edit`
        : `${isAdminPortal ? "/admin" : "/instructor"}/${routeMap[assessmentType] || "quizzes"}/${data.quizId}/edit`
      router.push(editPath)
    } catch (error) {
      console.error("Failed to clone quiz:", error)
      toast({
        title: `❌ Failed to Clone ${assessment.label}`,
        description: `Could not create a copy of "${quizTitle}". This might be due to database constraints or missing questions. Please try again.`,
        variant: "destructive",
      })
    } finally {
      setCloningQuizId(null)
    }
  }

  const handleDeleteClick = (quiz: Quiz) => {
    setQuizToDelete(quiz)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!quizToDelete) return

    setDeleting(true)

    try {
      const response = await instructorApiFetch(`/api/instructor/quizzes/${quizToDelete.id}`, {
        method: "DELETE",
        headers: buildInstructorApiHeaders(),
      })

      if (!response.ok) {
        throw new Error("Failed to delete quiz")
      }

      toast({
        title: `🗑️ ${assessment.label} Moved to Trash`,
        description: `"${quizToDelete.title}" has been moved to trash and can be restored within 24 hours.`,
        action: (
          <button
            onClick={() => {
              // Navigate to deleted items tab to show restore option
              setActiveTab("deleted")
              fetchDeletedItems()
            }}
            className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-[var(--cc-accent)] hover:opacity-90"
          >
            View Trash
          </button>
        ),
        duration: 8000, // Longer duration to allow user to see restore option
      })

      refreshAllData() // Refresh all data including counts
      setDeleteDialogOpen(false)
      setQuizToDelete(null)
    } catch (error) {
      console.error("Failed to delete quiz:", error)
      toast({
        title: `❌ Failed to Delete ${assessment.label}`,
        description: `Could not delete "${quizToDelete?.title}". This might be because it's a template being used by other ${assessment.pluralLabel.toLowerCase()}. Please check and try again.`,
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleBonusPreview = async () => {
    setBonusPreviewLoading(true)
    setBonusPreview(null)
    setBonusSampleStudents([])
    setBonusResults(null)

    try {
      const params = new URLSearchParams()
      if (bonusQuizId && bonusQuizId !== "all") params.append("quizId", bonusQuizId)
      if (bonusSection && bonusSection !== "all") params.append("section", bonusSection)

      const response = await instructorApiFetch(`/api/instructor/bonus-points?${params.toString()}`, {
        headers: buildInstructorApiHeaders(),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to load preview")
      }

      setBonusPreview(data.preview)
      setBonusSampleStudents(Array.isArray(data.sampleStudents) ? data.sampleStudents : [])
    } catch (error) {
      console.error("Failed to preview bonus points:", error)
      toast({
        title: "❌ Preview Failed",
        description: "Could not load bonus points preview data. Please check your selection and try again.",
        variant: "destructive",
      })
    } finally {
      setBonusPreviewLoading(false)
    }
  }

  const handleAutoFinalize = async (quizId: number) => {
    if (autoFinalizingQuizId !== null) return

    console.log('[Auto-Finalize] 🚀 Starting auto-finalize for quiz:', quizId)
    setAutoFinalizingQuizId(quizId)
    
    try {
      const response = await instructorApiFetch('/api/instructor/auto-finalize-attempts', {
        method: 'POST',
        headers: {
          ...buildInstructorApiHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quizId: quizId,
          gradingPolicy: 'highest' // Default to highest score policy
        })
      })

      const data = await response.json()
      console.log('[Auto-Finalize] 📥 Response:', data)
      
      if (response.ok) {
        console.log('[Auto-Finalize] ✅ Success! Finalized:', data.finalizedCount, 'attempts')
        toast({
          title: "✅ Auto-Finalize Complete",
          description: data.message,
        })
        // Refresh quizzes to show updated attempt counts
        console.log('[Auto-Finalize] 🔄 Refreshing quiz data...')
        await fetchData()
        console.log('[Auto-Finalize] ✅ Data refreshed')
      } else {
        console.error('[Auto-Finalize] ❌ Failed:', data.error)
        toast({
          title: "❌ Auto-Finalize Failed",
          description: data.error || "Failed to auto-finalize attempts",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('[Auto-Finalize] ❌ Error:', error)
      toast({
        title: "❌ Auto-Finalize Failed",
        description: "An error occurred while auto-finalizing attempts",
        variant: "destructive",
      })
    } finally {
      setAutoFinalizingQuizId(null)
      console.log('[Auto-Finalize] 🏁 Finalization process complete')
    }
  }

  const handleEmailMissed = async (quizId: number) => {
    if (emailingMissedQuizId !== null) return
    setEmailingMissedQuizId(quizId)
    try {
      const response = await instructorApiFetch("/api/instructor/email-missed-assessment", {
        method: "POST",
        headers: {
          ...buildInstructorApiHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quizId,
          assessmentType: assessmentType === "mid_semester" ? "mid_semester" : assessmentType,
        }),
      })
      const data = await response.json()
      if (response.ok) {
        toast({
          title: "✅ Emails Sent",
          description: data.totalMissed === 0
            ? "No students missed this assessment."
            : `Sent ${data.sent} email${data.sent === 1 ? "" : "s"} to students who missed (${data.skipped} skipped).`,
        })
      } else {
        toast({
          title: "❌ Failed to Send Emails",
          description: data.error || "Could not send emails.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "❌ Failed to Send Emails",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setEmailingMissedQuizId(null)
    }
  }

  const handleGrantBonus = async () => {
    setGrantingBonus(true)
    setBonusResults(null)

    try {
      const response = await instructorApiFetch("/api/instructor/bonus-points", {
        method: "POST",
        headers: {
          ...buildInstructorApiHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quizId: bonusQuizId && bonusQuizId !== "all" ? bonusQuizId : null,
          section: bonusSection && bonusSection !== "all" ? bonusSection : null,
          confirm: true,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to grant bonus points")
      }

      const data = await response.json()
      setBonusResults(data)
      setBonusPreview(null)
      setBonusSampleStudents([])

      toast({
        title: "🎁 Bonus Points Granted Successfully!",
        description: `Awarded bonus points for ${data.affectedAnswers} unanswered questions. Student scores have been updated automatically.`,
      })
    } catch (error) {
      console.error("Failed to grant bonus points:", error)
      toast({
        title: "❌ Failed to Grant Bonus Points",
        description: "An error occurred while processing bonus points. Please verify your selections and ensure there are eligible unanswered questions, then try again.",
        variant: "destructive",
      })
    } finally {
      setGrantingBonus(false)
    }
  }

  const handleExportQuiz = async (quizId: number, format: "json" | "csv") => {
    try {
      // Use the generic quizzes export API for all assessment types
      // It works with any quiz_id regardless of assessment_type
      const apiPath = `/api/instructor/quizzes/export?quiz_id=${quizId}&format=${format}`
      
      console.log("[Export] API Path:", apiPath)
      
      const response = await fetch(apiPath, { headers: buildInstructorApiHeaders() })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        console.error("[Export] Error response:", errorData)
        throw new Error(errorData.error || errorData.details || "Failed to export")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      
      // Get filename from Content-Disposition header or create default
      const contentDisposition = response.headers.get("Content-Disposition")
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      const assessmentLabel = assessmentType === "mid_semester" ? "Mid-Semester Exam" : assessmentType === "final" ? "Final Exam" : assessmentType === "homework" ? "Homework" : "Quiz"
      const filename = filenameMatch ? filenameMatch[1] : `${assessmentLabel.toLowerCase().replace(/\s+/g, '-')}-${quizId}.${format}`
      
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Export Successful",
        description: `${assessmentLabel} exported as ${format.toUpperCase()}`,
      })
    } catch (error) {
      console.error("Failed to export:", error)
      const assessmentLabel = assessmentType === "mid_semester" ? "Mid-Semester Exam" : assessmentType === "final" ? "Final Exam" : assessmentType === "homework" ? "Homework" : "Quiz"
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      toast({
        title: "Export Failed",
        description: `${errorMessage}. Please try again.`,
        variant: "destructive",
      })
    }
  }

  const getCreateDescriptionLabel = () => {
    switch (assessmentType) {
      case "mid_semester": return "mid-semester exam"
      case "final": return "final exam"
      case "homework": return "homework"
      default: return "quiz"
    }
  }

  // Route mapping for different assessment types (legacy paths)
  const routeMap: Record<string, string> = {
    'quiz': 'quizzes',
    'mid_semester': 'mid-semester-exams',
    'final': 'final-exams',
    'homework': 'homeworks'
  }

  // Dashboard-v2 base path for edit/preview when embedInDashboard
  const v2BasePath = embedInDashboard
    ? `${basePath}/assessments/${v2AssessmentSegment(rawAssessmentType)}`
    : null

  const getAssessmentTitle = () => {
    return `${assessment.pluralLabel} Management`
  }

  const getAssessmentSubtitle = () => {
    return `Create, edit, and manage ${assessment.pluralLabel.toLowerCase()} per session.`
  }

  const getCreateButtonText = () => {
    return `Create ${assessment.label}`
  }

  const getEmptyMessage = () => {
    return `No ${assessment.pluralLabel.toLowerCase()} have been created yet.`
  }

  const getSingularName = () => {
    return assessment.label.toLowerCase()
  }

  const getPluralName = () => {
    return assessment.pluralLabel.toLowerCase()
  }

  const renderAssessmentCard = (quiz: Quiz, index = 0) => (
    <InstructorAssessmentCard
      key={quiz.id}
      moduleId={facultyModuleId}
      listIndex={index}
      quiz={quiz as InstructorAssessmentCardQuiz}
      viewMode={listViewMode}
      previewHref={
        v2BasePath
          ? `${v2BasePath}/${quiz.id}/preview`
          : `/instructor/${routeMap[assessmentType] || "quizzes"}/${quiz.id}/preview`
      }
      editHref={
        v2BasePath
          ? `${v2BasePath}/${quiz.id}/edit`
          : `/instructor/${routeMap[assessmentType] || "quizzes"}/${quiz.id}/edit`
      }
      releaseTargets={releaseTargets}
      canPublishToStudents={canPublishToStudents}
      canEditAssessments={canEditAssessments}
      isSupervisingInstructor={isSupervisingInstructor}
      togglingKey={togglingKey}
      savingQuizId={savingQuizId}
      cloningQuizId={cloningQuizId}
      autoFinalizingQuizId={autoFinalizingQuizId}
      emailingMissedQuizId={emailingMissedQuizId}
      onToggleSession={handleToggleActive}
      onToggleTa={handleToggleTaVisible}
      onDelete={handleDeleteClick}
      onToggleSaved={handleToggleSaved}
      onClone={handleCloneQuiz}
      onAutoFinalize={handleAutoFinalize}
      onEmailMissed={handleEmailMissed}
      onBulkReeval={(q) => {
        setBulkReevalQuiz(q as Quiz)
        setBulkReevalOpen(true)
      }}
      onExport={handleExportQuiz}
    />
  )

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center px-4">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--cc-accent)]" />
          <p className={cn("mt-4 text-sm", PORTAL_TEXT_MUTED)}>Loading {getAssessmentTitle()}…</p>
        </div>
      </div>
    )
  }

  const questionBankHref = `${basePath}/assessments/quizzes/question-bank`

  const handleRefreshList = async () => {
    setLoading(true)
    await fetchData()
    setLoading(false)
  }

  const listToolbarTrailing = (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={loading}
        onClick={() => void handleRefreshList()}
        className={facultyToolbarFilterButtonClass()}
      >
        <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        <span className="hidden sm:inline">Refresh</span>
      </Button>
      {canEditAssessments ? (
        <Button
          type="button"
          size="sm"
          onClick={() => setActiveTab("create-from-bank")}
          className={cn("h-9 gap-1.5 rounded-lg", fp.cta)}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Create</span>
        </Button>
      ) : null}
    </div>
  )

  const menuItems = [
    { key: "quizzes" as const, label: allAssessmentsMenuLabel(rawAssessmentType, assessment.pluralLabel), icon: FileText, count: quizzes.length },
    { key: "create-from-bank" as const, label: "Create from Bank", icon: Plus },
    { key: "saved" as const, label: "Saved", icon: Bookmark, count: savedQuizzes.length },
    { key: "analytics" as const, label: "Analytics", icon: TrendingUp },
    { key: "results" as const, label: "Manage Results", icon: Eye },
    { key: "flagged" as const, label: "Flagged", icon: AlertTriangle, isFlagged: true },
    { key: "issues" as const, label: "Issues", icon: MessageSquare, count: openIssuesCount },
    { key: "ai-evaluation" as const, label: "AI Evaluation", icon: Bot },
    { key: "reevaluate" as const, label: "Re-evaluate", icon: RefreshCw },
    { key: "bonus" as const, label: "Bonus Points", icon: Gift },
    {
      key: "deleted" as const,
      label: "Deleted",
      icon: Trash2,
      count: Array.isArray(deletedItems) ? deletedItems.length : 0,
      isDestructive: true,
    },
    { key: "question-bank" as const, label: "Question Bank", icon: Database, href: questionBankHref },
  ]

  const isPanel = embedInDashboard
  const panelSection = isPanel ? AM_PANEL_SECTION : undefined
  const panelScroll = isPanel ? AM_PANEL_SCROLL : undefined
  const panelFill = isPanel ? AM_PANEL_FILL : undefined
  const emptyState = isPanel ? AM_EMPTY_FILL : AM_EMPTY
  const tabShell = isPanel ? cn(AM_PANEL_SECTION, "gap-3 sm:gap-4") : "space-y-4 sm:space-y-6"
  const tabShellTight = isPanel ? cn(AM_PANEL_SECTION, "gap-3") : "space-y-3"

  return (
    <div
      className={
        embedInDashboard
          ? "flex min-h-0 flex-1 flex-col overflow-hidden w-full min-w-0"
          : "w-full max-w-[min(100%,72rem)] mx-auto px-3 sm:px-4 md:px-5 py-3 sm:py-4 min-w-0 overflow-x-hidden"
      }
    >
      {!embedInDashboard && (
        <div className="flex justify-end mb-4">
          <Link href="/instructor/dashboard">
            <Button variant="outline" className="gap-2 rounded-xl border-slate-200 dark:border-white/10">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      )}

      {!embedInDashboard && (
        <div className="mb-4">
          <InstructorMembershipDisclaimerBanner />
        </div>
      )}

      <FacultyModuleSplitLayout
        scrollMode={embedInDashboard ? "panel" : "page"}
        className={embedInDashboard ? "min-h-0 flex-1" : undefined}
        menuWidthClass="lg:w-60"
        menu={
          <FacultyModuleSideMenu
            moduleId={facultyModuleId}
            title={assessment.pluralLabel}
            accent="theme"
            activeId={activeTab}
            onSelect={(id) => {
              setActiveTab(id as typeof activeTab)
              if (id === "deleted") fetchDeletedItems()
            }}
            items={menuItems.map(({ key, label, icon, count, isDestructive, isFlagged, href }) => ({
              id: key,
              label,
              icon,
              badge: count,
              tone: isDestructive ? ("destructive" as const) : isFlagged ? ("warning" as const) : undefined,
              href,
            }))}
          />
        }
      >
        {/* Main Content */}
        <div
          className={cn(
            "min-w-0 w-full max-w-full",
            isPanel
              ? "flex min-h-0 flex-1 flex-col overflow-hidden"
              : "flex-1 space-y-4 sm:space-y-6",
          )}
        >
            {activeTab === "create-from-bank" && (
              <div className={panelSection}>
                <CreateQuizFromBankWizard
                variant={embedInDashboard ? "embedded" : "default"}
                assessmentType={assessmentType === "practice" || assessmentType === "playground" ? "quiz" : assessmentType}
                onSuccess={() => {
                  setActiveTab("quizzes")
                  fetchData()
                }}
              />
              </div>
            )}

            {activeTab === "quizzes" && (
              <div className={cn(tabShellTight, panelSection)}>
                {(() => {
                  if (process.env.NODE_ENV !== 'production') {
                    console.log('[Quiz Management] 🎨 RENDERING QUIZZES LIST:', {
                      quizzesCount: quizzes.length,
                      totalQuizzes: quizzes.length,
                      allQuizzes: quizzes.map(q => ({
                        id: q.id,
                        title: q.title,
                        is_active: q.is_active,
                        session_access: q.session_access,
                        available_from: q.available_from,
                        available_until: q.available_until
                      })),
                      loading
                    })
                  }
                  return null
                })()}
                {quizzes.length === 0 ? (
                  <div className={emptyState}>
                    <FileText className="mx-auto mb-3 h-10 w-10 opacity-40 text-[var(--cc-text-muted)]" />
                    <p className={cn("text-sm font-medium", PORTAL_TEXT)}>No {assessment.pluralLabel.toLowerCase()} yet</p>
                    <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>{getEmptyMessage()}</p>
                    {canEditAssessments ? (
                      <Button
                        onClick={() => setActiveTab("create-from-bank")}
                        className={cn("mt-4 gap-1.5", fp.cta)}
                        size="sm"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {getCreateButtonText()}
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <div className={cn("space-y-3", panelSection)}>
                    <InstructorAssessmentListToolbar
                      moduleId={facultyModuleId}
                      search={listSearch}
                      onSearchChange={setListSearch}
                      statusFilter={listStatusFilter}
                      onStatusFilterChange={setListStatusFilter}
                      sessionFilter={listSessionFilter}
                      onSessionFilterChange={setListSessionFilter}
                      sort={listSort}
                      onSortChange={setListSort}
                      viewMode={listViewMode}
                      onViewModeChange={setListViewMode}
                      releaseTargets={releaseTargets}
                      totalCount={quizzes.length}
                      filteredCount={filteredQuizzes.length}
                      trailing={listToolbarTrailing}
                    />
                    {filteredQuizzes.length === 0 ? (
                      <div className={cn(emptyState, !isPanel && "py-8")}>
                        <p className={cn("text-sm font-medium", PORTAL_TEXT)}>
                          {quizzes.length === 0 ? `No ${getPluralName()} yet` : "No assessments match your filters"}
                        </p>
                        {quizzes.length > 0 ? (
                          <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>Try clearing search or filters.</p>
                        ) : null}
                      </div>
                    ) : listViewMode === "list" ? (
                    <div className={cn(chrome.card, "divide-y divide-[var(--border)] overflow-hidden", panelScroll)}>
                      {paginatedQuizzes.map((quiz, index) =>
                        renderAssessmentCard(quiz, (quizzesSafePage - 1) * ASSESSMENTS_PAGE_SIZE + index),
                      )}
                    </div>
                    ) : (
                    <div className={cn("grid grid-cols-1 gap-3 xl:grid-cols-2", panelScroll)}>
                      {paginatedQuizzes.map((quiz, index) =>
                        renderAssessmentCard(quiz, (quizzesSafePage - 1) * ASSESSMENTS_PAGE_SIZE + index),
                      )}
                    </div>
                    )}
                    {filteredQuizzes.length > 0 && quizzesTotalPages > 1 && (
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--border)]/60">
                        <p className="text-xs text-[var(--cc-text-muted)]">
                          Showing {(quizzesSafePage - 1) * ASSESSMENTS_PAGE_SIZE + 1}–{Math.min(quizzesSafePage * ASSESSMENTS_PAGE_SIZE, filteredQuizzes.length)} of {filteredQuizzes.length}
                        </p>
                        <Pagination className="w-full sm:w-auto justify-center sm:justify-end">
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                href="#"
                                onClick={(e) => { e.preventDefault(); setQuizzesPage((p) => Math.max(1, p - 1)) }}
                                className={quizzesSafePage <= 1 ? "pointer-events-none opacity-50" : ""}
                              />
                            </PaginationItem>
                            {Array.from({ length: quizzesTotalPages }, (_, i) => i + 1)
                              .filter((p) => {
                                if (quizzesTotalPages <= 7) return true
                                if (p === 1 || p === quizzesTotalPages) return true
                                if (Math.abs(p - quizzesSafePage) <= 1) return true
                                return false
                              })
                              .map((page, idx, arr) => (
                                <Fragment key={page}>
                                  {idx > 0 && arr[idx - 1] !== page - 1 && (
                                    <PaginationItem><PaginationEllipsis /></PaginationItem>
                                  )}
                                  <PaginationItem>
                                    <PaginationLink
                                      href="#"
                                      onClick={(e) => { e.preventDefault(); setQuizzesPage(page) }}
                                      isActive={quizzesSafePage === page}
                                    >
                                      {page}
                                    </PaginationLink>
                                  </PaginationItem>
                                </Fragment>
                              ))}
                            <PaginationItem>
                              <PaginationNext
                                href="#"
                                onClick={(e) => { e.preventDefault(); setQuizzesPage((p) => Math.min(quizzesTotalPages, p + 1)) }}
                                className={quizzesSafePage >= quizzesTotalPages ? "pointer-events-none opacity-50" : ""}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "saved" && (
              <div className={cn(tabShellTight, panelSection)}>
                {savedQuizzes.length === 0 ? (
                  <div className={emptyState}>
                    <Bookmark className="mx-auto mb-3 h-10 w-10 opacity-40 text-[var(--cc-text-muted)]" />
                    <p className={cn("text-sm font-medium", PORTAL_TEXT)}>No saved templates</p>
                    <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
                      Save an assessment as a template from the card menu.
                    </p>
                    <Button
                      onClick={() => setActiveTab("quizzes")}
                      variant="outline"
                      size="sm"
                      className={cn("mt-4", chrome.outline)}
                    >
                      View all {assessment.pluralLabel}
                    </Button>
                  </div>
                ) : (
                  <div className={cn("space-y-3", panelSection)}>
                    <InstructorAssessmentListToolbar
                      moduleId={facultyModuleId}
                      search={listSearch}
                      onSearchChange={setListSearch}
                      statusFilter={listStatusFilter}
                      onStatusFilterChange={setListStatusFilter}
                      sessionFilter={listSessionFilter}
                      onSessionFilterChange={setListSessionFilter}
                      sort={listSort}
                      onSortChange={setListSort}
                      viewMode={listViewMode}
                      onViewModeChange={setListViewMode}
                      releaseTargets={releaseTargets}
                      totalCount={savedQuizzes.length}
                      filteredCount={filteredSavedQuizzes.length}
                      trailing={
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={loading}
                          onClick={() => void handleRefreshList()}
                          className={facultyToolbarFilterButtonClass()}
                        >
                          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                          <span className="hidden sm:inline">Refresh</span>
                        </Button>
                      }
                    />
                    {filteredSavedQuizzes.length === 0 ? (
                      <div className={cn(emptyState, !isPanel && "py-8")}>
                        <p className={cn("text-sm font-medium", PORTAL_TEXT)}>No templates match your filters</p>
                      </div>
                    ) : listViewMode === "list" ? (
                    <div className={cn(chrome.card, "divide-y divide-[var(--border)] overflow-hidden", panelScroll)}>
                      {paginatedSavedQuizzes.map((quiz, index) =>
                        renderAssessmentCard(quiz, (savedSafePage - 1) * ASSESSMENTS_PAGE_SIZE + index),
                      )}
                    </div>
                    ) : (
                    <div className={cn("grid grid-cols-1 gap-3 xl:grid-cols-2", panelScroll)}>
                      {paginatedSavedQuizzes.map((quiz, index) =>
                        renderAssessmentCard(quiz, (savedSafePage - 1) * ASSESSMENTS_PAGE_SIZE + index),
                      )}
                    </div>
                    )}
                    {filteredSavedQuizzes.length > 0 && savedTotalPages > 1 && (
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--border)]/60">
                        <p className="text-xs text-[var(--cc-text-muted)]">
                          Showing {(savedSafePage - 1) * ASSESSMENTS_PAGE_SIZE + 1}–{Math.min(savedSafePage * ASSESSMENTS_PAGE_SIZE, filteredSavedQuizzes.length)} of {filteredSavedQuizzes.length}
                        </p>
                        <Pagination className="w-full sm:w-auto justify-center sm:justify-end">
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                href="#"
                                onClick={(e) => { e.preventDefault(); setSavedPage((p) => Math.max(1, p - 1)) }}
                                className={savedSafePage <= 1 ? "pointer-events-none opacity-50" : ""}
                              />
                            </PaginationItem>
                            {Array.from({ length: savedTotalPages }, (_, i) => i + 1)
                              .filter((p) => {
                                if (savedTotalPages <= 7) return true
                                if (p === 1 || p === savedTotalPages) return true
                                if (Math.abs(p - savedSafePage) <= 1) return true
                                return false
                              })
                              .map((page, idx, arr) => (
                                <Fragment key={page}>
                                  {idx > 0 && arr[idx - 1] !== page - 1 && (
                                    <PaginationItem><PaginationEllipsis /></PaginationItem>
                                  )}
                                  <PaginationItem>
                                    <PaginationLink
                                      href="#"
                                      onClick={(e) => { e.preventDefault(); setSavedPage(page) }}
                                      isActive={savedSafePage === page}
                                    >
                                      {page}
                                    </PaginationLink>
                                  </PaginationItem>
                                </Fragment>
                              ))}
                            <PaginationItem>
                              <PaginationNext
                                href="#"
                                onClick={(e) => { e.preventDefault(); setSavedPage((p) => Math.min(savedTotalPages, p + 1)) }}
                                className={savedSafePage >= savedTotalPages ? "pointer-events-none opacity-50" : ""}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "reevaluate" && (
              <div className={cn(AM_PANEL, "space-y-5", panelSection, panelScroll)}>
                <div className="space-y-1">
                  <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Bulk re-evaluate (AI)</p>
                  <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                    Re-grade existing attempts without changing answers. Or use ⋮ on any assessment card.
                  </p>
                </div>

                <div className="space-y-4">
                    <div>
                      <p className={cn("mb-3 text-[10px] font-semibold uppercase tracking-[0.14em]", PORTAL_TEXT_MUTED)}>
                        Configuration
                      </p>
                      {lectureTargets.length === 0 ? (
                        <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No class sessions loaded.</p>
                      ) : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
                          <div className="min-w-0 space-y-1.5">
                            <Label htmlFor="reeval-session-tab" className="text-xs font-medium text-[var(--cc-text)]">
                              Class session
                            </Label>
                            <Select value={reevalTabSessionCode} onValueChange={setReevalTabSessionCode}>
                              <SelectTrigger id="reeval-session-tab" className={REEVAL_TAB_SELECT_TRIGGER}>
                                <SelectValue placeholder="Session" />
                              </SelectTrigger>
                              <SelectContent>
                                {lectureTargets.map((t) => (
                                  <SelectItem key={t.sessionId} value={t.sessionCode}>
                                    {t.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="min-w-0 space-y-1.5">
                            <Label htmlFor="reeval-quiz-tab" className="text-xs font-medium text-[var(--cc-text)]">
                              {assessment.label}
                            </Label>
                            {reevalTabQuizzesFiltered.length === 0 ? (
                              <p className="flex min-h-10 items-center rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-xs leading-snug text-amber-950 dark:border-amber-500/25 dark:bg-amber-950/40 dark:text-amber-100">
                                None enabled for this session. Turn on session access on the assessment card first.
                              </p>
                            ) : (
                              <Select value={reevalTabQuizId} onValueChange={setReevalTabQuizId}>
                                <SelectTrigger id="reeval-quiz-tab" className={REEVAL_TAB_SELECT_TRIGGER}>
                                  <SelectValue placeholder={`Select a ${assessment.label.toLowerCase()}…`} />
                                </SelectTrigger>
                                <SelectContent>
                                  {reevalTabQuizzesFiltered.map((quiz) => (
                                    <SelectItem key={quiz.id} value={quiz.id.toString()}>
                                      {quiz.title}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--sidebar-accent)]/15 px-3 py-3 sm:px-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                        <div className="min-w-0">
                          <p className={cn("text-xs font-medium", PORTAL_TEXT)}>Re-evaluate scope</p>
                          <p className={cn("mt-0.5 text-[11px]", PORTAL_TEXT_MUTED)}>
                            Pending = PND% / not fully graded; All = every completed attempt.
                          </p>
                        </div>
                        <RadioGroup
                          value={reevalTabScope}
                          onValueChange={(v) => setReevalTabScope(v as AssessmentBulkReevaluateScope)}
                          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5"
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="pending" id="reeval-tab-pending" />
                            <Label htmlFor="reeval-tab-pending" className="cursor-pointer text-sm font-normal text-[var(--cc-text)]">
                              Pending (PND%) only
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="all" id="reeval-tab-all" />
                            <Label htmlFor="reeval-tab-all" className="cursor-pointer text-sm font-normal text-[var(--cc-text)]">
                              All completed attempts
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>
                  </div>

                  {reevalTabQuizzesFiltered.length > 0 &&
                    reevalTabQuizId &&
                    reevalTabSessionCode &&
                    reevalTabSelectedQuiz && (
                      <>
                        <Separator className="bg-[var(--border)]" />
                        <BulkReevaluateAttemptsPanel
                          quizId={Number(reevalTabQuizId)}
                          quizTitle={reevalTabSelectedQuiz.title}
                          assessmentLabel={assessment.label}
                          scope={reevalTabScope}
                          showScopePicker={false}
                          variant="inline"
                          embeddedInCard
                          sessionCode={reevalTabSessionCode}
                        />
                      </>
                    )}
              </div>
            )}

            {activeTab === "bonus" && (
              <div className={cn(AM_PANEL, "space-y-5", panelSection, panelScroll)}>
                <div className="space-y-2 shrink-0">
                  <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Grant bonus points</p>
                  <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                    One-time operation for unanswered questions caused by past system issues. Use only to compensate students — the system now saves all answers correctly.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  <div>
                    <label className={cn("mb-1.5 block text-xs font-medium sm:mb-2 sm:text-sm", PORTAL_TEXT)}>
                      Filter by {assessment.label} (Optional)
                    </label>
                    <Select
                      value={bonusQuizId || "all"}
                      onValueChange={(value) => {
                        setBonusQuizId(value)
                        setBonusPreview(null)
                        setBonusSampleStudents([])
                        setBonusResults(null)
                      }}
                    >
                      <SelectTrigger className={REEVAL_TAB_SELECT_TRIGGER}>
                        <SelectValue placeholder="All quizzes (leave empty for all)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All {assessment.pluralLabel}</SelectItem>
                        {quizzes.map((quiz) => (
                          <SelectItem key={quiz.id} value={quiz.id.toString()}>
                            {quiz.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className={cn("mb-1.5 block text-xs font-medium sm:mb-2 sm:text-sm", PORTAL_TEXT)}>
                      Filter by Section (Optional)
                    </label>
                    <Select
                      value={bonusSection || "all"}
                      onValueChange={(value) => {
                        setBonusSection(value)
                        setBonusPreview(null)
                        setBonusSampleStudents([])
                        setBonusResults(null)
                      }}
                    >
                      <SelectTrigger className={REEVAL_TAB_SELECT_TRIGGER}>
                        <SelectValue placeholder="All sections (leave empty for all)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sections</SelectItem>
                        {lectureTargets.map((target) => (
                          <SelectItem key={target.sessionId} value={target.sessionCode}>
                            {target.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={handleBonusPreview}
                  variant="outline"
                  size="sm"
                  disabled={bonusPreviewLoading}
                  className={cn("h-9 w-full rounded-lg text-xs sm:h-10 sm:text-sm", chrome.outline)}
                >
                  {bonusPreviewLoading ? (
                    <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 animate-spin" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  )}
                  {bonusPreviewLoading ? "Loading preview…" : "Preview Impact"}
                </Button>

                {bonusPreview && (
                  <div className="space-y-4 rounded-xl border border-[var(--cc-accent)]/20 bg-[var(--cc-accent)]/5 p-4 sm:p-5">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className={cn("flex items-center gap-2 text-sm font-semibold", PORTAL_TEXT)}>
                        <TrendingUp className="h-4 w-4 text-[var(--cc-accent)]" />
                        Impact preview
                      </p>
                      <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                        Review the counts below before granting bonus points.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {[
                        {
                          label: "Students",
                          value: bonusPreview.affected_students,
                          icon: Users,
                        },
                        {
                          label: "Unanswered questions",
                          value: bonusPreview.affected_answers,
                          icon: AlertCircle,
                        },
                        {
                          label: "Assessments",
                          value: bonusPreview.affected_quizzes,
                          icon: FileText,
                        },
                        {
                          label: "Attempts",
                          value: bonusPreview.affected_attempts,
                          icon: RefreshCw,
                        },
                      ].map(({ label, value, icon: Icon }) => (
                        <div key={label} className={AM_STAT_BOX}>
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--cc-accent)]/10 text-[var(--cc-accent-dark)] dark:text-[var(--cc-accent)]">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className={cn("text-[10px] font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                              {label}
                            </p>
                            <p className={cn("text-lg font-semibold tabular-nums", PORTAL_TEXT)}>{value ?? 0}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {Number(bonusPreview.affected_answers) === 0 ? (
                      <div className={cn("rounded-lg border border-[var(--border)] bg-[var(--background)]/60 px-4 py-3 text-sm", PORTAL_TEXT_MUTED)}>
                        No eligible unanswered questions were found for the current filters.
                      </div>
                    ) : (
                      <>
                        {bonusSampleStudents.length > 0 && (
                          <div className="space-y-2">
                            <p className={cn("text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                              Sample affected students
                            </p>
                            <div className={cn(chrome.card, "max-h-56 divide-y divide-[var(--border)] overflow-y-auto")}>
                              {bonusSampleStudents.map((student) => (
                                <div key={`${student.attempt_id}-${student.student_id}`} className={AM_ROW}>
                                  <div className="min-w-0">
                                    <p className={cn("truncate text-sm font-medium", PORTAL_TEXT)}>
                                      {student.student_name}
                                    </p>
                                    <p className={cn("truncate text-xs", PORTAL_TEXT_MUTED)}>
                                      {student.section} · {student.quiz_title}
                                    </p>
                                  </div>
                                  <Badge variant="secondary" className="shrink-0 tabular-nums">
                                    +{student.null_answers_count}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-3 rounded-lg border border-[var(--cc-sem-warning)]/25 bg-[var(--cc-sem-warning)]/5 px-4 py-3">
                          <p className={cn("flex items-start gap-2 text-xs sm:text-sm", PORTAL_TEXT_MUTED)}>
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cc-sem-warning)]" />
                            This marks eligible unanswered questions as correct and recalculates scores. This is a one-time compensation operation.
                          </p>
                          <Button
                            onClick={handleGrantBonus}
                            disabled={grantingBonus}
                            className={cn("w-full", fp.cta)}
                          >
                            {grantingBonus ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <Gift className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            {grantingBonus ? "Granting bonus points…" : "Grant bonus points"}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {bonusResults && (
                  <div className={cn(AM_PANEL, "space-y-3 border-[var(--cc-sem-success)]/30 bg-[var(--cc-sem-success)]/5")}>
                    <p className={cn("flex items-center gap-2 text-sm font-semibold", PORTAL_TEXT)}>
                      <CheckCircle2 className="h-4 w-4 text-[var(--cc-sem-success)]" />
                      Bonus points granted
                    </p>
                    <div className={cn("space-y-1 text-xs sm:text-sm", PORTAL_TEXT_MUTED)}>
                      <p>
                        {bonusResults.affectedStudents} students · {bonusResults.affectedAnswers} questions updated
                      </p>
                    </div>
                    {Array.isArray(bonusResults.summary) && bonusResults.summary.length > 0 && (
                      <div className={cn(chrome.card, "max-h-48 divide-y divide-[var(--border)] overflow-y-auto")}>
                        {bonusResults.summary.slice(0, 20).map((student: {
                          studentId: string
                          studentName: string
                          section: string
                          quizTitle: string
                          bonusPoints: number
                        }, idx: number) => (
                          <div key={`${student.studentId}-${idx}`} className={AM_ROW}>
                            <div className="min-w-0">
                              <p className={cn("truncate text-sm font-medium", PORTAL_TEXT)}>
                                {student.studentName}
                              </p>
                              <p className={cn("truncate text-xs", PORTAL_TEXT_MUTED)}>
                                {student.section} · {student.quizTitle}
                              </p>
                            </div>
                            <Badge variant="secondary" className="shrink-0 tabular-nums">
                              +{student.bonusPoints}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "deleted" && (
              <div className={cn(tabShellTight, panelSection)}>
                <div className={cn(AM_PANEL, "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between")}>
                  <div className="min-w-0 space-y-1">
                    <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Deleted {assessment.pluralLabel}</p>
                    <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                      Restore within 24 hours before permanent removal.
                    </p>
                    {Array.isArray(deletedItems) && deletedItems.length > 0 ? (
                      <p className={cn("flex items-start gap-1.5 text-xs", PORTAL_TEXT_MUTED)}>
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--cc-sem-warning)]" />
                        Items are permanently removed after 24 hours. Restore before the countdown expires.
                      </p>
                    ) : null}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("h-8 shrink-0 self-start rounded-lg text-xs", chrome.outline)}
                    onClick={() => setActiveTab("quizzes")}
                  >
                    <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                    Back
                  </Button>
                </div>

                {loadingDeleted ? (
                  <div className={cn(AM_PANEL, "flex items-center justify-center gap-2", panelFill)}>
                    <Loader2 className="h-5 w-5 animate-spin text-[var(--cc-accent)]" />
                    <span className={cn("text-sm", PORTAL_TEXT_MUTED)}>Loading deleted items…</span>
                  </div>
                ) : !Array.isArray(deletedItems) || deletedItems.length === 0 ? (
                  <div className={emptyState}>
                    <CheckCircle2 className="mx-auto mb-3 h-10 w-10 opacity-40 text-[var(--cc-sem-success)]" />
                    <p className={cn("text-sm font-medium", PORTAL_TEXT)}>No deleted items</p>
                    <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
                      All {assessment.pluralLabel.toLowerCase()} are accounted for.
                    </p>
                  </div>
                ) : (
                  <div className={cn(chrome.card, "divide-y divide-[var(--border)] overflow-hidden", panelScroll)}>
                    {(Array.isArray(deletedItems) ? deletedItems : []).map((item, index) => {
                      const stripe = portalListStripe(index, chrome.theme.family)
                      const countdown = formatDeletedCountdown(item.deleted_at)

                      return (
                        <div key={item.id} className={cn(AM_LIST_ROW, "items-start gap-3 sm:items-center")}>
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <div
                              className={cn(
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                                stripe.iconBg,
                                stripe.iconText,
                              )}
                            >
                              <Trash2 className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className={cn("truncate text-sm font-semibold", PORTAL_TEXT)}>{item.title}</p>
                                <span className={cn(AM_STATUS_PILL, "bg-[var(--cc-sem-danger)]/10 text-[var(--cc-sem-danger)]")}>
                                  Deleted
                                </span>
                              </div>
                              {item.description ? (
                                <p className={cn("line-clamp-2 text-xs", PORTAL_TEXT_MUTED)}>{item.description}</p>
                              ) : null}
                              <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs", PORTAL_TEXT_MUTED)}>
                                {item.total_questions ? (
                                  <span className="inline-flex items-center gap-1">
                                    <FileText className="h-3.5 w-3.5 shrink-0" />
                                    {item.total_questions} questions
                                  </span>
                                ) : null}
                                {item.time_limit_minutes ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="h-3.5 w-3.5 shrink-0" />
                                    {item.time_limit_minutes} min
                                  </span>
                                ) : null}
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                                  Deleted {new Date(item.deleted_at).toLocaleDateString()}
                                  {item.deleted_by ? ` · ${item.deleted_by}` : ""}
                                </span>
                              </div>
                              <span className={cn("inline-flex items-center gap-1", countdown.className)}>
                                <Clock className="h-3 w-3 shrink-0 opacity-80" />
                                {countdown.label}
                              </span>
                            </div>
                          </div>
                          <div className="flex w-full shrink-0 flex-row items-center gap-2 sm:w-auto sm:justify-end">
                            <Button
                              onClick={() => handleRestoreItem(item.id)}
                              size="sm"
                              className={cn("h-8 flex-1 rounded-lg text-xs sm:flex-none", chrome.success)}
                            >
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              Restore
                            </Button>
                            <Button
                              onClick={() => handlePermanentDelete(item.id)}
                              variant="outline"
                              size="sm"
                              className={cn(
                                "h-8 flex-1 rounded-lg text-xs sm:flex-none",
                                chrome.outline,
                                "text-[var(--cc-sem-danger)] hover:bg-[var(--cc-sem-danger)]/5",
                              )}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              Delete forever
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === "issues" && (
              <div className={cn(tabShell, panelSection)}>
                <div className={cn(AM_PANEL, "space-y-1 shrink-0")}>
                  <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Student-reported issues</p>
                  <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                    Review and resolve questions flagged during {assessment.pluralLabel.toLowerCase()}.
                  </p>
                </div>
                <InstructorQuizIssues
                  assessmentType={assessmentType}
                  courseCode={courseCode}
                  panelLayout={isPanel}
                />
              </div>
            )}

            {activeTab === "results" && (
              <div className={cn(tabShell, panelSection)}>
                <AssessmentResultsViewer assessmentType={assessmentType} embedInDashboard={embedInDashboard} />
              </div>
            )}

            {activeTab === "flagged" && (
              <div className={cn(tabShell, panelSection)}>
                <AssessmentResultsViewer assessmentType={assessmentType} embedInDashboard={embedInDashboard} showFlaggedOnly />
              </div>
            )}

            {activeTab === "analytics" && (
              <div className={cn(tabShellTight, panelSection, panelScroll)}>
                {quizzes.length > 0 ? (
                  <FacultyIntegratedToolbar
                    moduleId={facultyModuleId}
                    filters={
                      quizzes.length > 1 ? (
                        <Select
                          value={analyticsQuizId?.toString() ?? ""}
                          onValueChange={(value) => setAnalyticsQuizId(parseInt(value, 10))}
                        >
                          <SelectTrigger className="h-9 w-full min-w-[12rem] border-0 bg-[var(--sidebar-accent)]/50 shadow-none sm:w-64">
                            <SelectValue placeholder="Choose assessment…" />
                          </SelectTrigger>
                          <SelectContent>
                            {quizzes.map((q) => (
                              <SelectItem key={q.id} value={q.id.toString()}>
                                {q.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : undefined
                    }
                    meta={
                      quizzes.length === 1 ? (
                        <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>{quizzes[0].title}</span>
                      ) : undefined
                    }
                    trailing={
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setAnalyticsRefreshNonce((n) => n + 1)}
                        className={facultyToolbarFilterButtonClass()}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Refresh</span>
                      </Button>
                    }
                  />
                ) : null}
                <AssessmentAnalytics
                  assessmentType={assessmentType}
                  embedInDashboard={embedInDashboard}
                  quizOptions={analyticsQuizOptions}
                  selectedQuizId={analyticsQuizId}
                  onSelectedQuizIdChange={setAnalyticsQuizId}
                  refreshNonce={analyticsRefreshNonce}
                  hideToolbar
                />
              </div>
            )}

            {activeTab === "ai-evaluation" && (
              <div className={cn(tabShell, panelSection)}>
                <InstructorAiEvaluationManager
                  variant="embedded"
                  assessmentTypeFilter={assessmentType}
                  assessmentLabel={assessment.label}
                  panelLayout={isPanel}
                />
              </div>
            )}
          </div>
      </FacultyModuleSplitLayout>

      {bulkReevalQuiz && (
        <AssessmentBulkReevaluateModal
          open={bulkReevalOpen}
          onOpenChange={(open) => {
            setBulkReevalOpen(open)
            if (!open) setBulkReevalQuiz(null)
          }}
          quizId={bulkReevalQuiz.id}
          quizTitle={bulkReevalQuiz.title}
          assessmentLabel={assessment.label}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {assessment.label}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{quizToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className={cn("rounded-xl", fp.cta)}>
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}