"use client"

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, Fragment, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui/pagination"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { getFacultyModuleTheme, facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import {
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  Users,
  AlertTriangle,
  Upload,
  FileUp,
  CheckCircle2,
  XCircle,
  Filter,
  Trash,
  KeyRound,
  AlertCircle,
  CheckCircle,
  Clock,
  Shield,
  Calendar,
  FileText,
  LayoutGrid,
  List,
  UserPlus,
  Mail,
  Search,
  ArrowUpDown,
  Eye,
  Loader2,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
import { usePreventBack } from "@/hooks/use-prevent-back"
import { usePersistedState, useScrollRestoration } from "@/hooks/use-persisted-state"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSessionCatalog } from "@/components/session-catalog-provider"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { getAdminData } from "@/lib/auth"
import { adminApiRequestInit, withAdminIdQuery } from "@/lib/admin-portal-api"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import { PORTAL_CARD, PORTAL_CTA, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import {
  applyRosterColumnMapping,
  autoMapRosterHeaders,
  EMPTY_ROSTER_COLUMN_MAPPING,
  readRosterTableFromFile,
  refineRosterMappingFromRows,
  rosterMappingComplete,
  type RosterColumnMapping,
} from "@/lib/roster-csv"

interface Session {
  id: number
  code: string
  description: string | null
}

interface Student {
  id: number
  student_id: string
  full_name: string
  email?: string | null
  section: string
  session_id: number
  course_id?: number | null
  session_code?: string
  session_description?: string
  created_at: string
  quiz_attempts: number
}

function studentMatchesQuery(student: Student, rawQuery: string) {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return true
  const emailLocal = student.email?.split("@")[0]?.toLowerCase() ?? ""
  const emailFull = student.email?.toLowerCase() ?? ""
  const identityHit =
    student.full_name?.toLowerCase().includes(query) ||
    student.student_id?.toLowerCase().includes(query) ||
    emailLocal.includes(query) ||
    (query.includes("@") && emailFull.includes(query))
  if (identityHit) return true
  // Section codes are ELEG… — ignore them until the query is specific.
  if (query.length < 3) return false
  return (
    student.section?.toLowerCase().includes(query) ||
    student.session_code?.toLowerCase().includes(query)
  )
}

interface StudentFormData {
  student_id: string
  full_name: string
  section: string
  course_id?: string
  session_id?: string
}

type AdminCourseOption = {
  id: number
  course_code: string
  course_title: string
}

interface ParsedRow {
  [key: string]: string
}

type ImportColumnMapping = RosterColumnMapping

interface ImportSummary {
  added: number
  updated: number
  skipped: number
  total: number
}

interface PasswordResetRequest {
  id: number
  student_id: number
  student_number: string
  full_name: string
  section: string
  email: string | null
  status: string
  requested_at: string
  reviewed_at: string | null
  admin_notes: string | null
  is_platform_guest?: boolean | null
}

function formatRegisteredDate(createdAt: string | undefined): string {
  if (!createdAt) {
    return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }
  const date = new Date(createdAt)
  return isNaN(date.getTime())
    ? new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function StudentManagementCard({
  student,
  onView,
  onEdit,
  onReset,
  onDelete,
  readOnly = false,
  iconBg = "bg-gradient-to-br from-blue-100 to-indigo-100",
  iconText = "text-blue-600",
  embedPortal = false,
  viewCtaClass,
}: {
  student: Student
  onView: () => void
  onEdit: () => void
  onReset: () => void
  onDelete: () => void
  readOnly?: boolean
  iconBg?: string
  iconText?: string
  embedPortal?: boolean
  viewCtaClass?: string
}) {
  const cardClass = embedPortal
    ? cn(
        PORTAL_CARD,
        "flex h-full flex-col overflow-hidden shadow-sm transition-colors hover:border-[var(--cc-accent-border)]",
      )
    : "flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-sm transition-all hover:border-teal-300/60 hover:shadow-md dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-teal-500/30"

  return (
    <article className={cardClass}>
      <div className="flex flex-1 flex-col gap-6 p-5 sm:p-6">
        <div className="flex gap-4 sm:gap-5">
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", iconBg)}>
            <Users className={cn("h-5 w-5", iconText)} aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <h3
              className={cn(
                "text-base font-semibold leading-snug break-words",
                embedPortal ? PORTAL_TEXT : "text-slate-900 dark:text-slate-100",
              )}
            >
              {student.full_name}
            </h3>
            <p className={cn("font-mono text-xs", embedPortal ? PORTAL_TEXT_MUTED : "text-slate-500 dark:text-slate-400")}>
              {student.student_id}
            </p>
            {student.email ? (
              <p className={cn("flex items-start gap-2 text-sm", embedPortal ? PORTAL_TEXT_MUTED : "text-slate-600 dark:text-slate-400")}>
                <Mail className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden />
                <span className="min-w-0 break-all leading-relaxed">{student.email}</span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="rounded-lg px-2.5 py-1 text-xs font-medium">
            {student.section}
          </Badge>
          {student.session_code && student.session_code !== student.section ? (
            <Badge variant="outline" className="rounded-lg px-2.5 py-1 text-xs font-medium">
              {student.session_code}
            </Badge>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl border px-4 py-4",
              embedPortal
                ? "border-[var(--border)] bg-[var(--muted)]/40"
                : "border-slate-100 bg-slate-50/80 dark:border-white/[0.06] dark:bg-white/[0.04]",
            )}
          >
            <FileText className={cn("h-4 w-4 shrink-0", iconText)} aria-hidden />
            <div className="min-w-0">
              <p className={cn("text-[11px] font-medium uppercase tracking-wide", embedPortal ? PORTAL_TEXT_MUTED : "text-slate-500 dark:text-slate-400")}>
                Attempts
              </p>
              <p className={cn("text-sm font-semibold", embedPortal ? PORTAL_TEXT : "text-slate-800 dark:text-slate-200")}>
                {student.quiz_attempts}
              </p>
            </div>
          </div>
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl border px-4 py-4",
              embedPortal
                ? "border-[var(--border)] bg-[var(--muted)]/40"
                : "border-slate-100 bg-slate-50/80 dark:border-white/[0.06] dark:bg-white/[0.04]",
            )}
          >
            <Calendar className={cn("h-4 w-4 shrink-0", iconText)} aria-hidden />
            <div className="min-w-0">
              <p className={cn("text-[11px] font-medium uppercase tracking-wide", embedPortal ? PORTAL_TEXT_MUTED : "text-slate-500 dark:text-slate-400")}>
                Registered
              </p>
              <p className={cn("text-sm font-semibold", embedPortal ? PORTAL_TEXT : "text-slate-800 dark:text-slate-200")}>
                {formatRegisteredDate(student.created_at)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "flex flex-col gap-2.5 border-t px-5 py-4 sm:px-6 sm:py-5",
          embedPortal
            ? "border-[var(--border)] bg-[var(--muted)]/25"
            : "border-slate-100 bg-slate-50/60 dark:border-white/[0.06] dark:bg-white/[0.02]",
        )}
      >
        <Button
          size="sm"
          onClick={onView}
          className={cn(
            "min-h-9 w-full rounded-lg text-xs sm:text-sm",
            viewCtaClass ?? "bg-teal-600 text-white hover:bg-teal-700",
          )}
        >
          <Eye className="mr-1.5 h-3.5 w-3.5 shrink-0" />
          View full record
        </Button>
        {!readOnly && (
        <div className="flex flex-wrap gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="min-h-9 min-w-[5.5rem] flex-1 rounded-lg border-slate-200 text-xs sm:text-sm dark:border-white/10"
          >
            <Edit className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="min-h-9 min-w-[5.5rem] flex-1 rounded-lg border-slate-200 text-xs text-amber-700 sm:text-sm dark:border-white/10 dark:text-amber-400"
          >
            <KeyRound className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            Reset
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="min-h-9 min-w-[5.5rem] flex-1 rounded-lg border-slate-200 text-xs text-red-600 sm:text-sm dark:border-white/10 dark:text-red-400"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5 shrink-0" />
            Delete
          </Button>
        </div>
        )}
      </div>
    </article>
  )
}

export function StudentManagement({
  userType = "admin",
  embedInDashboard,
  initialTab,
}: {
  userType?: "admin" | "instructor"
  embedInDashboard?: boolean
  initialTab?: string
}) {
  const fp = userType === "instructor" ? getFacultyModuleTheme("student-mgmt").page : null
  const iconBg = fp?.iconBg ?? "bg-gradient-to-br from-blue-100 to-indigo-100"
  const iconText = fp?.iconText ?? "text-blue-600"
  const badgeCls = fp?.badge ?? "bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 border-0"
  const ctaCls = fp?.cta ?? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25"
  const rowHover = fp ? "hover:bg-[var(--cc-accent-soft)]" : "hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
  const portalItemCard = cn(
    PORTAL_CARD,
    "overflow-hidden shadow-sm transition-colors hover:border-[var(--cc-accent-border)]",
  )
  const portalEmptyCard = cn(PORTAL_CARD, "p-8 text-center sm:p-10")
  const portalListShell = cn(PORTAL_CARD, "overflow-hidden divide-y divide-[var(--border)]")
  const portalCta = fp?.cta ?? "bg-teal-600 hover:bg-teal-700 text-white"
  const embedPortal = Boolean(embedInDashboard && userType === "instructor")
  const spinnerClass = facultyModuleSpinnerClass("student-mgmt")
  const router = useRouter()
  usePreventBack(userType === "admin" ? "/admin/login" : "/instructor/login")
  const { toast } = useToast()
  const { courseScopeVersion, hasPermission } = useInstructorDashboardV2()
  const isTaReadOnly = userType === "instructor" && !hasPermission("manage_students")
  const { selectOptions, defaultCode } = useSessionCatalog()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  // Student tab search is local only — do not persist (avoids stale text after clear)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSessionId, setSelectedSessionId] = usePersistedState<string>(`${userType}-student-session`, "all")
  
  // Restore scroll position
  useScrollRestoration(`${userType}-student-management`)

  const [sessions, setSessions] = useState<Session[]>([])
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false)
  const [studentToResetPassword, setStudentToResetPassword] = useState<Student | null>(null)
  const [resettingPassword, setResettingPassword] = useState(false)
  const [formData, setFormData] = useState<StudentFormData>({
    student_id: "",
    full_name: "",
    section: "",
    course_id: "",
    session_id: "none",
  })
  const [adminCourses, setAdminCourses] = useState<AdminCourseOption[]>([])
  const [adminCourseSessions, setAdminCourseSessions] = useState<Session[]>([])
  const [formError, setFormError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importStep, setImportStep] = useState<"upload" | "mapping" | "preview" | "summary">("upload")
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<ParsedRow[]>([])
  const [columnMapping, setColumnMapping] = useState<ImportColumnMapping>({ ...EMPTY_ROSTER_COLUMN_MAPPING })
  const [coraMapNotes, setCoraMapNotes] = useState("")
  const [mappingBusy, setMappingBusy] = useState(false)
  const [rosterDrag, setRosterDrag] = useState(false)
  const rosterFileRef = useRef<HTMLInputElement>(null)
  const [importSection, setImportSection] = useState<string>("")
  const [importAcademicTermId, setImportAcademicTermId] = useState<number | null>(null)

  useEffect(() => {
    if (!defaultCode) return
    setImportSection((s) => s || defaultCode)
    setFormData((fd) => (fd.section ? fd : { ...fd, section: defaultCode }))
  }, [defaultCode])
  const [importSessionId, setImportSessionId] = useState<number | null>(null)
  const [academicTerms, setAcademicTerms] = useState<any[]>([])
  const [sessionsByTerm, setSessionsByTerm] = useState<Record<number, any[]>>({})
  const [importing, setImporting] = useState(false)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null)

  const [activeTab, setActiveTab] = useState(initialTab ?? "students")
  const [resetRequests, setResetRequests] = useState<PasswordResetRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<PasswordResetRequest | null>(null)
  const [reviewNotes, setReviewNotes] = useState("")
  const [reviewing, setReviewing] = useState(false)
  const [viewMode, setViewMode] = useState<"card" | "list">("card")
  const [studentsPage, setStudentsPage] = useState(1)
  const STUDENTS_PAGE_SIZE = 12
  const handleStudentSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    setStudentsPage(1)
  }, [])
  const handleStudentSearchClear = useCallback(() => {
    setSearchQuery("")
    setStudentsPage(1)
  }, [])

  // Account Requests state
  const [accountRequests, setAccountRequests] = useState<any[]>([])
  const [loadingAccountRequests, setLoadingAccountRequests] = useState(false)
  const [selectedAccountRequest, setSelectedAccountRequest] = useState<any | null>(null)
  const [accountReviewDialogOpen, setAccountReviewDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [reviewingAccount, setReviewingAccount] = useState(false)

  // View organizer for Resets
  const [resetStatusFilter, setResetStatusFilter] = usePersistedState(`${userType}-reset-status`, "all")
  const [resetSortOrder, setResetSortOrder] = usePersistedState<"newest" | "oldest">(`${userType}-reset-sort`, "newest")
  const [resetSearchQuery, setResetSearchQuery] = usePersistedState(`${userType}-reset-search`, "")
  const [resetViewMode, setResetViewMode] = usePersistedState<"grid" | "list">(`${userType}-reset-view`, "grid")

  // View organizer for Account Requests
  const [accountStatusFilter, setAccountStatusFilter] = usePersistedState(`${userType}-account-status`, "all")
  const [accountSortOrder, setAccountSortOrder] = usePersistedState<"newest" | "oldest">(`${userType}-account-sort`, "newest")
  const [accountSearchQuery, setAccountSearchQuery] = usePersistedState(`${userType}-account-search`, "")
  const [accountViewMode, setAccountViewMode] = usePersistedState<"grid" | "list">(`${userType}-account-view`, "grid")

  useEffect(() => {
    // Check authentication based on user type
    if (userType === "admin") {
      if (!getAdminData()) {
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

    fetchSessions()
    fetchStudents()
    fetchAcademicTerms()
    if (userType === "admin") void fetchAdminCourses()
    // Fetch all tab data on initial load so badge counts are visible
    fetchPasswordResetRequests()
    fetchAccountRequests()
  }, [router, userType, courseScopeVersion])

  /** Reset student search when instructor switches course scope (top bar). */
  useEffect(() => {
    if (userType !== "instructor") return
    setSearchQuery("")
    void fetchSessions()
  }, [courseScopeVersion, userType])

  useEffect(() => {
    fetchStudents()
  }, [selectedSessionId, courseScopeVersion])

  useEffect(() => {
    setStudentsPage(1)
  }, [selectedSessionId])

  useEffect(() => {
    if (activeTab === "password-resets") {
      fetchPasswordResetRequests()
    } else if (activeTab === "account-requests") {
      fetchAccountRequests()
    }
  }, [activeTab, courseScopeVersion])

  const getApiPrefix = () => userType === "admin" ? "/api/admin" : "/api/instructor"

  const portalRequestHeaders = (extra?: HeadersInit): Record<string, string> => {
    if (userType === "admin") {
      return adminApiRequestInit(extra).headers
    }
    const out: Record<string, string> = {}
    if (extra instanceof Headers) {
      extra.forEach((v, k) => {
        out[k] = v
      })
    } else if (Array.isArray(extra)) {
      for (const [k, v] of extra) out[k] = v
    } else if (extra && typeof extra === "object") {
      Object.assign(out, extra as Record<string, string>)
    }
    Object.assign(out, buildInstructorApiHeaders())
    const instructorSession = localStorage.getItem("instructorSession")
    if (instructorSession) out["authorization"] = instructorSession
    return out
  }

  const apiUrl = (path: string) => {
    const normalized = path.startsWith("/") ? path : `/${path}`
    const base = `${getApiPrefix()}${normalized}`
    if (userType !== "admin") return base
    const admin = getAdminData()
    return withAdminIdQuery(base, admin?.id != null ? String(admin.id) : null)
  }

  const fetchAdminCourses = async () => {
    try {
      const res = await fetch(apiUrl("/courses"), { headers: portalRequestHeaders() })
      const data = await res.json()
      if (res.ok && data.courses) {
        setAdminCourses(
          data.courses.map((c: AdminCourseOption) => ({
            id: c.id,
            course_code: c.course_code,
            course_title: c.course_title,
          })),
        )
      }
    } catch {
      setAdminCourses([])
    }
  }

  const fetchAdminSessionsForCourse = async (courseId: string) => {
    if (!courseId) {
      setAdminCourseSessions([])
      return
    }
    try {
      const res = await fetch(apiUrl(`/sessions?course_id=${courseId}`), {
        headers: portalRequestHeaders(),
      })
      const data = await res.json()
      setAdminCourseSessions(res.ok ? data.sessions || [] : [])
    } catch {
      setAdminCourseSessions([])
    }
  }

  useEffect(() => {
    if (userType !== "admin" || !formData.course_id) return
    void fetchAdminSessionsForCourse(formData.course_id)
  }, [formData.course_id, userType])

  const fetchSessions = async () => {
    try {
      const response = await fetch(apiUrl("/sessions"), {
        headers: portalRequestHeaders(),
      })
      const data = await response.json()
      const list = Array.isArray(data.sessions) ? data.sessions : []
      setSessions(list)

      if (userType === "instructor") {
        try {
          const raw = localStorage.getItem("instructorSession")
          if (raw) {
            const parsed = JSON.parse(raw) as { selectedSessionId?: number }
            const scopedSessionId =
              typeof parsed.selectedSessionId === "number" && Number.isFinite(parsed.selectedSessionId)
                ? String(parsed.selectedSessionId)
                : null
            if (scopedSessionId && list.some((s: Session) => String(s.id) === scopedSessionId)) {
              setSelectedSessionId(scopedSessionId)
            } else if (list.length === 1) {
              setSelectedSessionId(String(list[0].id))
            } else {
              setSelectedSessionId("all")
            }
          }
        } catch {
          /* ignore */
        }
      }
    } catch (error) {
      console.error("[v0] Failed to fetch sessions:", error)
      setSessions([])
    }
  }

  const fetchAcademicTerms = async () => {
    try {
      const response = await fetch(apiUrl("/academic-terms"), {
        headers: portalRequestHeaders(),
      })
      if (response.ok) {
        const data = await response.json()
        setAcademicTerms(data.terms || [])
        // Set default to first active term
        const activeTerm = data.terms?.find((t: any) => t.is_active) || data.terms?.[0]
        if (activeTerm) {
          setImportAcademicTermId(activeTerm.id)
          fetchSessionsForTerm(activeTerm.id)
        }
      }
    } catch (error) {
      console.error("[v0] Failed to fetch academic terms:", error)
    }
  }

  const fetchSessionsForTerm = async (termId: number) => {
    try {
      const response = await fetch(apiUrl(`/sessions?academic_term_id=${termId}`), {
        headers: portalRequestHeaders(),
      })
      if (response.ok) {
        const data = await response.json()
        const list = Array.isArray(data.sessions) ? data.sessions : []
        setSessionsByTerm((prev) => ({ ...prev, [termId]: list }))
        // Auto-select first session if available
        if (list.length > 0 && !importSessionId) {
          setImportSessionId(list[0].id)
          setImportSection(list[0].code)
        }
      }
    } catch (error) {
      console.error("[v0] Failed to fetch sessions for term:", error)
    }
  }

  const fetchStudents = async () => {
    try {
      const path =
        selectedSessionId && selectedSessionId !== "all"
          ? `/students?session_id=${selectedSessionId}`
          : "/students"
      const url = apiUrl(path)

      console.log("[StudentManagement] Fetching students from:", url)

      const response = await fetch(url, { headers: portalRequestHeaders() })
      
      if (!response.ok) {
        console.error("[StudentManagement] Response not OK:", response.status)
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to fetch students: ${response.status}`)
      }
      
      const data = await response.json()
      console.log("[StudentManagement] Received students:", data.students?.length || 0)
      setStudents(data.students || [])
    } catch (error) {
      console.error("[v0] Failed to fetch students:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load students",
        variant: "destructive",
      })
      setStudents([]) // Set empty array on error
    } finally {
      setLoading(false)
    }
  }

  const fetchPasswordResetRequests = async () => {
    setLoadingRequests(true)
    try {
      const headers = portalRequestHeaders()
      const response = await fetch(apiUrl("/password-resets"), { headers })
      const data = await response.json()
      setResetRequests(Array.isArray(data.requests) ? data.requests : [])
    } catch (error) {
      console.error("[v0] Failed to fetch password reset requests:", error)
      toast({
        title: "Error",
        description: "Failed to load password reset requests",
        variant: "destructive",
      })
    } finally {
      setLoadingRequests(false)
    }
  }

  const fetchAccountRequests = async () => {
    setLoadingAccountRequests(true)
    try {
      const response = await fetch(apiUrl("/account-requests"), {
        headers: portalRequestHeaders(),
      })
      const data = await response.json()
      setAccountRequests(Array.isArray(data.requests) ? data.requests : [])
    } catch (error) {
      console.error("[v0] Failed to fetch account requests:", error)
      toast({
        title: "Error",
        description: "Failed to load account requests",
        variant: "destructive",
      })
    } finally {
      setLoadingAccountRequests(false)
    }
  }

  const handleBulkDelete = async () => {
    if (!selectedSessionId || selectedSessionId === "all") return

    setBulkDeleting(true)

    try {
      const headers: HeadersInit = { "Content-Type": "application/json" }
      if (userType === "instructor") {
        const instructorId = localStorage.getItem("instructorId")
        const instructorSession = localStorage.getItem("instructorSession")
        if (instructorId) headers["x-instructor-id"] = instructorId
        if (instructorSession) headers["authorization"] = instructorSession
      }
      
      const response = await fetch(apiUrl("/students/bulk-delete"), {
        method: "POST",
        headers,
        body: JSON.stringify({ session_id: Number.parseInt(selectedSessionId) }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete students")
      }

      toast({
        title: "Students deleted",
        description: `${data.deletedCount} student(s) have been removed from this session.`,
      })

      setShowBulkDeleteDialog(false)
      fetchStudents()
    } catch (error) {
      console.error("[v0] Failed to bulk delete:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete students",
        variant: "destructive",
      })
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleOpenDialog = (student?: Student) => {
    if (student) {
      setEditingStudent(student)
      const courseId =
        userType === "admin" && student.course_id != null ? String(student.course_id) : ""
      setFormData({
        student_id: student.student_id,
        full_name: student.full_name,
        section: student.section,
        course_id: courseId,
        session_id: student.session_id ? String(student.session_id) : "none",
      })
      if (userType === "admin" && courseId) void fetchAdminSessionsForCourse(courseId)
    } else {
      setEditingStudent(null)
      setFormData({
        student_id: "",
        full_name: "",
        section: defaultCode || "",
        course_id: adminCourses[0] ? String(adminCourses[0].id) : "",
        session_id: "none",
      })
    }
    setFormError("")
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingStudent(null)
    setFormData({
      student_id: "",
      full_name: "",
      section: defaultCode || "",
      course_id: "",
      session_id: "none",
    })
    setAdminCourseSessions([])
    setFormError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    setSubmitting(true)

    try {
      const url = editingStudent ? apiUrl(`/students/${editingStudent.id}`) : apiUrl("/students")
      const method = editingStudent ? "PATCH" : "POST"

      if (userType === "admin" && !formData.course_id) {
        setFormError("Please select a course")
        setSubmitting(false)
        return
      }

      const payload =
        userType === "admin"
          ? {
              student_id: formData.student_id,
              full_name: formData.full_name,
              course_id: Number(formData.course_id),
              session_id: formData.session_id === "none" ? null : formData.session_id,
              section: formData.section,
            }
          : formData

      const response = await fetch(url, {
        method,
        headers: { ...portalRequestHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        setFormError(data.error || "Failed to save student")
        return
      }

      toast({
        title: editingStudent ? "Student updated" : "Student added",
        description: editingStudent
          ? `${formData.full_name} has been updated successfully.`
          : `${formData.full_name} has been added successfully.`,
      })

      handleCloseDialog()
      fetchStudents()
    } catch (error) {
      console.error("[v0] Failed to save student:", error)
      setFormError("Failed to save student")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteClick = (student: Student) => {
    setStudentToDelete(student)
    setDeleteDialogOpen(true)
  }

  const handleViewStudent = (student: Student) => {
    const base =
      userType === "admin"
        ? "/admin/dashboard-v2/management/students"
        : `${FACULTY_DASHBOARD_BASE}/management/students`
    router.push(`${base}/${student.id}`)
  }

  const handleDeleteConfirm = async () => {
    if (!studentToDelete) return

    setDeleting(true)

    try {
      const headers: HeadersInit = {}
      if (userType === "instructor") {
        const instructorId = localStorage.getItem("instructorId")
        const instructorSession = localStorage.getItem("instructorSession")
        if (instructorId) headers["x-instructor-id"] = instructorId
        if (instructorSession) headers["authorization"] = instructorSession
      }
      
      const response = await fetch(apiUrl(`/students/${studentToDelete.id}`), {
        method: "DELETE",
        headers,
      })

      if (response.ok) {
        toast({
          title: "Student deleted",
          description: `${studentToDelete.full_name} and all their quiz attempts have been removed.`,
          variant: "default",
        })
        fetchStudents()
      } else {
        toast({
          title: "Failed to delete student",
          description: "An error occurred while deleting the student. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[v0] Failed to delete student:", error)
      toast({
        title: "Failed to delete student",
        description: "An error occurred while deleting the student. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setStudentToDelete(null)
    }
  }

  const handleResetPasswordClick = (student: Student) => {
    setStudentToResetPassword(student)
    setResetPasswordDialogOpen(true)
  }

  const handleResetPasswordConfirm = async () => {
    if (!studentToResetPassword) return

    setResettingPassword(true)

    try {
      console.log(`[Password Reset] Resetting password for student ${studentToResetPassword.id} (${studentToResetPassword.full_name})`)
      
      const response = await instructorApiFetch(`/api/instructor/students/${studentToResetPassword.id}/reset-password`, {
        method: "POST",
        headers: {
          "x-instructor-id": localStorage.getItem("instructorId") || "",
          "Content-Type": "application/json"
        }
      })

      const data = await response.json()

      if (response.ok) {
        console.log(`[Password Reset] Success!`, data)
        const emailed = data.emailSent === true

        toast({
          title: "✅ Password Reset Successfully",
          description: (
            <div className="space-y-2">
              <p className="font-semibold">{studentToResetPassword.full_name}'s password has been reset!</p>
              <div className="bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded-lg p-3 mt-2">
                <p className="text-sm font-mono font-bold text-orange-900 dark:text-orange-100">
                  🔑 New Password: ELEG2026!
                </p>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                ⚠️ Student will be prompted to change this password on their next login.
              </p>
              {emailed ? (
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  We emailed them the temporary password and a link to sign in.
                </p>
              ) : (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  No valid email on file — share{" "}
                  <span className="font-mono font-semibold">ELEG2026!</span> securely (e.g. in person).
                </p>
              )}
            </div>
          ),
          duration: 15000, // 15 seconds
        })
      } else {
        console.error(`[Password Reset] Failed:`, data.error)
        
        toast({
          title: "❌ Failed to reset password",
          description: data.details || data.error || "An error occurred",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("[Password Reset] Exception:", error)
      toast({
        title: "❌ Failed to reset password",
        description: "Network error. Please try again.",
        variant: "destructive",
      })
    } finally {
      setResettingPassword(false)
      setResetPasswordDialogOpen(false)
      setStudentToResetPassword(null)
    }
  }

  const processRosterFile = async (file: File) => {
    const lower = file.name.toLowerCase()
    if (!lower.endsWith(".csv") && !lower.endsWith(".zip")) {
      toast({
        title: "Invalid file type",
        description: "Upload the Canvas zip or the CSV inside it.",
        variant: "destructive",
      })
      return
    }

    setCsvFile(file)
    setMappingBusy(true)
    setCoraMapNotes("")
    try {
      const { headers, rows, sourceName } = await readRosterTableFromFile(file)
      if (headers.length === 0 || rows.length === 0) {
        toast({
          title: "Empty file",
          description: sourceName ? `${sourceName} has no student rows.` : "The file appears to be empty.",
          variant: "destructive",
        })
        return
      }

      setCsvHeaders(headers)
      setCsvRows(rows)
      setColumnMapping(refineRosterMappingFromRows(autoMapRosterHeaders(headers), rows))
      setImportStep("mapping")

      const headersInit: HeadersInit = portalRequestHeaders({ "Content-Type": "application/json" })
      const mapRes = await fetch(apiUrl("/students/import/map-columns"), {
        method: "POST",
        headers: headersInit,
        body: JSON.stringify({ headers, samples: rows.slice(0, 4) }),
      })
      if (mapRes.ok) {
        const mapped = await mapRes.json()
        if (mapped.mapping) {
          setColumnMapping(refineRosterMappingFromRows(mapped.mapping, rows))
        }
        if (mapped.notes) setCoraMapNotes(String(mapped.notes))
      }
    } catch (err) {
      toast({
        title: "Could not read file",
        description: err instanceof Error ? err.message : "Try the CSV from the Canvas zip.",
        variant: "destructive",
      })
    } finally {
      setMappingBusy(false)
      if (rosterFileRef.current) rosterFileRef.current.value = ""
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await processRosterFile(file)
  }

  const isMappingValid = () => {
    return rosterMappingComplete(columnMapping, csvRows) && Boolean(importAcademicTermId && importSessionId)
  }

  const handlePreview = () => {
    if (!isMappingValid()) {
      const missing = []
      if (!columnMapping.full_name) missing.push("Full Name column")
      if (!columnMapping.student_id && !columnMapping.email) missing.push("Student ID or Email column")
      if (!importAcademicTermId) missing.push("Academic Term")
      if (!importSessionId) missing.push("Session")
      
      toast({
        title: "Incomplete configuration",
        description: `Please complete: ${missing.join(", ")}.`,
        variant: "destructive",
      })
      return
    }
    setImportStep("preview")
  }

  const handleImport = async () => {
    setImporting(true)
    setImportProgress({ current: 0, total: csvRows.length })

    try {
      const mappedRows = applyRosterColumnMapping(csvRows, columnMapping)
      if (mappedRows.length === 0) {
        throw new Error("No student rows could be mapped. Check name and email columns.")
      }

      const headers: HeadersInit = portalRequestHeaders({ "Content-Type": "application/json" })

      setImportProgress({ current: mappedRows.length, total: mappedRows.length })
      const response = await fetch(apiUrl("/students/import"), {
        method: "POST",
        headers,
        body: JSON.stringify({
          section: importSection,
          session_id: importSessionId,
          session_code: importSection,
          academic_term_id: importAcademicTermId,
          rows: mappedRows,
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (response.status === 429) {
        throw new Error("Too many requests. Please wait a moment and try again.")
      }
      if (!response.ok) {
        throw new Error(data.error || "Import failed")
      }

      setImportSummary({
        added: data.summary?.added ?? 0,
        updated: data.summary?.updated ?? 0,
        skipped: data.summary?.skipped ?? 0,
        total: data.summary?.total ?? mappedRows.length,
      })
      setImportStep("summary")
      setImportProgress(null)
      fetchStudents()
    } catch (error) {
      console.error("[v0] Import failed:", error)
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "An error occurred during import.",
        variant: "destructive",
      })
      setImportProgress(null)
    } finally {
      setImporting(false)
    }
  }

  const handleCloseImportDialog = () => {
    setImportDialogOpen(false)
    setImportStep("upload")
    setCsvFile(null)
    setCsvHeaders([])
    setCsvRows([])
    setColumnMapping({ ...EMPTY_ROSTER_COLUMN_MAPPING })
    setCoraMapNotes("")
    setMappingBusy(false)
    setRosterDrag(false)
    setImportSection(defaultCode || "")
    setImportSessionId(null)
    // Reset to first active term
    const activeTerm = academicTerms.find(t => t.is_active) || academicTerms[0]
    if (activeTerm) {
      setImportAcademicTermId(activeTerm.id)
      fetchSessionsForTerm(activeTerm.id)
    } else {
      setImportAcademicTermId(null)
    }
    setImportSummary(null)
  }

  const handleReviewRequest = (request: PasswordResetRequest) => {
    setSelectedRequest(request)
    setReviewNotes("")
    setReviewDialogOpen(true)
  }

  const handleApproveRequest = async () => {
    if (!selectedRequest) return

    setReviewing(true)
    try {
      const adminId = sessionStorage.getItem("adminId")
      const headers: HeadersInit = { "Content-Type": "application/json" }
      if (userType === "instructor") {
        const instructorId = localStorage.getItem("instructorId")
        const instructorSession = localStorage.getItem("instructorSession")
        if (instructorId) headers["x-instructor-id"] = instructorId
        if (instructorSession) headers["authorization"] = instructorSession
      }
      
      const response = await fetch(apiUrl(`/password-resets/${selectedRequest.id}/approve`), {
        method: "POST",
        headers,
        body: JSON.stringify({ adminId, notes: reviewNotes }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.details || data.error || "Failed to approve request")
      }

      const emailed = data.emailSent === true

      toast({
        title: "Request approved",
        description: (
          <div className="space-y-2">
            <p>
              Password reset for {selectedRequest.full_name} is complete. They can sign in with the temporary password.
            </p>
            {emailed ? (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                We emailed them the temporary password and sign-in link.
              </p>
            ) : (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {typeof data.emailNotice === "string" ? (
                  data.emailNotice
                ) : (
                  <>
                    No valid email on file — share{" "}
                    <span className="font-mono font-semibold">ELEG2026!</span> securely (e.g. in person).
                  </>
                )}
              </p>
            )}
          </div>
        ),
      })

      setReviewDialogOpen(false)
      fetchPasswordResetRequests()
    } catch (error) {
      console.error("[v0] Failed to approve request:", error)
      toast({
        title: "Error",
        description: "Failed to approve request",
        variant: "destructive",
      })
    } finally {
      setReviewing(false)
    }
  }

  const handleRejectRequest = async () => {
    if (!selectedRequest) return

    setReviewing(true)
    try {
      const adminId = sessionStorage.getItem("adminId")
      const headers: HeadersInit = { "Content-Type": "application/json" }
      if (userType === "instructor") {
        const instructorId = localStorage.getItem("instructorId")
        const instructorSession = localStorage.getItem("instructorSession")
        if (instructorId) headers["x-instructor-id"] = instructorId
        if (instructorSession) headers["authorization"] = instructorSession
      }
      
      const response = await fetch(apiUrl(`/password-resets/${selectedRequest.id}/reject`), {
        method: "POST",
        headers,
        body: JSON.stringify({ adminId, notes: reviewNotes }),
      })

      if (!response.ok) {
        throw new Error("Failed to reject request")
      }

      toast({
        title: "Request rejected",
        description: `Password reset request for ${selectedRequest.full_name} has been rejected.`,
      })

      setReviewDialogOpen(false)
      fetchPasswordResetRequests()
    } catch (error) {
      console.error("[v0] Failed to reject request:", error)
      toast({
        title: "Error",
        description: "Failed to reject request",
        variant: "destructive",
      })
    } finally {
      setReviewing(false)
    }
  }

  const handleApproveAccountRequest = async () => {
    if (!selectedAccountRequest) return

    setReviewingAccount(true)
    try {
      const response = await fetch(apiUrl(`/account-requests/${selectedAccountRequest.id}/approve`), {
        method: "POST",
        headers: portalRequestHeaders({ "Content-Type": "application/json" }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to approve account request")
      }

      const isGuestReq = selectedAccountRequest.request_kind === "guest"
      toast({
        title: "✅ Account Approved",
        description: isGuestReq
          ? String(data.message ?? "Career Member can sign in on the Career Member page with the email and password they submitted.")
          : `${selectedAccountRequest.full_name} can now login with default password ELEG2026!`,
      })

      setAccountReviewDialogOpen(false)
      fetchAccountRequests()
      fetchStudents() // Refresh student list
    } catch (error) {
      console.error("[v0] Failed to approve account request:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve account request",
        variant: "destructive",
      })
    } finally {
      setReviewingAccount(false)
    }
  }

  const handleRejectAccountRequest = async () => {
    if (!selectedAccountRequest) return

    setReviewingAccount(true)
    try {
      const response = await fetch(apiUrl(`/account-requests/${selectedAccountRequest.id}/reject`), {
        method: "POST",
        headers: portalRequestHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ reason: rejectionReason }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to reject account request")
      }

      toast({
        title: "Request Rejected",
        description: `Account request from ${selectedAccountRequest.full_name} has been rejected.`,
      })

      setAccountReviewDialogOpen(false)
      setRejectionReason("")
      fetchAccountRequests()
    } catch (error) {
      console.error("[v0] Failed to reject account request:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reject account request",
        variant: "destructive",
      })
    } finally {
      setReviewingAccount(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300/60 dark:border-amber-500/40">
            <Clock className="h-3 w-3 mr-1 shrink-0" />
            Pending
          </Badge>
        )
      case "approved":
        return (
          <Badge variant="outline" className="rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300/60 dark:border-emerald-500/40">
            <CheckCircle className="h-3 w-3 mr-1 shrink-0" />
            Approved
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="outline" className="rounded-lg bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-300/60 dark:border-red-500/40">
            <XCircle className="h-3 w-3 mr-1 shrink-0" />
            Rejected
          </Badge>
        )
      case "completed":
        return (
          <Badge
            variant="outline"
            className={cn(
              "rounded-lg",
              fp
                ? cn(fp.softBg, fp.iconText, fp.border)
                : "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-300/60 dark:border-teal-500/40",
            )}
          >
            <CheckCircle className="h-3 w-3 mr-1 shrink-0" />
            Completed
          </Badge>
        )
      default:
        return <Badge variant="outline" className="rounded-lg">{status}</Badge>
    }
  }

  const selectedSession = (sessions ?? []).find((s) => s.id.toString() === selectedSessionId)

  const deferredSearchQuery = useDeferredValue(searchQuery)
  const filteredStudents = useMemo(
    () => students.filter((student) => studentMatchesQuery(student, deferredSearchQuery)),
    [students, deferredSearchQuery],
  )

  const totalStudentsPages = Math.ceil(filteredStudents.length / STUDENTS_PAGE_SIZE) || 1
  const safePage = Math.min(Math.max(1, studentsPage), totalStudentsPages)
  const paginatedStudents = filteredStudents.slice(
    (safePage - 1) * STUDENTS_PAGE_SIZE,
    safePage * STUDENTS_PAGE_SIZE
  )

  // Filtered & sorted reset requests
  const filteredResetRequests = (() => {
    const filtered = resetRequests.filter((r) => {
      if (resetStatusFilter !== "all" && r.status !== resetStatusFilter) return false
      if (!resetSearchQuery) return true
      const q = resetSearchQuery.toLowerCase()
      return (
        (r.full_name ?? "").toLowerCase().includes(q) ||
        (r.student_number ?? "").toLowerCase().includes(q) ||
        (r.section ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.is_platform_guest && (q.includes("guest") || q.includes("platform")))
      )
    })
    return filtered.sort((a, b) => {
      const da = new Date(a.requested_at).getTime()
      const db = new Date(b.requested_at).getTime()
      return resetSortOrder === "newest" ? db - da : da - db
    })
  })()

  // Filtered & sorted account requests
  const filteredAccountRequests = (() => {
    const filtered = accountRequests.filter(
      (r: {
        status: string
        full_name?: string
        student_id?: string
        section?: string
        email?: string
        organization?: string
        guest_purpose?: string
      }) => {
      if (accountStatusFilter !== "all" && r.status !== accountStatusFilter) return false
      if (!accountSearchQuery) return true
      const q = accountSearchQuery.toLowerCase()
      const purposeLabel =
        r.guest_purpose === "recommendation_letter"
          ? "recommendation letter"
          : r.guest_purpose === "other"
            ? "other"
            : ""
      return (
        (r.full_name ?? "").toLowerCase().includes(q) ||
        (r.student_id ?? "").toLowerCase().includes(q) ||
        (r.section ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.organization ?? "").toLowerCase().includes(q) ||
        purposeLabel.includes(q)
      )
    })
    return filtered.sort((a: { created_at: string }, b: { created_at: string }) => {
      const da = new Date(a.created_at).getTime()
      const db = new Date(b.created_at).getTime()
      return accountSortOrder === "newest" ? db - da : da - db
    })
  })()

  const rootClassName = embedInDashboard
    ? "w-full min-w-0 space-y-3"
    : "container mx-auto space-y-4 overflow-x-hidden px-3 py-4 sm:space-y-6 sm:px-4 sm:py-6 md:px-6 md:py-8"

  if (loading) {
    return (
      <div className={cn(rootClassName, !embedInDashboard && "py-12 sm:py-16 md:py-20")}>
        <div className="flex flex-col items-center justify-center py-12">
          <div className={cn("relative mb-3 h-10 w-10 sm:mb-4", spinnerClass)} aria-hidden />
          <p className={cn("text-xs sm:text-sm", embedPortal ? PORTAL_TEXT_MUTED : "text-slate-600")}>
            Loading students…
          </p>
        </div>
      </div>
    )
  }

  const embedDirectoryMenu =
    embedInDashboard && userType === "instructor" ? (
      <FacultyModuleSideMenu
        moduleId="student-mgmt"
        title="Directory"
        activeId={activeTab}
        onSelect={setActiveTab}
        items={[
          { id: "students", label: "Students", icon: Users, badge: students.length },
          ...(!isTaReadOnly
            ? [
                {
                  id: "password-resets",
                  label: "Password resets",
                  icon: Shield,
                  badge: resetRequests.filter((r) => r.status === "pending").length || undefined,
                },
                {
                  id: "account-requests",
                  label: "Account requests",
                  icon: UserPlus,
                  badge:
                    accountRequests.filter((r: { status: string }) => r.status === "pending").length ||
                    undefined,
                },
              ]
            : []),
        ]}
      />
    ) : null

  const DirectoryShell = embedInDashboard && userType === "instructor"
    ? ({ children }: { children: ReactNode }) => (
        <FacultyModuleSplitLayout menu={embedDirectoryMenu!}>{children}</FacultyModuleSplitLayout>
      )
    : ({ children }: { children: ReactNode }) => <>{children}</>

  return (
    <div className={rootClassName}>
      {isTaReadOnly && (
        <Alert className={cn("mb-4", embedPortal ? cn(fp?.softBg, fp?.border, "border") : "border-teal-200 bg-teal-50/80 dark:border-teal-500/30 dark:bg-teal-500/10")}>
          <AlertCircle className={cn("h-4 w-4", iconText)} />
          <AlertDescription className={embedPortal ? PORTAL_TEXT : "text-teal-800 dark:text-teal-200"}>
            View-only directory: teaching assistants cannot add, remove, or change student enrollment.
          </AlertDescription>
        </Alert>
      )}
      <DirectoryShell>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0">
        {!(embedInDashboard && userType === "instructor") && (
        <div className="mb-5 flex flex-col gap-4 sm:mb-7 sm:gap-5">
          <div className="flex flex-col gap-3 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
            <div className="min-w-0 overflow-x-auto -mx-0.5 px-0.5 scrollbar-thin">
              <TabsList className="inline-flex h-auto min-w-0 gap-1 rounded-2xl border border-slate-200/60 bg-slate-100/80 p-1 dark:border-white/10 dark:bg-white/5">
                <TabsTrigger 
                  value="students"
                  className="gap-1.5 sm:gap-2 rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-0 shadow-none text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white fp.tabActive transition-colors shrink-0"
                >
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  Students
                </TabsTrigger>
                {!isTaReadOnly && (
                  <>
                <TabsTrigger 
                  value="password-resets"
                  className="gap-1.5 sm:gap-2 rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-0 shadow-none text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white fp.tabActive transition-colors shrink-0"
                >
                  <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  Resets
                  {resetRequests.filter((r) => r.status === "pending").length > 0 && (
                    <Badge variant="destructive" className="ml-0.5 rounded-full text-[10px] px-1.5 py-0">
                      {resetRequests.filter((r) => r.status === "pending").length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="account-requests"
                  className="gap-1.5 sm:gap-2 rounded-xl px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-0 shadow-none text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white fp.tabActive transition-colors shrink-0"
                >
                  <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                  Requests
                  {accountRequests.filter((r: any) => r.status === "pending").length > 0 && (
                    <Badge variant="destructive" className="ml-0.5 rounded-full text-[10px] px-1.5 py-0">
                      {accountRequests.filter((r: any) => r.status === "pending").length}
                    </Badge>
                  )}
                </TabsTrigger>
                  </>
                )}
              </TabsList>
            </div>

            {activeTab === "students" && !embedInDashboard && (
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {!isTaReadOnly && (
                  <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setImportDialogOpen(true)}
                  className="h-9 shrink-0 rounded-lg border-slate-200 text-xs sm:rounded-xl sm:text-sm dark:border-white/10"
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                  Import
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleOpenDialog()}
                  className="h-9 shrink-0 rounded-lg bg-teal-600 text-xs text-white hover:bg-teal-700 sm:rounded-xl sm:text-sm"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                  Add Student
                </Button>
                  </>
                )}
                <div className="flex items-center gap-1 rounded-lg border border-slate-200/60 bg-slate-100/80 p-1 dark:border-white/10 dark:bg-white/5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode("card")}
                    aria-label="Card view"
                    className={cn(
                      "h-8 w-8 rounded-md p-0",
                      viewMode === "card"
                        ? cn("bg-teal-500/20", iconText)
                        : "hover:bg-white/50 dark:hover:bg-white/5",
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode("list")}
                    aria-label="List view"
                    className={cn(
                      "h-8 w-8 rounded-md p-0",
                      viewMode === "list"
                        ? cn("bg-teal-500/20", iconText)
                        : "hover:bg-white/50 dark:hover:bg-white/5",
                    )}
                  >
                    <List className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {!embedInDashboard && (
            <Link
              href={userType === "admin" ? "/admin/dashboard-v2" : "/instructor/dashboard"}
              className="self-start"
            >
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-lg border-slate-200 text-xs sm:rounded-xl sm:text-sm dark:border-white/10"
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                Back
              </Button>
            </Link>
          )}
        </div>
        )}

        <TabsContent value="students" className="space-y-3">
          {embedInDashboard ? (
            <FacultyIntegratedToolbar
              moduleId="student-mgmt"
              searchResetToken={courseScopeVersion}
              onSearchChange={handleStudentSearchChange}
              onSearchClear={handleStudentSearchClear}
              searchPlaceholder="Search by name, ID, email, or section…"
              filters={
                <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                  <SelectTrigger
                    className={cn(
                      facultyToolbarFilterButtonClass(selectedSessionId !== "all"),
                      "h-9 w-[148px] shadow-none",
                    )}
                  >
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
              }
              viewMode={viewMode === "card" ? "grid" : "list"}
              onViewModeChange={(mode) => setViewMode(mode === "grid" ? "card" : "list")}
              meta={
                <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                  {filteredStudents.length === students.length
                    ? `${filteredStudents.length} students`
                    : `${filteredStudents.length} of ${students.length} students`}
                  {selectedSessionId !== "all" && selectedSession?.code
                    ? ` · ${selectedSession.code}`
                    : null}
                </p>
              }
              trailing={
                !isTaReadOnly ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setImportDialogOpen(true)}
                      className={facultyToolbarFilterButtonClass()}
                    >
                      <Upload className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      <span className="hidden sm:inline">Import</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleOpenDialog()}
                      className={cn("h-9 rounded-lg", fp?.cta)}
                    >
                      <Plus className="h-3.5 w-3.5 shrink-0" />
                      <span className="hidden sm:inline">Add</span>
                    </Button>
                    {selectedSessionId && selectedSessionId !== "all" && students.length > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowBulkDeleteDialog(true)}
                        className={cn(facultyToolbarFilterButtonClass(), "text-red-600 hover:text-red-700")}
                      >
                        <Trash className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        <span className="hidden sm:inline">Delete all</span>
                      </Button>
                    ) : null}
                  </>
                ) : null
              }
            />
          ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white/80 shadow-sm backdrop-blur-sm dark:border-white/[0.08] dark:bg-white/[0.02] sm:rounded-2xl">
            <div className="p-5 sm:p-6 md:p-7">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-5">
                <div className="min-w-0 w-full lg:w-auto lg:max-w-[220px]">
                  <Label htmlFor="session-filter" className="sr-only">Session</Label>
                  <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                    <SelectTrigger id="session-filter" className="h-10 w-full rounded-lg text-sm sm:rounded-xl lg:w-[200px]">
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
                {students.length > 0 && (
                  <div className="min-w-0 flex-1">
                    <Label htmlFor="search-students" className="sr-only">Search</Label>
                    <Input
                      id="search-students"
                      placeholder="Search by name, ID, email, or section..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-10 w-full rounded-lg text-sm sm:rounded-xl"
                    />
                  </div>
                )}
                {!isTaReadOnly && selectedSessionId && selectedSessionId !== "all" && students.length > 0 && (
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => setShowBulkDeleteDialog(true)}
                    className="h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl shrink-0"
                  >
                    <Trash className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                    Delete All
                  </Button>
                )}
              </div>
              {(searchQuery || (selectedSessionId && selectedSessionId !== "all")) && (
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  {searchQuery
                    ? `Found ${filteredStudents.length} matching "${searchQuery}"`
                    : `Showing ${filteredStudents.length} in ${selectedSession?.code}`}
                </p>
              )}
            </div>
          </div>
          )}

          {filteredStudents.length === 0 ? (
            <div className={embedPortal ? portalEmptyCard : "rounded-xl border border-slate-200/60 bg-white/80 p-8 text-center shadow-sm backdrop-blur-sm sm:rounded-2xl sm:p-10 md:p-12"}>
              <div className={cn("p-3 sm:p-4 rounded-xl sm:rounded-2xl w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 sm:mb-4 flex items-center justify-center", iconBg)}>
                <Users className={cn("h-8 w-8 sm:h-10 sm:w-10", iconText)} />
              </div>
              <p className={cn("text-xs sm:text-sm md:text-base mb-3 sm:mb-4 break-words px-2", embedPortal ? PORTAL_TEXT_MUTED : "text-slate-600")}>
                {searchQuery
                  ? `No students found matching "${searchQuery}".`
                  : selectedSessionId && selectedSessionId !== "all"
                    ? `No students found in session ${selectedSession?.code}.`
                    : "No students registered yet."}
              </p>
              {!searchQuery && !isTaReadOnly && (
                <Button 
                  onClick={() => handleOpenDialog()}
                  size="sm"
                  className={cn("rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0", ctaCls)}
                >
                  <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  <span className="sm:hidden">Add Student</span>
                  <span className="hidden sm:inline">Add Your First Student</span>
                </Button>
              )}
            </div>
          ) : viewMode === "card" ? (
            <>
            <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {paginatedStudents.map((student) => (
                <StudentManagementCard
                  key={student.id}
                  student={student}
                  onView={() => handleViewStudent(student)}
                  onEdit={() => handleOpenDialog(student)}
                  onReset={() => handleResetPasswordClick(student)}
                  onDelete={() => handleDeleteClick(student)}
                  readOnly={isTaReadOnly}
                  iconBg={iconBg}
                  iconText={iconText}
                  embedPortal={embedPortal}
                  viewCtaClass={ctaCls}
                />
              ))}
            </div>
            {totalStudentsPages > 1 && (
              <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Showing {(safePage - 1) * STUDENTS_PAGE_SIZE + 1}–{Math.min(safePage * STUDENTS_PAGE_SIZE, filteredStudents.length)} of {filteredStudents.length}
                </p>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          setStudentsPage((p) => Math.max(1, p - 1))
                        }}
                        className={safePage <= 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalStudentsPages }, (_, i) => i + 1)
                      .filter((p) => {
                        if (totalStudentsPages <= 7) return true
                        if (p === 1 || p === totalStudentsPages) return true
                        if (Math.abs(p - safePage) <= 1) return true
                        return false
                      })
                      .map((page, idx, arr) => (
                        <Fragment key={page}>
                          {idx > 0 && arr[idx - 1] !== page - 1 && (
                            <PaginationItem>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )}
                          <PaginationItem>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault()
                                setStudentsPage(page)
                              }}
                              isActive={safePage === page}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        </Fragment>
                      ))}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          setStudentsPage((p) => Math.min(totalStudentsPages, p + 1))
                        }}
                        className={safePage >= totalStudentsPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
            </>
          ) : (
            // List View - Compact table-like layout
            <>
            <div className="bg-white/80 dark:bg-white/[0.02] backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.08] rounded-xl sm:rounded-2xl shadow-sm overflow-hidden">
              {/* List Header */}
              <div className="bg-slate-50/80 dark:bg-white/5 border-b border-slate-200/60 dark:border-white/[0.08] px-3 sm:px-4 md:px-6 py-2 sm:py-3 hidden sm:grid grid-cols-12 gap-2 sm:gap-4 text-[10px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                <div className="col-span-4">Student</div>
                <div className="col-span-2">Section</div>
                <div className="col-span-2">Email</div>
                <div className="col-span-3">Registered</div>
                <div className="col-span-1 text-right">Actions</div>
              </div>

              {/* List Items */}
              <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {paginatedStudents.map((student, index) => (
                  <div 
                    key={student.id} 
                    className={cn("px-3 sm:px-4 md:px-6 py-3 sm:py-4 transition-all group", rowHover, index % 2 === 0 ? 'bg-white dark:bg-slate-950/40' : 'bg-slate-50/30 dark:bg-white/[0.02]')}
                  >
                    {/* Mobile Layout */}
                    <div className="sm:hidden space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className={cn("p-1.5 rounded-lg transition-all flex-shrink-0", iconBg, !fp && "group-hover:from-blue-500 group-hover:to-indigo-600")}>
                            <Users className={cn("h-3.5 w-3.5 transition-all", iconText, !fp && "group-hover:text-white")} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm text-slate-800 truncate break-words">{student.full_name}</p>
                            <p className="text-xs text-slate-500 truncate">{student.student_id}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Badge className={cn("rounded-lg px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap", badgeCls)}>
                            {student.section}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Mail className={cn("h-3.5 w-3.5 shrink-0", fp?.iconText ?? "text-indigo-500")} />
                          <span className="truncate">{student.email || "—"}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-blue-500" />
                          <span className="text-[10px]">
                            {student.created_at 
                              ? (() => {
                                  const date = new Date(student.created_at)
                                  return isNaN(date.getTime()) 
                                    ? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                })()
                              : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-slate-100">
                        <Button
                          size="sm"
                          onClick={() => handleViewStudent(student)}
                          className={cn("flex-1 h-9 min-h-[44px] text-xs rounded-lg", ctaCls)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1.5" />
                          Record
                        </Button>
                      </div>
                      {!isTaReadOnly && (
                      <div className="flex gap-2 pt-2 border-t border-slate-100">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenDialog(student)}
                          className="flex-1 h-9 min-h-[44px] text-xs rounded-lg"
                        >
                          <Edit className="h-3.5 w-3.5 mr-1.5" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResetPasswordClick(student)}
                          className="flex-1 h-9 min-h-[44px] text-xs rounded-lg text-orange-600"
                        >
                          <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                          Reset
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(student)}
                          className="flex-1 h-9 min-h-[44px] text-xs rounded-lg text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                          Delete
                        </Button>
                      </div>
                      )}
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden sm:grid grid-cols-12 gap-2 sm:gap-4 items-center">
                      {/* Student Info */}
                      <div className="col-span-4 flex items-center gap-2 sm:gap-3">
                        <div className={cn("p-1.5 sm:p-2 rounded-lg transition-all flex-shrink-0", iconBg, !fp && "group-hover:from-blue-500 group-hover:to-indigo-600")}>
                          <Users className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4 transition-all", iconText, !fp && "group-hover:text-white")} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-800 truncate text-xs sm:text-sm break-words">{student.full_name}</p>
                          <p className="text-[10px] sm:text-xs text-slate-500 truncate">{student.student_id}</p>
                        </div>
                      </div>

                      {/* Section & Session */}
                      <div className="col-span-2 flex gap-1 sm:gap-2">
                        <Badge className={cn("rounded-lg px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium whitespace-nowrap", badgeCls)}>
                          {student.section}
                        </Badge>
                        {student.session_code && student.session_code !== student.section && (
                          <Badge variant="outline" className={cn("rounded-lg px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium whitespace-nowrap", fp ? cn(fp.border, fp.iconText, fp.softBg) : "border-indigo-300 text-indigo-700 bg-indigo-50")}>
                            {student.session_code}
                          </Badge>
                        )}
                      </div>

                      {/* Email */}
                      <div className="col-span-2 min-w-0">
                        <div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm text-slate-600 min-w-0">
                          <Mail className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0", fp?.iconText ?? "text-indigo-500")} />
                          <span className="truncate">{student.email || "—"}</span>
                        </div>
                      </div>

                      {/* Registration Date */}
                      <div className="col-span-3">
                        <div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm text-slate-600">
                          <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500 flex-shrink-0" />
                          <span className="text-[10px] sm:text-xs break-words">
                          {student.created_at 
                            ? (() => {
                                const date = new Date(student.created_at)
                                return isNaN(date.getTime()) 
                                  ? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                  : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              })()
                            : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="col-span-1 flex items-center justify-end gap-0.5 sm:gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewStudent(student)}
                          className={cn("h-7 w-7 sm:h-8 sm:w-8 p-0 transition-all rounded-lg", fp ? "hover:bg-[var(--cc-accent-soft)] hover:text-[var(--cc-accent-dark)]" : "hover:bg-teal-100 hover:text-teal-700")}
                          title="View full record"
                        >
                          <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      {!isTaReadOnly && (
                        <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(student)}
                          className={cn("h-7 w-7 sm:h-8 sm:w-8 p-0 transition-all rounded-lg", fp ? "hover:bg-[var(--cc-accent-soft)] hover:text-[var(--cc-accent-dark)]" : "hover:bg-blue-100 hover:text-blue-600")}
                          title="Edit"
                        >
                          <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResetPasswordClick(student)}
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-orange-100 text-orange-600 hover:text-orange-700 transition-all rounded-lg"
                          title="Reset Password"
                        >
                          <KeyRound className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(student)}
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-red-100 text-red-600 hover:text-red-700 transition-all rounded-lg"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        </>
                      )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {totalStudentsPages > 1 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Showing {(safePage - 1) * STUDENTS_PAGE_SIZE + 1}–{Math.min(safePage * STUDENTS_PAGE_SIZE, filteredStudents.length)} of {filteredStudents.length}
                </p>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          setStudentsPage((p) => Math.max(1, p - 1))
                        }}
                        className={safePage <= 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalStudentsPages }, (_, i) => i + 1)
                      .filter((p) => {
                        if (totalStudentsPages <= 7) return true
                        if (p === 1 || p === totalStudentsPages) return true
                        if (Math.abs(p - safePage) <= 1) return true
                        return false
                      })
                      .map((page, idx, arr) => (
                        <Fragment key={page}>
                          {idx > 0 && arr[idx - 1] !== page - 1 && (
                            <PaginationItem>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )}
                          <PaginationItem>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault()
                                setStudentsPage(page)
                              }}
                              isActive={safePage === page}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        </Fragment>
                      ))}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          setStudentsPage((p) => Math.min(totalStudentsPages, p + 1))
                        }}
                        className={safePage >= totalStudentsPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
            </>
          )}
        </TabsContent>

        <TabsContent value="password-resets" className="space-y-3">
          {embedPortal ? (
            <FacultyIntegratedToolbar
              moduleId="student-mgmt"
              search={resetSearchQuery}
              onSearchChange={setResetSearchQuery}
              onSearchClear={() => setResetSearchQuery("")}
              searchPlaceholder="Search name, ID, email, guest…"
              filters={
                <>
                  <Select value={resetStatusFilter} onValueChange={setResetStatusFilter}>
                    <SelectTrigger
                      className={cn(
                        facultyToolbarFilterButtonClass(resetStatusFilter !== "all"),
                        "h-9 min-w-[9rem] shadow-none",
                      )}
                    >
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={resetSortOrder} onValueChange={(v) => setResetSortOrder(v as "newest" | "oldest")}>
                    <SelectTrigger className={cn(facultyToolbarFilterButtonClass(), "h-9 min-w-[9rem] shadow-none")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest first</SelectItem>
                      <SelectItem value="oldest">Oldest first</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              }
              viewMode={resetViewMode === "grid" ? "grid" : "list"}
              onViewModeChange={(mode) => setResetViewMode(mode === "grid" ? "grid" : "list")}
              meta={
                !loadingRequests ? (
                  <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                    Password resets · {filteredResetRequests.length} request
                    {filteredResetRequests.length === 1 ? "" : "s"}
                    {resetStatusFilter !== "all" ? ` · ${resetStatusFilter}` : ""}
                  </p>
                ) : null
              }
            />
          ) : (
            !loadingRequests &&
            resetRequests.length > 0 && (
              <div className="bg-white/80 dark:bg-white/[0.02] backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.08] rounded-xl sm:rounded-2xl shadow-sm overflow-hidden">
                <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:flex-wrap sm:p-6">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
                    <Select value={resetStatusFilter} onValueChange={setResetStatusFilter}>
                      <SelectTrigger className="h-9 w-[140px] sm:w-[160px] text-xs sm:text-sm rounded-lg">
                        <Filter className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={resetSortOrder} onValueChange={(v) => setResetSortOrder(v as "newest" | "oldest")}>
                      <SelectTrigger className="h-9 w-[130px] sm:w-[150px] text-xs sm:text-sm rounded-lg">
                        <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest first</SelectItem>
                        <SelectItem value="oldest">Oldest first</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="relative flex-1 min-w-[140px] sm:min-w-[180px] max-w-[240px]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Search name, ID, email, guest…"
                        value={resetSearchQuery}
                        onChange={(e) => setResetSearchQuery(e.target.value)}
                        className="h-9 pl-8 text-xs sm:text-sm rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 p-1 rounded-lg shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setResetViewMode("grid")}
                      className={cn(
                        "rounded-md h-8 w-8 p-0",
                        resetViewMode === "grid" ? cn("bg-teal-500/20", iconText) : "hover:bg-white/50 dark:hover:bg-white/5",
                      )}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setResetViewMode("list")}
                      className={cn(
                        "rounded-md h-8 w-8 p-0",
                        resetViewMode === "list" ? cn("bg-teal-500/20", iconText) : "hover:bg-white/50 dark:hover:bg-white/5",
                      )}
                    >
                      <List className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {(resetStatusFilter !== "all" || resetSearchQuery) && (
                  <div className="px-5 pb-4 text-xs text-slate-500 dark:text-slate-400 sm:px-6">
                    Showing {filteredResetRequests.length} of {resetRequests.length} requests
                  </div>
                )}
              </div>
            )
          )}

          {loadingRequests ? (
            <div className="flex items-center justify-center py-12 sm:py-16">
              <div className="flex flex-col items-center gap-3">
                <div className={cn("h-8 w-8", spinnerClass)} aria-hidden />
                <p className={cn("text-xs sm:text-sm", embedPortal ? PORTAL_TEXT_MUTED : "text-slate-500 dark:text-slate-400")}>
                  Loading reset requests…
                </p>
              </div>
            </div>
          ) : resetRequests.length === 0 ? (
            <div className={embedPortal ? portalEmptyCard : "bg-white/80 dark:bg-white/[0.02] backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.08] rounded-xl sm:rounded-2xl shadow-sm p-8 sm:p-12 md:p-16 text-center"}>
              <div className={cn("p-4 rounded-2xl w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 flex items-center justify-center", embedPortal ? iconBg : "bg-slate-100/80 dark:bg-white/5")}>
                <KeyRound className={cn("h-8 w-8 sm:h-10 sm:w-10", embedPortal ? iconText : "text-slate-400 dark:text-slate-500")} />
              </div>
              <p className={cn("text-sm sm:text-base font-medium mb-1", embedPortal ? PORTAL_TEXT : "text-slate-600 dark:text-slate-400")}>
                No password reset requests
              </p>
              <p className={cn("text-xs sm:text-sm", embedPortal ? PORTAL_TEXT_MUTED : "text-slate-500 dark:text-slate-500")}>
                Requests will appear here when students request a password reset.
              </p>
            </div>
          ) : filteredResetRequests.length === 0 ? (
            <div className={embedPortal ? portalEmptyCard : "bg-white/80 dark:bg-white/[0.02] backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.08] rounded-xl sm:rounded-2xl shadow-sm p-8 text-center"}>
              <p className={cn("text-sm", embedPortal ? PORTAL_TEXT_MUTED : "text-slate-600 dark:text-slate-400")}>
                No requests match your filters.
              </p>
              <Button
                variant="outline"
                size="sm"
                className={cn("mt-3", embedPortal && facultyToolbarFilterButtonClass())}
                onClick={() => {
                  setResetStatusFilter("all")
                  setResetSearchQuery("")
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : resetViewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {filteredResetRequests.map((request) => (
                <div
                  key={request.id}
                  className={cn(
                    "group flex flex-col overflow-hidden",
                    embedPortal
                      ? portalItemCard
                      : "rounded-2xl border border-slate-200/70 bg-white/90 shadow-sm transition-all hover:border-teal-300/60 hover:shadow-md dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-teal-500/30",
                  )}
                >
                  <div className="space-y-4 p-5 sm:p-6">
                    <div className="mb-3 flex items-start gap-3">
                      <div
                        className={cn(
                          "shrink-0 rounded-xl p-2.5",
                          request.status === "pending"
                            ? "bg-amber-500/10 dark:bg-amber-500/20"
                            : request.status === "approved" || request.status === "completed"
                              ? "bg-emerald-500/10 dark:bg-emerald-500/20"
                              : embedPortal
                                ? cn(iconBg)
                                : "bg-slate-100/80 dark:bg-white/5",
                        )}
                      >
                        <KeyRound
                          className={cn(
                            "h-5 w-5 shrink-0",
                            request.status === "pending"
                              ? "text-amber-600 dark:text-amber-400"
                              : request.status === "approved" || request.status === "completed"
                                ? iconText
                                : embedPortal
                                  ? PORTAL_TEXT_MUTED
                                  : "text-slate-500 dark:text-slate-400",
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3
                          className={cn(
                            "text-sm sm:text-base font-semibold truncate flex items-center gap-2 flex-wrap",
                            embedPortal ? PORTAL_TEXT : "text-slate-800 dark:text-slate-100",
                          )}
                        >
                          <span className="truncate">{request.full_name}</span>
                          {request.is_platform_guest ? (
                            <Badge variant="secondary" className="shrink-0 text-[10px] font-semibold">
                              Guest
                            </Badge>
                          ) : null}
                        </h3>
                        <p className={cn("text-xs mt-0.5 truncate", embedPortal ? PORTAL_TEXT_MUTED : "text-slate-500 dark:text-slate-400")}>
                          {request.student_number} · {request.section}
                        </p>
                        <div className="mt-2">{getStatusBadge(request.status)}</div>
                      </div>
                    </div>
                    <div className={cn("space-y-1.5 text-xs sm:text-sm", embedPortal ? PORTAL_TEXT_MUTED : "text-slate-600 dark:text-slate-400")}>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        {new Date(request.requested_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      {request.reviewed_at && (
                        <div className="text-slate-500 dark:text-slate-500">
                          Reviewed {new Date(request.reviewed_at).toLocaleDateString()}
                        </div>
                      )}
                      {request.admin_notes && (
                        <div className="mt-2 p-2.5 bg-slate-50 dark:bg-white/5 rounded-lg text-xs border border-slate-100 dark:border-white/5">
                          <span className="font-medium text-slate-700 dark:text-slate-300">Notes:</span>{" "}
                          <span className="break-words">{request.admin_notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {request.status === "pending" && (
                    <div className={cn("border-t px-5 py-4 sm:px-6", embedPortal ? "border-[var(--border)]" : "border-slate-100 dark:border-white/[0.06]")}>
                      <Button
                        size="sm"
                        className={cn("h-9 w-full rounded-lg text-xs sm:text-sm", portalCta)}
                        onClick={() => handleReviewRequest(request)}
                      >
                        <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-2 shrink-0" />
                        Review & Approve
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            ) : (
            <div className={embedPortal ? portalListShell : "bg-white/80 dark:bg-white/[0.02] backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.08] rounded-xl sm:rounded-2xl shadow-sm overflow-hidden divide-y divide-slate-200/60 dark:divide-white/[0.08]"}>
              {filteredResetRequests.map((request) => (
                <div
                  key={request.id}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 sm:p-5 transition-colors",
                    embedPortal ? rowHover : "hover:bg-slate-50/50 dark:hover:bg-white/[0.02]",
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      request.status === "pending" ? "bg-amber-500/10" : "bg-slate-100/80 dark:bg-white/5"
                    }`}>
                      <KeyRound className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate flex items-center gap-2 flex-wrap">
                        <span className="truncate">{request.full_name}</span>
                        {request.is_platform_guest ? (
                          <Badge variant="secondary" className="shrink-0 text-[10px] font-semibold">
                            Guest
                          </Badge>
                        ) : null}
                      </h3>
                      <p className="text-xs text-slate-500 truncate">{request.student_number} · {request.section}</p>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0">
                    <span>{new Date(request.requested_at).toLocaleDateString()}</span>
                    {request.status === "pending" && (
                      <Button size="sm" className={cn("h-8", portalCta)} onClick={() => handleReviewRequest(request)}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                        Review
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Account Requests Tab */}
        <TabsContent value="account-requests" className="space-y-3">
          {embedPortal ? (
            <FacultyIntegratedToolbar
              moduleId="student-mgmt"
              search={accountSearchQuery}
              onSearchChange={setAccountSearchQuery}
              onSearchClear={() => setAccountSearchQuery("")}
              searchPlaceholder="Search name, ID, email, guest…"
              filters={
                <>
                  <Select value={accountStatusFilter} onValueChange={setAccountStatusFilter}>
                    <SelectTrigger
                      className={cn(
                        facultyToolbarFilterButtonClass(accountStatusFilter !== "all"),
                        "h-9 min-w-[9rem] shadow-none",
                      )}
                    >
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={accountSortOrder} onValueChange={(v) => setAccountSortOrder(v as "newest" | "oldest")}>
                    <SelectTrigger className={cn(facultyToolbarFilterButtonClass(), "h-9 min-w-[9rem] shadow-none")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest first</SelectItem>
                      <SelectItem value="oldest">Oldest first</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              }
              viewMode={accountViewMode === "grid" ? "grid" : "list"}
              onViewModeChange={(mode) => setAccountViewMode(mode === "grid" ? "grid" : "list")}
              meta={
                !loadingAccountRequests ? (
                  <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                    Account requests · {filteredAccountRequests.length} request
                    {filteredAccountRequests.length === 1 ? "" : "s"}
                    {accountStatusFilter !== "all" ? ` · ${accountStatusFilter}` : ""}
                  </p>
                ) : null
              }
            />
          ) : (
            !loadingAccountRequests &&
            accountRequests.length > 0 && (
              <div className="bg-white/80 dark:bg-white/[0.02] backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.08] rounded-xl sm:rounded-2xl shadow-sm overflow-hidden">
                <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:flex-wrap sm:p-6">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
                    <Select value={accountStatusFilter} onValueChange={setAccountStatusFilter}>
                      <SelectTrigger className="h-9 w-[140px] sm:w-[160px] text-xs sm:text-sm rounded-lg">
                        <Filter className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={accountSortOrder} onValueChange={(v) => setAccountSortOrder(v as "newest" | "oldest")}>
                      <SelectTrigger className="h-9 w-[130px] sm:w-[150px] text-xs sm:text-sm rounded-lg">
                        <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest first</SelectItem>
                        <SelectItem value="oldest">Oldest first</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="relative flex-1 min-w-[140px] sm:min-w-[180px] max-w-[240px]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Search name, ID, email..."
                        value={accountSearchQuery}
                        onChange={(e) => setAccountSearchQuery(e.target.value)}
                        className="h-9 pl-8 text-xs sm:text-sm rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 p-1 rounded-lg shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAccountViewMode("grid")}
                      className={cn(
                        "rounded-md h-8 w-8 p-0",
                        accountViewMode === "grid" ? cn("bg-teal-500/20", iconText) : "hover:bg-white/50 dark:hover:bg-white/5",
                      )}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAccountViewMode("list")}
                      className={cn(
                        "rounded-md h-8 w-8 p-0",
                        accountViewMode === "list" ? cn("bg-teal-500/20", iconText) : "hover:bg-white/50 dark:hover:bg-white/5",
                      )}
                    >
                      <List className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {(accountStatusFilter !== "all" || accountSearchQuery) && (
                  <div className="px-5 pb-4 text-xs text-slate-500 dark:text-slate-400 sm:px-6">
                    Showing {filteredAccountRequests.length} of {accountRequests.length} requests
                  </div>
                )}
              </div>
            )
          )}

          {loadingAccountRequests ? (
            <div className="flex items-center justify-center py-12 sm:py-16">
              <div className="flex flex-col items-center gap-3">
                <div className={cn("h-8 w-8", spinnerClass)} aria-hidden />
                <p className={cn("text-xs sm:text-sm", embedPortal ? PORTAL_TEXT_MUTED : "text-slate-500 dark:text-slate-400")}>
                  Loading account requests…
                </p>
              </div>
            </div>
          ) : accountRequests.length === 0 ? (
            <div className={embedPortal ? portalEmptyCard : "bg-white/80 dark:bg-white/[0.02] backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.08] rounded-xl sm:rounded-2xl shadow-sm p-8 sm:p-12 md:p-16 text-center"}>
              <div className={cn("p-4 rounded-2xl w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 flex items-center justify-center", embedPortal ? iconBg : "bg-slate-100/80 dark:bg-white/5")}>
                <UserPlus className={cn("h-8 w-8 sm:h-10 sm:w-10", embedPortal ? iconText : "text-slate-400 dark:text-slate-500")} />
              </div>
              <p className={cn("text-sm sm:text-base font-medium mb-1", embedPortal ? PORTAL_TEXT : "text-slate-600 dark:text-slate-400")}>
                No account requests
              </p>
              <p className={cn("text-xs sm:text-sm", embedPortal ? PORTAL_TEXT_MUTED : "text-slate-500 dark:text-slate-500")}>
                New student account requests will appear here for approval.
              </p>
            </div>
          ) : filteredAccountRequests.length === 0 ? (
            <div className={embedPortal ? portalEmptyCard : "bg-white/80 dark:bg-white/[0.02] backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.08] rounded-xl sm:rounded-2xl shadow-sm p-8 text-center"}>
              <p className={cn("text-sm", embedPortal ? PORTAL_TEXT_MUTED : "text-slate-600 dark:text-slate-400")}>
                No requests match your filters.
              </p>
              <Button
                variant="outline"
                size="sm"
                className={cn("mt-3", embedPortal && facultyToolbarFilterButtonClass())}
                onClick={() => {
                  setAccountStatusFilter("all")
                  setAccountSearchQuery("")
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : accountViewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {filteredAccountRequests.map((request: any) => (
                <div
                  key={request.id}
                  className={cn(
                    "group flex flex-col overflow-hidden",
                    embedPortal
                      ? portalItemCard
                      : "rounded-2xl border border-slate-200/70 bg-white/90 shadow-sm transition-all hover:border-teal-300/60 hover:shadow-md dark:border-white/[0.08] dark:bg-white/[0.02] dark:hover:border-teal-500/30",
                  )}
                >
                  <div className="space-y-4 p-5 sm:p-6">
                    <div className="mb-3 flex items-start gap-3">
                      <div
                        className={cn(
                          "shrink-0 rounded-xl p-2.5",
                          request.status === "pending"
                            ? iconBg
                            : request.status === "approved"
                              ? "bg-emerald-500/10 dark:bg-emerald-500/20"
                              : embedPortal
                                ? "bg-[var(--muted)]/50"
                                : "bg-slate-100/80 dark:bg-white/5",
                        )}
                      >
                        <UserPlus
                          className={cn(
                            "h-5 w-5 shrink-0",
                            request.status === "pending" || request.status === "approved"
                              ? iconText
                              : embedPortal
                                ? PORTAL_TEXT_MUTED
                                : "text-slate-500 dark:text-slate-400",
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={cn("text-sm sm:text-base font-semibold truncate", embedPortal ? PORTAL_TEXT : "text-slate-800 dark:text-slate-100")}>
                          {request.full_name}
                        </h3>
                        {request.request_kind === "guest" && (
                          <p className={cn("text-[10px] font-semibold uppercase tracking-wide mt-0.5", iconText)}>
                            Career Member
                          </p>
                        )}
                        <p className={cn("text-xs mt-0.5 truncate", embedPortal ? PORTAL_TEXT_MUTED : "text-slate-500 dark:text-slate-400")}>
                          {request.student_id} · {request.section}
                        </p>
                        {request.request_kind === "guest" && request.organization && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5" title={request.organization}>
                            {request.organization}
                          </p>
                        )}
                        {request.email && (
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-600 dark:text-slate-400 truncate">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{request.email}</span>
                          </div>
                        )}
                        <div className="mt-2">{getStatusBadge(request.status)}</div>
                      </div>
                    </div>
                    <div className={cn("space-y-1.5 text-xs sm:text-sm", embedPortal ? PORTAL_TEXT_MUTED : "text-slate-600 dark:text-slate-400")}>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        {new Date(request.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      {request.approved_at && (
                        <div className={cn("flex items-center gap-2", iconText)}>
                          <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                          Approved {new Date(request.approved_at).toLocaleDateString()}
                        </div>
                      )}
                      {request.rejected_at && (
                        <div className="mt-2 p-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200/60 dark:border-red-500/30">
                          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-medium mb-1">
                            <XCircle className="h-3.5 w-3.5 shrink-0" />
                            Rejected {new Date(request.rejected_at).toLocaleDateString()}
                          </div>
                          {request.rejection_reason && (
                            <p className="text-xs text-red-700 dark:text-red-300 break-words">{request.rejection_reason}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {request.status === "pending" && (
                    <div className={cn("flex gap-2 border-t px-5 py-4 sm:px-6", embedPortal ? "border-[var(--border)]" : "border-slate-100 dark:border-white/[0.06]")}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-9 rounded-lg border-red-200 text-xs text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10 sm:text-sm"
                        onClick={() => {
                          setSelectedAccountRequest(request)
                          setAccountReviewDialogOpen(true)
                        }}
                      >
                        <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 shrink-0" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className={cn("flex-1 h-9 rounded-lg text-xs sm:text-sm", portalCta)}
                        onClick={() => {
                          setSelectedAccountRequest(request)
                          setAccountReviewDialogOpen(true)
                        }}
                      >
                        <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 shrink-0" />
                        Approve
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className={embedPortal ? portalListShell : "bg-white/80 dark:bg-white/[0.02] backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.08] rounded-xl sm:rounded-2xl shadow-sm overflow-hidden divide-y divide-slate-200/60 dark:divide-white/[0.08]"}>
              {filteredAccountRequests.map((request: any) => (
                <div
                  key={request.id}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 sm:p-5 transition-colors",
                    embedPortal ? rowHover : "hover:bg-slate-50/50 dark:hover:bg-white/[0.02]",
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      request.status === "pending" ? "bg-teal-500/10" : "bg-slate-100/80 dark:bg-white/5"
                    }`}>
                      <UserPlus className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate">{request.full_name}</h3>
                      {request.request_kind === "guest" && (
                        <p className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 mt-0.5 uppercase tracking-wide">
                          Guest
                        </p>
                      )}
                      <p className="text-xs text-slate-500 truncate">
                        {request.student_id} · {request.section}
                      </p>
                      {request.email && <p className="text-xs text-slate-500 truncate">{request.email}</p>}
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0">
                    <span>{new Date(request.created_at).toLocaleDateString()}</span>
                    {request.status === "pending" && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="h-8 text-red-600 border-red-200" onClick={() => { setSelectedAccountRequest(request); setAccountReviewDialogOpen(true); }}>
                          Reject
                        </Button>
                        <Button size="sm" className={cn("h-8", portalCta)} onClick={() => { setSelectedAccountRequest(request); setAccountReviewDialogOpen(true); }}>
                          Approve
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      </DirectoryShell>

      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent className="rounded-xl sm:rounded-2xl max-w-[95vw] sm:max-w-lg">
          <AlertDialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-destructive/10 shrink-0">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
              </div>
              <AlertDialogTitle className="text-base sm:text-lg md:text-xl break-words">Delete All Students in Session?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs sm:text-sm md:text-base leading-relaxed break-words">
              Are you sure you want to delete all{" "}
              <span className="font-semibold text-foreground">{students.length} student(s)</span> in session{" "}
              <span className="font-semibold text-foreground">{selectedSession?.code}</span>?
              <br />
              <br />
              This will permanently delete all their quiz attempts and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="p-4 sm:p-6 pt-3 sm:pt-4 flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={bulkDeleting} className="w-full sm:w-auto rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-destructive hover:bg-destructive/90 w-full sm:w-auto rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0"
            >
              {bulkDeleting ? "Deleting..." : "Delete All Students"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Dialog */}
      <Dialog
        open={importDialogOpen}
        onOpenChange={(open) => {
          if (open) setImportDialogOpen(true)
          else handleCloseImportDialog()
        }}
      >
        <DialogContent className="!flex max-h-[90dvh] w-full max-w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl rounded-xl sm:rounded-2xl">
          <DialogHeader className="shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3">
            <DialogTitle className="text-base sm:text-lg md:text-xl break-words">Import students from Canvas</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm break-words">
              {importStep === "upload" && "Upload the Canvas analytics zip or the CSV inside it. Cora maps the columns."}
              {importStep === "mapping" && "Confirm term, session, and column mapping. Cora’s picks can be changed."}
              {importStep === "preview" && "Review the data before importing."}
              {importStep === "summary" && "Import complete!"}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">

          {/* Upload Step */}
          {importStep === "upload" && (
            <div className="space-y-3 sm:space-y-4 py-3 sm:py-4 px-4 sm:px-6">
              <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                <li>In Canvas, open the course → <span className="font-medium text-foreground">Course Analytics</span> → <span className="font-medium text-foreground">Students</span>.</li>
                <li>Click <span className="font-medium text-foreground">Download CSV</span> (Canvas gives you a zip).</li>
                <li>Upload that zip here — or the CSV if you already extracted it.</li>
              </ol>
              <input
                ref={rosterFileRef}
                id="csv-upload"
                type="file"
                accept=".csv,.zip,application/zip,text/csv"
                onChange={(e) => void handleFileUpload(e)}
                className="sr-only"
                tabIndex={-1}
                disabled={mappingBusy}
              />
              <div
                role="button"
                tabIndex={mappingBusy ? -1 : 0}
                aria-label="Upload Canvas zip or CSV"
                onClick={() => {
                  if (!mappingBusy) rosterFileRef.current?.click()
                }}
                onKeyDown={(e) => {
                  if (mappingBusy) return
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    rosterFileRef.current?.click()
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (!mappingBusy) setRosterDrag(true)
                }}
                onDragLeave={() => setRosterDrag(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setRosterDrag(false)
                  const file = e.dataTransfer.files[0]
                  if (file && !mappingBusy) void processRosterFile(file)
                }}
                className={cn(
                  "flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center transition-colors",
                  rosterDrag
                    ? "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)]/40"
                    : "border-[var(--border)] bg-[var(--muted)]/20",
                  mappingBusy && "pointer-events-none opacity-70",
                )}
              >
                {mappingBusy ? (
                  <Loader2 className="mb-2 h-8 w-8 animate-spin text-[var(--cc-accent)]" />
                ) : (
                  <FileUp className="mb-2 h-8 w-8 text-[var(--cc-text-muted)]" />
                )}
                <p className={cn("text-sm font-medium", PORTAL_TEXT)}>
                  {mappingBusy ? "Cora is reading columns…" : "Drop a Canvas zip or CSV here"}
                </p>
                <p className={cn("mt-1 max-w-sm text-xs", PORTAL_TEXT_MUTED)}>
                  Course Analytics → Students → Download CSV. Zip or extracted CSV both work.
                </p>
                <Button
                  type="button"
                  className={cn("mt-4 rounded-lg", PORTAL_CTA)}
                  disabled={mappingBusy}
                  onClick={(e) => {
                    e.stopPropagation()
                    rosterFileRef.current?.click()
                  }}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Choose file
                </Button>
              </div>
              {csvFile && <div className="text-xs sm:text-sm text-muted-foreground text-center break-words">Selected: {csvFile.name}</div>}
            </div>
          )}

          {/* Mapping Step */}
          {importStep === "mapping" && (
            <div className="space-y-3 sm:space-y-4 py-3 sm:py-4 px-4 sm:px-6">
              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm break-words">Academic Term *</Label>
                <Select 
                  value={importAcademicTermId?.toString() || ""} 
                  onValueChange={(value) => {
                    const termId = parseInt(value)
                    setImportAcademicTermId(termId)
                    fetchSessionsForTerm(termId)
                    setImportSessionId(null)
                    setImportSection("")
                  }}
                >
                  <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl">
                    <SelectValue placeholder="Select academic term" />
                  </SelectTrigger>
                  <SelectContent>
                    {academicTerms.map((term) => (
                      <SelectItem key={term.id} value={term.id.toString()}>
                        {term.term} {term.year} {term.is_active && "(Active)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] sm:text-xs text-muted-foreground break-words">Select the academic term for these students.</p>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label className="text-xs sm:text-sm break-words">Session *</Label>
                <Select 
                  value={importSessionId?.toString() || ""} 
                  onValueChange={(value) => {
                    const sessionId = parseInt(value)
                    setImportSessionId(sessionId)
                    const selectedSession = sessionsByTerm[importAcademicTermId || 0]?.find(s => s.id === sessionId)
                    if (selectedSession) {
                      setImportSection(selectedSession.code)
                    }
                  }}
                  disabled={!importAcademicTermId || !sessionsByTerm[importAcademicTermId || 0]?.length}
                >
                  <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl">
                    <SelectValue placeholder={!importAcademicTermId ? "Select academic term first" : "Select session"} />
                  </SelectTrigger>
                  <SelectContent>
                    {importAcademicTermId && sessionsByTerm[importAcademicTermId]?.map((session) => (
                      <SelectItem key={session.id} value={session.id.toString()}>
                        {session.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] sm:text-xs text-muted-foreground break-words">All imported students will be assigned to this session.</p>
              </div>

              <div className="space-y-3 sm:space-y-4 border rounded-lg sm:rounded-xl p-3 sm:p-4">
                <h4 className="font-semibold text-xs sm:text-sm break-words">Column Mapping</h4>
                {coraMapNotes ? (
                  <p className="flex items-start gap-2 text-[10px] sm:text-xs text-muted-foreground">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--cc-accent)]" />
                    {coraMapNotes}
                  </p>
                ) : null}
                <div className="space-y-2 sm:space-y-3">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm break-words">Student ID (optional if Email is mapped)</Label>
                    <Select
                      value={columnMapping.student_id || "__none__"}
                      onValueChange={(value) =>
                        setColumnMapping({ ...columnMapping, student_id: value === "__none__" ? "" : value })
                      }
                    >
                      <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl">
                        <SelectValue placeholder="Select column for Student ID" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None — use email</SelectItem>
                        {csvHeaders.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm break-words">Full Name</Label>
                    <Select
                      value={columnMapping.full_name}
                      onValueChange={(value) => setColumnMapping({ ...columnMapping, full_name: value })}
                    >
                      <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl">
                        <SelectValue placeholder="Select column for Full Name" />
                      </SelectTrigger>
                      <SelectContent>
                        {csvHeaders.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <p className="text-[10px] sm:text-xs text-muted-foreground pt-1">
                    Canvas Analytics exports usually have a name column and Email — Student ID is optional. Re-imports match by Canvas ID, SIS IDs, then email in this session. Map Email when you want to sync it; leave it unmapped to keep existing Gmail addresses.
                  </p>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm break-words">SIS User ID (optional)</Label>
                    <Select
                      value={columnMapping.sis_user_id || "__none__"}
                      onValueChange={(value) =>
                        setColumnMapping({ ...columnMapping, sis_user_id: value === "__none__" ? "" : value })
                      }
                    >
                      <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {csvHeaders.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm break-words">SIS Login ID (optional)</Label>
                    <Select
                      value={columnMapping.sis_login_id || "__none__"}
                      onValueChange={(value) =>
                        setColumnMapping({ ...columnMapping, sis_login_id: value === "__none__" ? "" : value })
                      }
                    >
                      <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {csvHeaders.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm break-words">Canvas section string (optional)</Label>
                    <Select
                      value={columnMapping.canvas_section || "__none__"}
                      onValueChange={(value) =>
                        setColumnMapping({ ...columnMapping, canvas_section: value === "__none__" ? "" : value })
                      }
                    >
                      <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {csvHeaders.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm break-words">Email (optional)</Label>
                    <Select
                      value={columnMapping.email || "__none__"}
                      onValueChange={(value) =>
                        setColumnMapping({ ...columnMapping, email: value === "__none__" ? "" : value })
                      }
                    >
                      <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {csvHeaders.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="text-[10px] sm:text-xs text-muted-foreground break-words">Found {csvRows.length} rows in the CSV file.</div>
            </div>
          )}

          {/* Preview Step */}
          {importStep === "preview" && (
            <div className="space-y-3 sm:space-y-4 py-3 sm:py-4 px-4 sm:px-6">
              <div className="space-y-1.5 sm:space-y-2">
                <h4 className="font-semibold text-xs sm:text-sm break-words">Import Preview</h4>
                <p className="text-[10px] sm:text-xs text-muted-foreground break-words">
                  {importAcademicTermId && (
                    <>
                      Term: <span className="font-medium">
                        {academicTerms.find(t => t.id === importAcademicTermId)?.term} {academicTerms.find(t => t.id === importAcademicTermId)?.year}
                      </span> | 
                    </>
                  )}
                  Session: <span className="font-medium">{importSection || "Not selected"}</span> | Total rows:{" "}
                  <span className="font-medium">{csvRows.length}</span>
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground bg-primary/10 p-2 rounded-lg break-words">
                  All {csvRows.length} students will be imported in one request.
                </p>
              </div>

              <div className="border rounded-lg sm:rounded-xl overflow-hidden">
                <div className="max-h-64 sm:max-h-96 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-[10px] sm:text-xs md:text-sm min-w-[300px]">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-1.5 sm:p-2 font-medium">Student ID</th>
                        <th className="text-left p-1.5 sm:p-2 font-medium">Full Name</th>
                        <th className="text-left p-1.5 sm:p-2 font-medium">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applyRosterColumnMapping(csvRows, columnMapping).slice(0, 50).map((row, index) => (
                        <tr key={index} className="border-t">
                          <td className="p-1.5 sm:p-2 break-words">{row.student_id}</td>
                          <td className="p-1.5 sm:p-2 break-words">{row.full_name}</td>
                          <td className="p-1.5 sm:p-2 break-words">{row.email || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {csvRows.length > 50 && (
                <p className="text-[10px] sm:text-xs text-muted-foreground text-center break-words">
                  Showing first 50 rows. All {csvRows.length} rows will be imported.
                </p>
              )}
              {applyRosterColumnMapping(csvRows, columnMapping).length === 0 && (
                <p className="text-[10px] sm:text-xs text-destructive text-center break-words">
                  No rows mapped. Map Full Name and Email (or Student ID), then go back.
                </p>
              )}
            </div>
          )}

          {/* Summary Step */}
          {importStep === "summary" && importSummary && (
            <div className="space-y-3 sm:space-y-4 py-3 sm:py-4 px-4 sm:px-6">
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-success/10 rounded-lg sm:rounded-xl">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs sm:text-sm text-success break-words">{importSummary.added} students added</div>
                  </div>
                </div>

                {importSummary.updated > 0 && (
                  <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-primary/10 rounded-lg sm:rounded-xl">
                    <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs sm:text-sm text-primary break-words">{importSummary.updated} students updated</div>
                    </div>
                  </div>
                )}

                {importSummary.skipped > 0 && (
                  <div className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 bg-destructive/10 rounded-lg sm:rounded-xl">
                    <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs sm:text-sm text-destructive break-words">{importSummary.skipped} rows skipped</div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground break-words">
                        Rows skipped (missing ID/name, or duplicate key conflict). Check server logs for details.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          </div>

          <DialogFooter className="shrink-0 border-t border-[var(--border)] p-4 sm:p-6 pt-3 sm:pt-4 flex-col sm:flex-row gap-2">
            {importStep === "upload" && (
              <Button variant="outline" size="sm" onClick={handleCloseImportDialog} className="w-full sm:w-auto rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0">
                Cancel
              </Button>
            )}

            {importStep === "mapping" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImportStep("upload")
                    setCsvFile(null)
                    setCsvHeaders([])
                    setCsvRows([])
                  }}
                  className="w-full sm:w-auto rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0"
                >
                  Back
                </Button>
                <Button size="sm" onClick={handlePreview} disabled={!isMappingValid()} className="w-full sm:w-auto rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0">
                  Preview Data
                </Button>
              </>
            )}

            {importStep === "preview" && (
              <>
                <Button variant="outline" size="sm" onClick={() => setImportStep("mapping")} disabled={importing} className="w-full sm:w-auto rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0">
                  Back
                </Button>
                <Button size="sm" onClick={handleImport} disabled={importing} className="bg-accent hover:bg-accent/90 w-full sm:w-auto rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0">
                  {importing
                    ? importProgress
                      ? `Importing... ${importProgress.current}/${importProgress.total}`
                      : "Importing..."
                    : "Import Students"}
                </Button>
              </>
            )}

            {importStep === "summary" && (
              <Button size="sm" onClick={handleCloseImportDialog} className="bg-accent hover:bg-accent/90 w-full sm:w-auto rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0">
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-xl sm:rounded-2xl max-w-[95vw] sm:max-w-lg">
          <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
            <DialogTitle className="text-base sm:text-lg md:text-xl break-words">{editingStudent ? "Edit Student" : "Add New Student"}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm break-words">
              {editingStudent
                ? "Update the student information below."
                : "Enter the student information to create a new account."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-3 sm:space-y-4 py-3 sm:py-4 px-4 sm:px-6">
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="student_id" className="text-xs sm:text-sm break-words">Student ID</Label>
                <Input
                  id="student_id"
                  placeholder="e.g., 12345678"
                  value={formData.student_id}
                  onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                  required
                  className="h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl"
                />
              </div>
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="full_name" className="text-xs sm:text-sm break-words">Full Name</Label>
                <Input
                  id="full_name"
                  placeholder="e.g., John Doe"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  className="h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl"
                />
              </div>
              {userType === "admin" ? (
                <>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm break-words">Course *</Label>
                    <Select
                      value={formData.course_id || ""}
                      onValueChange={(value) =>
                        setFormData({ ...formData, course_id: value, session_id: "none", section: "" })
                      }
                    >
                      <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl">
                        <SelectValue placeholder="Select course" />
                      </SelectTrigger>
                      <SelectContent>
                        {adminCourses.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.course_code} — {c.course_title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm break-words">Section (optional)</Label>
                    <Select
                      value={formData.session_id || "none"}
                      onValueChange={(value) => {
                        const sess = adminCourseSessions.find((s) => String(s.id) === value)
                        setFormData({
                          ...formData,
                          session_id: value,
                          section: sess?.code ?? formData.section,
                        })
                      }}
                    >
                      <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl">
                        <SelectValue placeholder="No section (course only)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No section — course enrollment only</SelectItem>
                        {adminCourseSessions.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.code}
                            {s.description ? ` — ${s.description}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="section" className="text-xs sm:text-sm break-words">Section</Label>
                  <Select
                    value={formData.section || defaultCode || ""}
                    onValueChange={(value) => setFormData({ ...formData, section: value })}
                  >
                    <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {selectOptions.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {formError && <p className="text-xs sm:text-sm text-red-500 break-words">{formError}</p>}
            </div>
            <DialogFooter className="p-4 sm:p-6 pt-3 sm:pt-4 flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleCloseDialog} disabled={submitting} className="w-full sm:w-auto rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0">
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-accent hover:bg-accent/90 w-full sm:w-auto rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0" disabled={submitting}>
                {submitting ? "Saving..." : editingStudent ? "Update Student" : "Add Student"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <AlertDialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <AlertDialogContent className="rounded-xl sm:rounded-2xl max-w-[95vw] sm:max-w-md">
          <AlertDialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30 shrink-0">
                <KeyRound className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <AlertDialogTitle className="text-base sm:text-lg md:text-xl break-words">Reset Password</AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="text-xs sm:text-sm md:text-base leading-relaxed space-y-2 sm:space-y-3 break-words">
                <div>
                  You are about to reset the password for{" "}
                  <span className="font-semibold text-foreground">
                    {studentToResetPassword?.full_name} ({studentToResetPassword?.student_id})
                  </span>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg sm:rounded-xl p-3 sm:p-4">
                  <div className="text-xs sm:text-sm font-semibold text-orange-900 dark:text-orange-100 mb-1.5 sm:mb-2 break-words">
                    ⚠️ Password Reset Details:
                  </div>
                  <ul className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-0.5 sm:space-y-1 list-disc list-inside break-words">
                    <li>New password: <code className="font-mono font-bold">ELEG2026!</code></li>
                    <li>Student must change it on next login</li>
                    <li>They cannot access modules until password is changed</li>
                  </ul>
                </div>
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words">
                  📧 Make sure to inform the student of their new password.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="p-4 sm:p-6 pt-3 sm:pt-4 flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={resettingPassword} className="w-full sm:w-auto rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetPasswordConfirm}
              disabled={resettingPassword}
              className="bg-orange-600 hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-700 w-full sm:w-auto rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0"
            >
              {resettingPassword ? "Resetting..." : "Reset Password"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-xl sm:rounded-2xl max-w-[95vw] sm:max-w-lg">
          <AlertDialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
            <div className="flex items-center gap-2 sm:gap-3 mb-2">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-destructive/10 shrink-0">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
              </div>
              <AlertDialogTitle className="text-base sm:text-lg md:text-xl break-words">Delete Student</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs sm:text-sm md:text-base leading-relaxed break-words">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                {studentToDelete?.full_name} ({studentToDelete?.student_id})
              </span>
              ?
              <br />
              <br />
              This will permanently delete all their quiz attempts and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="p-4 sm:p-6 pt-3 sm:pt-4 flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={deleting} className="w-full sm:w-auto rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 w-full sm:w-auto rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0"
            >
              {deleting ? "Deleting..." : "Delete Student"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="rounded-xl sm:rounded-2xl max-w-[95vw] sm:max-w-lg">
          <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
            <DialogTitle className="text-base sm:text-lg md:text-xl break-words">Review Password Reset Request</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm break-words">
              Review the password reset request for {selectedRequest?.full_name}
              {selectedRequest?.is_platform_guest ? (
                <span className="block mt-2 text-amber-700 dark:text-amber-300">
                  Career Member: approving sets a temporary password ({`ELEG2026!`}) and emails it when an address is on
                  file (same as roster students).
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4 py-3 sm:py-4 px-4 sm:px-6">
            <div className="space-y-1.5 sm:space-y-2">
              <div className="text-xs sm:text-sm break-words">
                <span className="font-medium">Student:</span> {selectedRequest?.full_name}
              </div>
              <div className="text-xs sm:text-sm break-words">
                <span className="font-medium">Student ID:</span> {selectedRequest?.student_number}
              </div>
              <div className="text-xs sm:text-sm break-words">
                <span className="font-medium">Section:</span> {selectedRequest?.section}
              </div>
              <div className="text-xs sm:text-sm break-words">
                <span className="font-medium">Requested:</span>{" "}
                {selectedRequest && new Date(selectedRequest.requested_at).toLocaleString()}
              </div>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="review-notes" className="text-xs sm:text-sm break-words">Notes (Optional)</Label>
              <Input
                id="review-notes"
                placeholder="Add any notes about this request..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                disabled={reviewing}
                className="h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="p-4 sm:p-6 pt-3 sm:pt-4 flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" onClick={() => setReviewDialogOpen(false)} disabled={reviewing} className="w-full sm:w-auto rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0">
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 bg-transparent w-full sm:w-auto rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0"
              onClick={handleRejectRequest}
              disabled={reviewing}
            >
              {reviewing ? "Rejecting..." : "Reject"}
            </Button>
            <Button size="sm" onClick={handleApproveRequest} disabled={reviewing} className="bg-green-600 hover:bg-green-700 w-full sm:w-auto rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0">
              {reviewing ? "Approving..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account Request Review Dialog */}
      <Dialog open={accountReviewDialogOpen} onOpenChange={setAccountReviewDialogOpen}>
        <DialogContent className="rounded-xl sm:rounded-2xl max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
            <DialogTitle className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-lg md:text-xl break-words">
              <UserPlus className={cn("h-4 w-4 sm:h-5 sm:w-5 shrink-0", fp?.iconText ?? "text-indigo-600")} />
              Review Account Request
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm break-words">Review the account request from {selectedAccountRequest?.full_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4 py-3 sm:py-4 px-4 sm:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-0.5 sm:space-y-1">
                <div className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 break-words">Request type</div>
                <div className="text-sm sm:text-base font-semibold break-words">
                  {selectedAccountRequest?.request_kind === "guest" ? "Career Member" : "Enrolled (join request)"}
                </div>
              </div>
              {selectedAccountRequest?.request_kind === "guest" && selectedAccountRequest?.guest_purpose && (
                <div className="space-y-0.5 sm:space-y-1 sm:col-span-2">
                  <div className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 break-words">Purpose</div>
                  <div className="text-sm sm:text-base font-semibold break-words">
                    {selectedAccountRequest.guest_purpose === "recommendation_letter"
                      ? "Recommendation letter"
                      : "Other"}
                    {selectedAccountRequest.guest_purpose_detail
                      ? ` — ${String(selectedAccountRequest.guest_purpose_detail)}`
                      : null}
                  </div>
                </div>
              )}
              {selectedAccountRequest?.organization && (
                <div className="space-y-0.5 sm:space-y-1 sm:col-span-2">
                  <div className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 break-words">Organization</div>
                  <div className="text-sm sm:text-base font-semibold break-words">{selectedAccountRequest.organization}</div>
                </div>
              )}
              <div className="space-y-0.5 sm:space-y-1">
                <div className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 break-words">Full Name</div>
                <div className="text-sm sm:text-base font-semibold break-words">{selectedAccountRequest?.full_name}</div>
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <div className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 break-words">Student ID</div>
                <div className="text-sm sm:text-base font-semibold break-words">{selectedAccountRequest?.student_id}</div>
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <div className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 break-words">Section</div>
                <div className="text-sm sm:text-base font-semibold break-words">{selectedAccountRequest?.section}</div>
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <div className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 break-words">Email</div>
                <div className="text-sm sm:text-base font-semibold flex items-center gap-1.5 sm:gap-2 break-words">
                  <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500 shrink-0" />
                  {selectedAccountRequest?.email}
                </div>
              </div>
            </div>

            <div className="pt-3 sm:pt-4 border-t">
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                Requested: {selectedAccountRequest && new Date(selectedAccountRequest.created_at).toLocaleString()}
              </div>
            </div>

            <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 rounded-lg sm:rounded-xl p-3 sm:p-4">
              <AlertCircle className={cn("h-4 w-4 sm:h-5 sm:w-5 shrink-0", fp?.iconText ?? "text-blue-600 dark:text-blue-400")} />
              <AlertDescription className="text-xs sm:text-sm text-blue-700 dark:text-blue-300 break-words">
                <strong>Approval action:</strong>
                {selectedAccountRequest?.request_kind === "guest" ? (
                  <ul className="list-disc list-inside mt-1.5 sm:mt-2 space-y-0.5 sm:space-y-1">
                    <li>
                      Creates their Career Member account with the <strong>same email and password they chose</strong> on
                      the Career Member request form (password is stored securely; you never see it).
                    </li>
                    <li>
                      They sign in at the Career Member page after approval—<strong>not</strong> the roster default password.
                    </li>
                  </ul>
                ) : (
                  <ul className="list-disc list-inside mt-1.5 sm:mt-2 space-y-0.5 sm:space-y-1">
                    <li>
                      Create enrolled student with default password:{" "}
                      <code className="bg-blue-100 dark:bg-blue-800 px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-xs">
                        ELEG2026!
                      </code>
                    </li>
                    <li>Send email notification to student (when configured)</li>
                    <li>Student will be required to change password on first login</li>
                  </ul>
                )}
              </AlertDescription>
            </Alert>

            {/* Rejection reason input (shown when clicking reject) */}
            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="rejection-reason" className="text-xs sm:text-sm break-words">Rejection Reason (Optional)</Label>
              <Input
                id="rejection-reason"
                placeholder="Enter reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                disabled={reviewingAccount}
                className="h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="p-4 sm:p-6 pt-3 sm:pt-4 flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setAccountReviewDialogOpen(false)
                setRejectionReason("")
              }} 
              disabled={reviewingAccount}
              className="w-full sm:w-auto rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full sm:w-auto rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0"
              onClick={handleRejectAccountRequest}
              disabled={reviewingAccount}
            >
              {reviewingAccount ? "Rejecting..." : "Reject"}
            </Button>
            <Button 
              size="sm"
              onClick={handleApproveAccountRequest} 
              disabled={reviewingAccount} 
              className="bg-green-600 hover:bg-green-700 w-full sm:w-auto rounded-lg sm:rounded-xl text-xs sm:text-sm h-9 sm:h-10 min-h-[44px] sm:min-h-0"
            >
              <span className="sm:hidden">Approve</span>
              <span className="hidden sm:inline">{reviewingAccount ? "Approving..." : "Approve & Create Account"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
