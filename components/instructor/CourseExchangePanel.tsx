"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  ArrowDownToLine,
  ArrowRightLeft,
  BookCopy,
  Check,
  Inbox,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Share2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { CourseExchangeDiscoverSheet } from "@/components/instructor/course-exchange-discover-sheet"
import { CourseExchangeRequestSheet, type ExchangeRequestDetail } from "@/components/instructor/course-exchange/CourseExchangeRequestSheet"
import { CourseExchangeUpdateBadge, CourseExchangeUpdateSheet } from "@/components/instructor/course-exchange/CourseExchangeUpdateSheet"
import { CourseExchangeGuidanceCallout } from "@/components/instructor/course-exchange/CourseExchangeGuidanceCallout"
import { CourseExchangeProvenanceBanner } from "@/components/instructor/course-exchange/CourseExchangeProvenanceBanner"
import {
  EXCHANGE_POST_IMPORT_CHECKLIST,
  parseExchangeProvenance,
  summarizeCloneCounts,
} from "@/lib/course-exchange/provenance-shared"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyModuleSideMenu, type FacultySideMenuItem } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import {
  COURSE_EXCHANGE_DEFAULT_APPROVAL_MODULES,
  COURSE_EXCHANGE_MODULE_LABELS,
  COURSE_EXCHANGE_MODULES,
} from "@/lib/course-exchange/modules"
import type { CourseExchangeModule, CourseExchangeSharingMode, DiscoverCourseRelationship } from "@/lib/course-exchange/types"
import {
  isOwnGroupsProjectsSession,
  ownGroupsProjectsSessionMessage,
} from "@/lib/course-exchange/groups-projects-session-policy"
import { offeringsToLegacyCourses, type FacultyCourseOffering } from "@/lib/faculty-course-offerings-shared"
import { portalListStripe } from "@/lib/portal-module-themes"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { FacultyIntegratedToolbar, facultyToolbarSelectTriggerClass } from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import {
  dedupeOwnedDestinationCourses,
  pickPreferredDestinationCourseId,
} from "@/lib/faculty-destination-course-shell-shared"
import { cn } from "@/lib/utils"

type ExchangeViewMode = "list" | "grid"
type DiscoverFilter = "all" | "instant"
type SentFilter = "all" | "active" | "done"
type ReceivedFilter = "all" | "pending"

type TabId = "discover" | "received" | "sent" | "shared-with-me" | "my-shared" | "share-settings"

const MENU: { id: TabId; label: string; icon: typeof Search }[] = [
  { id: "discover", label: "Discover Courses", icon: Search },
  { id: "received", label: "Requests Received", icon: Inbox },
  { id: "sent", label: "Requests Sent", icon: Send },
  { id: "shared-with-me", label: "Shared With Me", icon: BookCopy },
  { id: "my-shared", label: "My Shared Courses", icon: Share2 },
  { id: "share-settings", label: "Share Course", icon: Settings2 },
]

type DiscoverRow = {
  courseId: number
  courseCode: string
  courseTitle: string
  discoverableTitle: string | null
  discoverableDescription: string | null
  description: string | null
  semester: string | null
  university: string | null
  instructorName: string
  instructorInstitution: string | null
  instructorDepartment: string | null
  isOwner?: boolean
  shareableModules?: CourseExchangeModule[]
  autoApprove?: boolean
  relationship?: DiscoverCourseRelationship | null
}

type RequestRow = ExchangeRequestDetail & {
  requesterName?: string
  creatorName?: string
  destination_session_id?: number | null
  copyId?: number | null
  shareableModules?: CourseExchangeModule[]
  missingModules?: CourseExchangeModule[]
  copyApprovedModules?: CourseExchangeModule[] | null
  pendingSupplementModules?: CourseExchangeModule[]
  needsReview?: boolean
}

type SessionRow = { id: number; code: string; course_id: number }

type MyCourseSharing = {
  courseId: number
  courseCode: string
  courseTitle: string
  sharingMode: CourseExchangeSharingMode
  discoverableTitle: string | null
  shareableModules: CourseExchangeModule[]
  autoApprove: boolean
}

type AccessLogRow = {
  id: number
  courseCode: string
  courseTitle: string
  requesterName: string
  eventType: string
  modules: CourseExchangeModule[]
  autoApproved: boolean
  note: string | null
  createdAt: string
}

function statusPillClass(status: string) {
  const s = status.toUpperCase()
  if (s === "APPROVED" || s === "COPIED") {
    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
  }
  if (s === "REJECTED" || s === "FAILED") {
    return "bg-rose-500/15 text-rose-700 dark:text-rose-300"
  }
  if (s === "PENDING") {
    return "bg-amber-500/15 text-amber-800 dark:text-amber-300"
  }
  return "bg-muted text-muted-foreground"
}

function EmptyPanel({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Search
  title: string
  description: string
  action?: ReactNode
}) {
  const chrome = facultyEmbedChrome("course-exchange")
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border)] px-6 py-14 text-center", chrome.card)}>
      <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", chrome.p.softBg, chrome.p.iconText)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>{title}</p>
        <p className={cn("mx-auto max-w-sm text-sm", PORTAL_TEXT_MUTED)}>{description}</p>
      </div>
      {action}
    </div>
  )
}

function PanelHeader({
  title,
  description,
  actions,
}: {
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h2 className={cn("text-base font-semibold tracking-tight sm:text-lg", PORTAL_TEXT)}>{title}</h2>
        <p className="text-sm text-[var(--cc-text-secondary)]">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

function ModulePicker({
  selected,
  onChange,
  defaults,
  allowed,
}: {
  selected: CourseExchangeModule[]
  onChange: (mods: CourseExchangeModule[]) => void
  defaults?: CourseExchangeModule[]
  allowed?: CourseExchangeModule[]
}) {
  const chrome = facultyEmbedChrome("course-exchange")
  const modules = allowed?.length ? allowed : COURSE_EXCHANGE_MODULES
  const toggle = (mod: CourseExchangeModule) => {
    onChange(selected.includes(mod) ? selected.filter((m) => m !== mod) : [...selected, mod])
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {modules.map((mod, index) => {
        const stripe = portalListStripe(index, chrome.theme.family)
        const on = selected.includes(mod)
        return (
          <label
            key={mod}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors hover:bg-[var(--cc-accent-soft)]/45",
              on
                ? cn(
                    "border-[color-mix(in_srgb,var(--cc-accent)_45%,var(--border))]",
                    "bg-[color-mix(in_srgb,var(--cc-accent)_10%,var(--card))]",
                  )
                : "border-[var(--border)] bg-transparent",
            )}
          >
            <Checkbox checked={on} onCheckedChange={() => toggle(mod)} />
            <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold", stripe.iconBg, stripe.iconText)}>
              {COURSE_EXCHANGE_MODULE_LABELS[mod].slice(0, 2).toUpperCase()}
            </span>
            <span className={cn("min-w-0 flex-1 font-medium", PORTAL_TEXT)}>
              {COURSE_EXCHANGE_MODULE_LABELS[mod]}
            </span>
            {defaults && !defaults.includes(mod) ? (
              <span className="shrink-0 rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                Sensitive
              </span>
            ) : null}
          </label>
        )
      })}
    </div>
  )
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
      ))}
    </div>
  )
}

function discoverRowMatchesSearch(row: DiscoverRow, query: string): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true

  const mods = row.shareableModules?.length ? row.shareableModules : COURSE_EXCHANGE_DEFAULT_APPROVAL_MODULES
  const haystack = [
    row.courseCode,
    row.courseTitle,
    row.discoverableTitle,
    row.description,
    row.semester,
    row.instructorInstitution,
    row.university,
    ...mods.map((m) => COURSE_EXCHANGE_MODULE_LABELS[m]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return tokens.every((token) => haystack.includes(token))
}

export function CourseExchangePanel({ initialTab = "discover" }: { initialTab?: TabId }) {
  const { toast } = useToast()
  const chrome = facultyEmbedChrome("course-exchange")
  const [tab, setTab] = useState<TabId>(initialTab)
  const [loading, setLoading] = useState(false)
  const [discoverRows, setDiscoverRows] = useState<DiscoverRow[]>([])
  const [received, setReceived] = useState<RequestRow[]>([])
  const [sent, setSent] = useState<RequestRow[]>([])
  const [sharedWithMe, setSharedWithMe] = useState<Record<string, unknown>[]>([])
  const [myShared, setMyShared] = useState<Record<string, unknown>[]>([])
  const [courses, setCourses] = useState<FacultyCourseOffering[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [mySharingCourses, setMySharingCourses] = useState<MyCourseSharing[]>([])
  const [editingShareCourseId, setEditingShareCourseId] = useState<number | null>(null)
  const [draftSharingMode, setDraftSharingMode] = useState<CourseExchangeSharingMode>("off")
  const [draftShareableModules, setDraftShareableModules] = useState<CourseExchangeModule[]>([
    ...COURSE_EXCHANGE_DEFAULT_APPROVAL_MODULES,
  ])
  const [draftAutoApprove, setDraftAutoApprove] = useState(false)
  const [accessLog, setAccessLog] = useState<AccessLogRow[]>([])
  const [drawerCourse, setDrawerCourse] = useState<DiscoverRow | null>(null)
  const [detailRequest, setDetailRequest] = useState<RequestRow | null>(null)
  const [detailRequestMode, setDetailRequestMode] = useState<"sent" | "received">("sent")
  const [listSearch, setListSearch] = useState("")
  const [viewMode, setViewMode] = useState<ExchangeViewMode>("list")
  const [discoverFilter, setDiscoverFilter] = useState<DiscoverFilter>("all")
  const [sentFilter, setSentFilter] = useState<SentFilter>("all")
  const [receivedFilter, setReceivedFilter] = useState<ReceivedFilter>("all")

  const [requestPurpose, setRequestPurpose] = useState("")
  const [requestModules, setRequestModules] = useState<CourseExchangeModule[]>([
    ...COURSE_EXCHANGE_DEFAULT_APPROVAL_MODULES,
  ])
  const [selectedDiscover, setSelectedDiscover] = useState<DiscoverRow | null>(null)

  const [reviewRequest, setReviewRequest] = useState<RequestRow | null>(null)
  const [approvalModules, setApprovalModules] = useState<CourseExchangeModule[]>([
    ...COURSE_EXCHANGE_DEFAULT_APPROVAL_MODULES,
  ])

  const [importRequest, setImportRequest] = useState<RequestRow | null>(null)
  const [destinationCourseId, setDestinationCourseId] = useState<string>("")
  const [destinationSessionId, setDestinationSessionId] = useState<string>("")
  const [importResult, setImportResult] = useState<{
    checklist: string[]
    provenance?: ReturnType<typeof parseExchangeProvenance>
    cloneSummary?: Record<string, unknown> | null
  } | null>(null)
  const [updateCopyId, setUpdateCopyId] = useState<number | null>(null)
  const [updateCounts, setUpdateCounts] = useState<Record<number, number>>({})
  const [noticeCounts, setNoticeCounts] = useState({ received: 0, sent: 0 })

  const legacyCourses = useMemo(() => offeringsToLegacyCourses(courses), [courses])
  const institutionHint = useMemo(
    () => courses.find((c) => c.university?.trim())?.university ?? null,
    [courses],
  )
  const destinationCourseOptions = useMemo(() => {
    const rows = legacyCourses.map((c) => ({
      course_id: c.course_id,
      course_code: c.course_code,
      course_title: c.course_title,
      exchange_provenance: courses.find((o) => o.course_id === c.course_id)?.exchange_provenance ?? null,
    }))
    return dedupeOwnedDestinationCourses(rows, institutionHint)
  }, [legacyCourses, courses, institutionHint])
  const preferredDestinationForDrawer = useMemo(() => {
    if (!drawerCourse) return null
    return pickPreferredDestinationCourseId(destinationCourseOptions, drawerCourse.courseCode, institutionHint)
  }, [drawerCourse, destinationCourseOptions, institutionHint])

  const detailDestinationLabel = useMemo(() => {
    if (!detailRequest?.destination_course_id) return null
    const match = destinationCourseOptions.find((c) => c.course_id === detailRequest.destination_course_id)
    if (match) return `${match.course_code} — ${match.course_title}`
    return `Course #${detailRequest.destination_course_id}`
  }, [detailRequest, destinationCourseOptions])

  const openRequestDetail = (request: RequestRow, mode: "sent" | "received") => {
    setDetailRequestMode(mode)
    setDetailRequest(request)
  }

  const openDiscoverCourse = async (row: DiscoverRow) => {
    const rel = row.relationship
    if (rel?.requestId && rel.kind !== "none") {
      let match = sent.find((s) => s.id === rel.requestId)
      if (!match) {
        const res = await instructorApiFetch("/api/instructor/course-exchange/requests?direction=sent", { headers: headers() })
        const data = await res.json()
        const rows = (data.requests ?? []) as RequestRow[]
        setSent(rows)
        match = rows.find((s) => s.id === rel.requestId)
      }
      if (match) {
        openRequestDetail(
          {
            ...match,
            shareableModules: row.shareableModules ?? match.shareableModules,
            missingModules: rel.missingModules.length ? rel.missingModules : match.missingModules,
          },
          "sent",
        )
        return
      }
    }
    setDrawerCourse(row)
  }

  const submitRequestSupplement = async (requestId: number, modules: CourseExchangeModule[]) => {
    setLoading(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/course-exchange/requests/${requestId}/supplement`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ modules }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to add modules")
      toast({
        title: data.needsApproval ? "Approval requested" : "Modules imported",
        description: data.needsApproval
          ? "The course owner will review your additional module request."
          : "Selected modules were copied into your destination course.",
      })
      await Promise.all([loadDiscover(), loadCopies(), loadNoticeCounts()])
      const sentRes = await instructorApiFetch("/api/instructor/course-exchange/requests?direction=sent", { headers: headers() })
      const sentData = await sentRes.json()
      const sentRows = (sentData.requests ?? []) as RequestRow[]
      setSent(sentRows)
      if (detailRequest?.id === requestId) {
        const refreshed = sentRows.find((r) => r.id === requestId)
        if (refreshed) setDetailRequest(refreshed)
        else if (data.request) setDetailRequest((prev) => (prev ? { ...prev, ...data.request } : prev))
      }
    } catch (e) {
      toast({ title: "Could not add modules", description: String(e), variant: "destructive" })
      throw e
    } finally {
      setLoading(false)
    }
  }
  const headers = useCallback(() => buildInstructorApiHeaders(), [])

  const loadNoticeCounts = useCallback(async () => {
    try {
      const res = await instructorApiFetch("/api/instructor/course-exchange/summary", { headers: headers() })
      const data = await res.json()
      if (!res.ok) return
      setNoticeCounts({
        received: Number(data.receivedPending ?? data.pending ?? 0),
        sent: Number(data.sentActive ?? data.sentActionable ?? 0),
      })
    } catch {
      /* non-blocking */
    }
  }, [headers])

  const syncNoticeCountsFromRequests = useCallback((recv: RequestRow[], sentRows: RequestRow[]) => {
    setNoticeCounts({
      received: recv.filter((r) => r.needsReview ?? r.status.toUpperCase() === "PENDING").length,
      sent: sentRows.filter((r) => ["PENDING", "APPROVED", "FAILED"].includes(r.status.toUpperCase())).length,
    })
  }, [])

  const menuItems = useMemo((): FacultySideMenuItem[] => {
    return MENU.map((item) => {
      if (item.id === "received" && noticeCounts.received > 0) {
        return { ...item, badge: noticeCounts.received, tone: "warning" }
      }
      if (item.id === "sent" && noticeCounts.sent > 0) {
        return { ...item, badge: noticeCounts.sent, tone: "warning" }
      }
      return item
    })
  }, [noticeCounts])

  const loadDiscover = useCallback(async () => {
    setLoading(true)
    try {
      const res = await instructorApiFetch("/api/instructor/course-exchange/discover", { headers: headers() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to load")
      setDiscoverRows(data.courses ?? [])
    } catch (e) {
      toast({ title: "Discover failed", description: String(e), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [headers, toast])

  const loadRequests = useCallback(async () => {
    setLoading(true)
    try {
      const [recvRes, sentRes] = await Promise.all([
        instructorApiFetch("/api/instructor/course-exchange/requests?direction=received", { headers: headers() }),
        instructorApiFetch("/api/instructor/course-exchange/requests?direction=sent", { headers: headers() }),
      ])
      const recvData = await recvRes.json()
      const sentData = await sentRes.json()
      const recvRows = recvData.requests ?? []
      const sentRows = sentData.requests ?? []
      setReceived(recvRows)
      setSent(sentRows)
      syncNoticeCountsFromRequests(recvRows, sentRows)
    } finally {
      setLoading(false)
    }
  }, [headers, syncNoticeCountsFromRequests])

  const loadCopies = useCallback(async () => {
    setLoading(true)
    try {
      const [swm, ms] = await Promise.all([
        instructorApiFetch("/api/instructor/course-exchange/shared-with-me", { headers: headers() }),
        instructorApiFetch("/api/instructor/course-exchange/my-shared", { headers: headers() }),
      ])
      const swmData = await swm.json()
      setSharedWithMe(swmData.copies ?? [])
      setMyShared((await ms.json()).copies ?? [])

      const counts: Record<number, number> = {}
      for (const copy of swmData.copies ?? []) {
        const id = Number(copy.id)
        const pending = Number(copy.pending_update_count ?? 0)
        if (Number.isFinite(id) && pending > 0) counts[id] = pending
      }
      setUpdateCounts(counts)

      void instructorApiFetch("/api/instructor/course-exchange/copies/update-counts", { headers: headers() })
        .then((res) => res.json())
        .then((data) => {
          const refreshed = data.counts as Record<number, { changeCount: number; hasUpdates: boolean }> | undefined
          if (!refreshed) return
          const next: Record<number, number> = {}
          for (const [id, meta] of Object.entries(refreshed)) {
            if (meta.hasUpdates) next[Number(id)] = meta.changeCount
          }
          setUpdateCounts(next)
        })
        .catch(() => {
          /* keep DB counts on background refresh failure */
        })
    } finally {
      setLoading(false)
    }
  }, [headers])

  const loadSharingSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await instructorApiFetch("/api/instructor/course-exchange/sharing-settings", { headers: headers() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to load")
      setMySharingCourses(data.courses ?? [])
    } catch (e) {
      toast({ title: "Could not load your courses", description: String(e), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [headers, toast])

  const loadCoursesAndSessions = useCallback(async () => {
    const [cRes, sRes] = await Promise.all([
      instructorApiFetch("/api/instructor/courses", { headers: headers() }),
      instructorApiFetch("/api/instructor/sessions", { headers: headers() }),
    ])
    const cData = await cRes.json()
    const sData = await sRes.json()
    setCourses(cData.offerings ?? cData.courses ?? [])
    setSessions(sData.sessions ?? [])
  }, [headers])

  const loadAccessLog = useCallback(async () => {
    const res = await instructorApiFetch("/api/instructor/course-exchange/access-log", { headers: headers() })
    if (!res.ok) return
    const data = await res.json()
    setAccessLog(data.events ?? [])
  }, [headers])

  useEffect(() => {
    void loadCoursesAndSessions()
    void loadNoticeCounts()
  }, [loadCoursesAndSessions, loadNoticeCounts])

  useEffect(() => {
    if (tab === "discover") void loadDiscover()
  }, [tab, loadDiscover])

  useEffect(() => {
    setListSearch("")
  }, [tab])

  const filteredDiscoverRows = useMemo(() => {
    return discoverRows.filter((row) => {
      if (discoverFilter === "instant" && !row.autoApprove) return false
      return discoverRowMatchesSearch(row, listSearch)
    })
  }, [discoverRows, discoverFilter, listSearch])

  const discoverHasActiveFilters =
    listSearch.trim().length > 0 || discoverFilter !== "all"

  const filteredReceived = useMemo(() => {
    const q = listSearch.trim().toLowerCase()
    return received.filter((r) => {
      if (receivedFilter === "pending" && !(r.needsReview ?? r.status.toUpperCase() === "PENDING")) return false
      if (!q) return true
      return [r.courseCode, r.courseTitle, r.requesterName, r.purpose].filter(Boolean).join(" ").toLowerCase().includes(q)
    })
  }, [received, receivedFilter, listSearch])

  const filteredSent = useMemo(() => {
    const q = listSearch.trim().toLowerCase()
    return sent.filter((r) => {
      const status = r.status.toUpperCase()
      if (sentFilter === "active" && !["PENDING", "APPROVED", "FAILED"].includes(status)) return false
      if (sentFilter === "done" && !["COPIED", "COMPLETED", "REJECTED"].includes(status)) return false
      if (!q) return true
      return [r.courseCode, r.courseTitle, r.creatorName, r.purpose].filter(Boolean).join(" ").toLowerCase().includes(q)
    })
  }, [sent, sentFilter, listSearch])

  const filteredSharedWithMe = useMemo(() => {
    const q = listSearch.trim().toLowerCase()
    if (!q) return sharedWithMe
    return sharedWithMe.filter((c) =>
      [c.destination_course_code, c.source_course_code, c.source_instructor_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    )
  }, [sharedWithMe, listSearch])

  const filteredMyShared = useMemo(() => {
    const q = listSearch.trim().toLowerCase()
    if (!q) return myShared
    return myShared.filter((c) =>
      [c.source_course_code, c.destination_course_code, c.requester_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    )
  }, [myShared, listSearch])

  useEffect(() => {
    if (tab === "received" || tab === "sent") void loadRequests()
    if (tab === "shared-with-me" || tab === "my-shared") void loadCopies()
    if (tab === "share-settings") {
      void loadSharingSettings()
      void loadAccessLog()
    }
  }, [tab, loadRequests, loadCopies, loadSharingSettings, loadAccessLog])

  const importHasGroupsProjects = useMemo(
    () => (importRequest?.approved_modules ?? []).some((m) => m === "groups" || m === "projects"),
    [importRequest],
  )

  const filteredSessions = useMemo(() => {
    const cid = Number(destinationCourseId)
    if (!Number.isFinite(cid)) return []
    let list = sessions.filter((s) => s.course_id === cid)
    if (importHasGroupsProjects) {
      list = list.filter((s) => !isOwnGroupsProjectsSession(s.code))
    }
    return list
  }, [destinationCourseId, sessions, importHasGroupsProjects])

  function openShareEditor(course: MyCourseSharing) {
    setEditingShareCourseId(course.courseId)
    setDraftSharingMode(course.sharingMode)
    setDraftShareableModules(
      course.shareableModules?.length
        ? [...course.shareableModules]
        : [...COURSE_EXCHANGE_DEFAULT_APPROVAL_MODULES],
    )
    setDraftAutoApprove(Boolean(course.autoApprove))
  }

  async function saveSharingSettings() {
    if (editingShareCourseId == null) return
    if (draftSharingMode === "request_only" && draftShareableModules.length === 0) {
      toast({
        title: "Select modules to share",
        description: "Turn on at least one teaching module. Student results are never shared.",
        variant: "destructive",
      })
      return
    }
    setLoading(true)
    try {
      const course = mySharingCourses.find((c) => c.courseId === editingShareCourseId)
      const res = await instructorApiFetch("/api/instructor/course-exchange/sharing-settings", {
        method: "PUT",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: editingShareCourseId,
          sharingMode: draftSharingMode,
          discoverableTitle: course?.courseTitle ?? null,
          shareableModules: draftShareableModules,
          autoApprove: draftAutoApprove,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Save failed")
      toast({
        title: draftSharingMode === "request_only" ? "Course is discoverable" : "Sharing turned off",
        description:
          draftSharingMode === "request_only"
            ? draftAutoApprove
              ? "Requests for enabled modules import automatically. Access stays in your log."
              : "Other instructors can request the modules you enabled."
            : "This course no longer appears in Discover.",
      })
      setEditingShareCourseId(null)
      await loadSharingSettings()
    } catch (e) {
      toast({ title: "Save failed", description: String(e), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  async function submitDiscoverRequest(payload?: {
    modules: CourseExchangeModule[]
    purpose: string
    destinationCourseId: number
  }) {
    const source = drawerCourse ?? selectedDiscover
    if (!source) return
    const modules = payload?.modules ?? requestModules
    const purpose = payload?.purpose ?? requestPurpose
    const destinationCourseId = payload?.destinationCourseId
    if (!destinationCourseId) {
      toast({ title: "Pick a destination course", variant: "destructive" })
      return
    }
    setLoading(true)
    try {
      const res = await instructorApiFetch("/api/instructor/course-exchange/requests", {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceCourseId: source.courseId,
          purpose,
          requestedModules: modules,
          destinationCourseId,
          destinationSessionId: destinationSessionId ? Number(destinationSessionId) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Request failed")
      const imported = Boolean(data.request?.imported || data.request?.autoApproved)
      toast({
        title: imported ? "Materials imported" : "Request sent",
        description: imported
          ? "Approved modules were copied into your course. Edits won’t affect the original."
          : "The course creator will review your module request.",
      })
      setDrawerCourse(null)
      setSelectedDiscover(null)
      setRequestPurpose("")
      setTab(imported ? "shared-with-me" : "sent")
      void loadRequests()
      void loadCopies()
    } catch (e) {
      toast({ title: "Request failed", description: String(e), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  async function approveRequest() {
    if (!reviewRequest) return
    setLoading(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/course-exchange/requests/${reviewRequest.id}/approve`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ approvedModules: approvalModules }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Approval failed")
      toast({
        title: data.imported ? "Approved and imported" : "Approved",
        description: data.imported
          ? "Materials were copied into the requester's destination course."
          : "The requester can import materials from Requests Sent once they pick a destination course.",
      })
      setReviewRequest(null)
      void loadRequests()
    } catch (e) {
      toast({ title: "Approval failed", description: String(e), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  async function rejectRequest(id: number) {
    setLoading(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/course-exchange/requests/${id}/reject`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Reject failed")
      toast({ title: "Request rejected" })
      setReviewRequest(null)
      void loadRequests()
    } catch (e) {
      toast({ title: "Reject failed", description: String(e), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  async function executeImport() {
    if (!importRequest) return
    if (importHasGroupsProjects && destinationSessionId) {
      const sess = sessions.find((s) => String(s.id) === destinationSessionId)
      if (sess && isOwnGroupsProjectsSession(sess.code)) {
        toast({
          title: "Cannot import groups or projects",
          description: ownGroupsProjectsSessionMessage(),
          variant: "destructive",
        })
        return
      }
    }
    setLoading(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/course-exchange/requests/${importRequest.id}/execute-copy`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationCourseId: Number(destinationCourseId),
          destinationSessionId: destinationSessionId ? Number(destinationSessionId) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Import failed")
      setImportResult({
        checklist: data.postCopyChecklist ?? [...EXCHANGE_POST_IMPORT_CHECKLIST],
        provenance: parseExchangeProvenance(data.attribution),
        cloneSummary: (data.cloneSummary as Record<string, unknown> | undefined) ?? null,
      })
      toast({ title: "Course copied successfully" })
      void loadRequests()
      void loadCopies()
    } catch (e) {
      toast({ title: "Import failed", description: String(e), variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  function renderRequestList(items: RequestRow[], mode: "received" | "sent") {
    if (loading && items.length === 0) return <ListSkeleton />
    if (items.length === 0) {
      return (
        <EmptyPanel
          icon={mode === "received" ? Inbox : Send}
          title={mode === "received" ? "No requests yet" : "No outbound requests"}
          description={
            mode === "received"
              ? "When another instructor asks to use one of your shared courses, it will show up here."
              : "Browse Discover Courses and request materials from colleagues who have opted in."
          }
          action={
            mode === "sent" ? (
              <Button className={chrome.solid} onClick={() => setTab("discover")}>
                Discover courses
              </Button>
            ) : (
              <Button className={chrome.solid} onClick={() => setTab("share-settings")}>
                Share a course
              </Button>
            )
          }
        />
      )
    }

    return (
      <div className={cn("overflow-hidden rounded-2xl border border-[var(--border)]", chrome.card)}>
        <div className="divide-y divide-[var(--border)]">
          {items.map((r, index) => {
            const stripe = portalListStripe(index, chrome.theme.family)
            return (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => openRequestDetail(r, mode)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    openRequestDetail(r, mode)
                  }
                }}
                className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 px-3 py-3 text-left hover:bg-[var(--cc-accent-soft)]/45 sm:px-4"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", stripe.iconBg, stripe.iconText)}>
                    {mode === "received" ? <Inbox className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className={cn("truncate font-medium", PORTAL_TEXT)}>
                      {r.courseCode} — {r.courseTitle}
                    </p>
                    <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                      {mode === "received" ? r.requesterName : r.creatorName}
                    </p>
                    {r.purpose ? <p className={cn("mt-1 line-clamp-2 text-sm", PORTAL_TEXT_MUTED)}>{r.purpose}</p> : null}
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide", statusPillClass(r.status))}>
                    {r.status}
                  </span>
                  {mode === "received" && (r.needsReview ?? r.status === "PENDING") ? (
                    <Button
                      size="sm"
                      className={chrome.solid}
                      onClick={() => {
                        setReviewRequest(r)
                        const pending = r.pendingSupplementModules ?? []
                        setApprovalModules(
                          pending.length > 0
                            ? pending
                            : r.approved_modules?.length
                              ? [...r.approved_modules]
                              : [...COURSE_EXCHANGE_DEFAULT_APPROVAL_MODULES],
                        )
                      }}
                    >
                      Review
                    </Button>
                  ) : null}
                  {mode === "sent" && (r.status === "APPROVED" || r.status === "FAILED") ? (
                    <Button
                      size="sm"
                      className={chrome.solid}
                      onClick={() => {
                        setImportRequest(r)
                        setImportResult(null)
                        setDestinationCourseId(
                          r.destination_course_id ? String(r.destination_course_id) : "",
                        )
                        setDestinationSessionId(
                          r.destination_session_id ? String(r.destination_session_id) : "",
                        )
                      }}
                    >
                      <ArrowDownToLine className="mr-1.5 h-3.5 w-3.5" />
                      {r.status === "FAILED" ? "Retry import" : "Import"}
                    </Button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const sharedOnCount = mySharingCourses.filter((c) => c.sharingMode === "request_only").length

  function renderSharedWithMeCopy(c: Record<string, unknown>, index: number, grid = false) {
    const stripe = portalListStripe(index, chrome.theme.family)
    const summary = summarizeCloneCounts((c.clone_summary as Record<string, unknown> | undefined) ?? null)
    const attribution = parseExchangeProvenance(c.attribution)
    const copyId = Number(c.id)
    const pendingUpdates = updateCounts[copyId] ?? Number(c.pending_update_count ?? 0)

    return (
      <div
        key={String(c.id)}
        className={cn(
          grid
            ? "flex h-full flex-col justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4"
            : "flex flex-wrap items-center justify-between gap-3 hover:bg-[var(--cc-accent-soft)]/45 px-3 py-3 sm:px-4",
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", stripe.iconBg, stripe.iconText)}>
            <BookCopy className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className={cn("font-medium", PORTAL_TEXT)}>
                {String(c.destination_course_code ?? "")}
                <span className="font-normal text-[var(--cc-text-secondary)]"> ← {String(c.source_course_code ?? "")}</span>
              </p>
              <CourseExchangeUpdateBadge count={pendingUpdates} />
            </div>
            <p className="text-xs text-[var(--cc-text-secondary)]">
              From {String(c.source_instructor_name ?? "")}
              {summary ? ` · ${summary}` : ""}
              {c.sync_version ? ` · v${String(c.sync_version)}` : ""}
            </p>
            {attribution ? (
              <p className="mt-1 text-[11px] text-[var(--cc-text-muted)]">
                Independent copy — edits here do not change {attribution.sourceCourseCode}.
              </p>
            ) : null}
          </div>
        </div>
        <Button
          size="sm"
          variant={pendingUpdates > 0 ? "default" : "outline"}
          className={pendingUpdates > 0 ? chrome.solid : undefined}
          onClick={() => setUpdateCopyId(copyId)}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          {pendingUpdates > 0 ? "Review updates" : "Check updates"}
        </Button>
      </div>
    )
  }

  function renderExchangeToolbar({
    searchPlaceholder,
    meta,
    filters,
    trailing,
    showViewOrganizer = true,
  }: {
    searchPlaceholder: string
    meta?: ReactNode
    filters?: ReactNode
    trailing?: ReactNode
    showViewOrganizer?: boolean
  }) {
    return (
      <FacultyIntegratedToolbar
        moduleId="course-exchange"
        embedded
        search={listSearch}
        onSearchChange={setListSearch}
        onSearchClear={() => setListSearch("")}
        searchPlaceholder={searchPlaceholder}
        filters={filters}
        viewMode={showViewOrganizer ? viewMode : undefined}
        onViewModeChange={showViewOrganizer ? setViewMode : undefined}
        meta={meta}
        trailing={trailing}
      />
    )
  }

  function renderDiscoverRow(row: DiscoverRow, index: number, grid = false) {
    const stripe = portalListStripe(index, chrome.theme.family)
    const isOwner = Boolean(row.isOwner)
    const mods = row.shareableModules?.length ? row.shareableModules : COURSE_EXCHANGE_DEFAULT_APPROVAL_MODULES
    return (
      <div
        key={row.courseId}
        className={cn(
          grid
            ? "flex h-full flex-col justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 hover:bg-[var(--cc-accent-soft)]/45 sm:p-4"
            : "flex flex-wrap items-center justify-between gap-3 px-3 py-3 hover:bg-[var(--cc-accent-soft)]/45 sm:px-4",
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
              stripe.iconBg,
              stripe.iconText,
            )}
          >
            {(row.courseCode || "C").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className={cn("font-medium", PORTAL_TEXT)}>
                {row.discoverableTitle ?? row.courseTitle}
                <span className="font-normal text-[var(--cc-text-secondary)]"> · {row.courseCode}</span>
              </p>
              {isOwner ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    chrome.p.softBg,
                    chrome.p.iconText,
                  )}
                >
                  Owner
                </span>
              ) : null}
              {row.autoApprove ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Instant
                </span>
              ) : null}
              {row.relationship && row.relationship.kind !== "none" ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    row.relationship.kind === "imported"
                      ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                      : row.relationship.kind === "pending"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        : chrome.p.softBg,
                    row.relationship.kind === "imported" || row.relationship.kind === "pending"
                      ? ""
                      : chrome.p.iconText,
                  )}
                >
                  {row.relationship.kind === "imported"
                    ? "Imported"
                    : row.relationship.kind === "pending"
                      ? "Pending"
                      : row.relationship.status.replace(/_/g, " ")}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-[var(--cc-text-secondary)]">
              {row.instructorName}
              {row.semester ? ` · ${row.semester}` : ""}
              {row.instructorInstitution || row.university ? ` · ${row.instructorInstitution || row.university}` : ""}
            </p>
            {row.description ? (
              <p className="mt-1 line-clamp-2 text-sm text-[var(--cc-text-secondary)]">{row.description}</p>
            ) : null}
            <p className="mt-1.5 line-clamp-1 text-[11px] text-[var(--cc-text-muted)]">
              {mods.slice(0, 5).map((m) => COURSE_EXCHANGE_MODULE_LABELS[m]).join(" · ")}
              {mods.length > 5 ? ` · +${mods.length - 5} more` : ""}
            </p>
          </div>
        </div>
        {isOwner ? (
          <Button size="sm" variant="outline" onClick={() => setTab("share-settings")}>
            Manage sharing
          </Button>
        ) : (
          (() => {
            const hasRelationship = Boolean(row.relationship && row.relationship.kind !== "none")
            return (
              <Button
                size="sm"
                variant={hasRelationship ? "outline" : "default"}
                className={hasRelationship ? cn(chrome.p.border, chrome.p.iconText) : chrome.solid}
                onClick={() => void openDiscoverCourse(row)}
              >
                {hasRelationship ? "Review course" : "View details"}
              </Button>
            )
          })()
        )}
      </div>
    )
  }

  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="w-full min-w-0 p-3 sm:p-4 md:p-5">
          <FacultyModuleSplitLayout
            menu={
              <FacultyModuleSideMenu
                moduleId="course-exchange"
                title="Course Exchange"
                activeId={tab}
                onSelect={(id) => setTab(id as TabId)}
                items={menuItems}
              />
            }
          >
            <div className="space-y-5">
              {tab === "discover" ? (
                <>
                  <PanelHeader
                    title="Discover Courses"
                    description="Browse shared courses. Open details, pick only the modules you need, and import into a dedicated course shell for your term."
                  />
                  {renderExchangeToolbar({
                    searchPlaceholder: "Search courses, instructors…",
                    filters: (
                      <Select value={discoverFilter} onValueChange={(v) => setDiscoverFilter(v as DiscoverFilter)}>
                        <SelectTrigger className={cn(facultyToolbarSelectTriggerClass(discoverFilter !== "all"), "h-9 w-[120px] shadow-none")}>
                          <SelectValue placeholder="Filter" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All courses</SelectItem>
                          <SelectItem value="instant">Instant only</SelectItem>
                        </SelectContent>
                      </Select>
                    ),
                    meta: (
                      <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                        {discoverHasActiveFilters
                          ? `${filteredDiscoverRows.length} of ${discoverRows.length} courses`
                          : `${discoverRows.length} courses`}
                      </p>
                    ),
                  })}
                  {loading && discoverRows.length === 0 ? (
                    <ListSkeleton />
                  ) : filteredDiscoverRows.length === 0 ? (
                    <EmptyPanel
                      icon={Search}
                      title={discoverRows.length === 0 ? "No shareable courses yet" : "No matching courses"}
                      description={
                        discoverRows.length === 0
                          ? "When instructors turn on sharing and pick modules, those courses show up here."
                          : "Try a different search or filter."
                      }
                      action={
                        discoverRows.length === 0 ? (
                          <Button className={chrome.solid} onClick={() => setTab("share-settings")}>
                            Share one of my courses
                          </Button>
                        ) : undefined
                      }
                    />
                  ) : viewMode === "grid" ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {filteredDiscoverRows.map((row, index) => renderDiscoverRow(row, index, true))}
                    </div>
                  ) : (
                    <div className={cn("overflow-hidden rounded-2xl border border-[var(--border)]", chrome.card)}>
                      <div className="divide-y divide-[var(--border)]">
                        {filteredDiscoverRows.map((row, index) => renderDiscoverRow(row, index))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}

              {tab === "received" ? (
                <>
                  <PanelHeader
                    title="Requests Received"
                    description="Review who wants to reuse materials from courses you have shared."
                  />
                  <CourseExchangeGuidanceCallout kind="owner-sharing" dismissId="exchange:received:owner" />
                  {renderExchangeToolbar({
                    searchPlaceholder: "Search requests…",
                    filters: (
                      <Select value={receivedFilter} onValueChange={(v) => setReceivedFilter(v as ReceivedFilter)}>
                        <SelectTrigger className={cn(facultyToolbarSelectTriggerClass(receivedFilter !== "all"), "h-9 w-[120px] shadow-none")}>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                    ),
                    meta: (
                      <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                        {filteredReceived.length === received.length
                          ? `${received.length} requests`
                          : `${filteredReceived.length} of ${received.length} requests`}
                      </p>
                    ),
                  })}
                  {renderRequestList(filteredReceived, "received")}
                </>
              ) : null}

              {tab === "sent" ? (
                <>
                  <PanelHeader
                    title="Requests Sent"
                    description="Track outbound requests. When a destination course was chosen, approval copies materials automatically into your course shell."
                  />
                  <CourseExchangeGuidanceCallout kind="independent-copy" dismissId="exchange:sent:copy" />
                  {renderExchangeToolbar({
                    searchPlaceholder: "Search sent requests…",
                    filters: (
                      <Select value={sentFilter} onValueChange={(v) => setSentFilter(v as SentFilter)}>
                        <SelectTrigger className={cn(facultyToolbarSelectTriggerClass(sentFilter !== "all"), "h-9 w-[120px] shadow-none")}>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="active">In progress</SelectItem>
                          <SelectItem value="done">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    ),
                    meta: (
                      <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                        {filteredSent.length === sent.length
                          ? `${sent.length} requests`
                          : `${filteredSent.length} of ${sent.length} requests`}
                      </p>
                    ),
                    trailing: (
                      <Button size="sm" className={cn("h-9 shrink-0 rounded-xl", chrome.solid)} onClick={() => setTab("discover")}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        New request
                      </Button>
                    ),
                  })}
                  {renderRequestList(filteredSent, "sent")}
                </>
              ) : null}

              {tab === "shared-with-me" ? (
                <>
                  <PanelHeader
                    title="Shared With Me"
                    description="Independent copies in your courses. Each import is a separate fork — safe to edit without affecting the source."
                  />
                  <CourseExchangeGuidanceCallout kind="independent-copy" dismissId="exchange:shared-with-me:copy" />
                  {renderExchangeToolbar({
                    searchPlaceholder: "Search imports…",
                    meta: (
                      <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                        {filteredSharedWithMe.length === sharedWithMe.length
                          ? `${sharedWithMe.length} copies`
                          : `${filteredSharedWithMe.length} of ${sharedWithMe.length} copies`}
                      </p>
                    ),
                    trailing: (
                      <Button size="sm" className={cn("h-9 shrink-0 rounded-xl", chrome.solid)} onClick={() => setTab("discover")}>
                        Browse courses
                      </Button>
                    ),
                  })}
                  {loading && sharedWithMe.length === 0 ? (
                    <ListSkeleton />
                  ) : filteredSharedWithMe.length === 0 ? (
                    <EmptyPanel
                      icon={BookCopy}
                      title="No imported copies yet"
                      description="After a request is approved with a destination course, materials appear here and in your course modules."
                      action={
                        <Button className={chrome.solid} onClick={() => setTab("sent")}>
                          View sent requests
                        </Button>
                      }
                    />
                  ) : viewMode === "grid" ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {filteredSharedWithMe.map((c, index) => renderSharedWithMeCopy(c, index, true))}
                    </div>
                  ) : (
                    <div className={cn("overflow-hidden rounded-2xl border border-[var(--border)]", chrome.card)}>
                      <div className="divide-y divide-[var(--border)]">
                        {filteredSharedWithMe.map((c, index) => renderSharedWithMeCopy(c, index))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}

              {tab === "my-shared" ? (
                <>
                  <PanelHeader
                    title="My Shared Courses"
                    description="Copies other instructors created from courses you approved. Each row is an independent fork in their account."
                  />
                  <CourseExchangeGuidanceCallout kind="owner-sharing" dismissId="exchange:my-shared:owner" />
                  {renderExchangeToolbar({
                    searchPlaceholder: "Search outbound copies…",
                    meta: (
                      <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                        {filteredMyShared.length === myShared.length
                          ? `${myShared.length} copies`
                          : `${filteredMyShared.length} of ${myShared.length} copies`}
                      </p>
                    ),
                    trailing: (
                      <Button size="sm" className={cn("h-9 shrink-0 rounded-xl", chrome.solid)} onClick={() => setTab("share-settings")}>
                        Share course
                      </Button>
                    ),
                  })}
                  {loading && myShared.length === 0 ? (
                    <ListSkeleton />
                  ) : filteredMyShared.length === 0 ? (
                    <EmptyPanel
                      icon={Share2}
                      title="No outbound shares yet"
                      description="Turn on Share Course for one of your courses, approve incoming requests, and completed copies will appear here."
                      action={
                        <Button className={chrome.solid} onClick={() => setTab("share-settings")}>
                          Manage sharing
                        </Button>
                      }
                    />
                  ) : viewMode === "grid" ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {filteredMyShared.map((c, index) => {
                        const stripe = portalListStripe(index, chrome.theme.family)
                        return (
                          <div
                            key={String(c.id)}
                            className="flex h-full items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 hover:bg-[var(--cc-accent-soft)]/45 sm:p-4"
                          >
                            <div className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", stripe.iconBg, stripe.iconText)}>
                              <ArrowRightLeft className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className={cn("font-medium", PORTAL_TEXT)}>
                                {String(c.source_course_code ?? "")}
                                <span className={cn("font-normal", PORTAL_TEXT_MUTED)}> → {String(c.destination_course_code ?? "")}</span>
                              </p>
                              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{String(c.requester_name ?? "")}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className={cn("overflow-hidden rounded-2xl border border-[var(--border)]", chrome.card)}>
                      <div className="divide-y divide-[var(--border)]">
                        {filteredMyShared.map((c, index) => {
                          const stripe = portalListStripe(index, chrome.theme.family)
                          return (
                            <div key={String(c.id)} className="flex items-start gap-3 px-3 py-3 hover:bg-[var(--cc-accent-soft)]/45 sm:px-4">
                              <div className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", stripe.iconBg, stripe.iconText)}>
                                <ArrowRightLeft className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className={cn("font-medium", PORTAL_TEXT)}>
                                  {String(c.source_course_code ?? "")}
                                  <span className={cn("font-normal", PORTAL_TEXT_MUTED)}> → {String(c.destination_course_code ?? "")}</span>
                                </p>
                                <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Requested by {String(c.requester_name ?? "")}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : null}

              {tab === "share-settings" ? (
                <>
                  <PanelHeader
                    title="Share Course"
                    description="List your courses, turn sharing on, and toggle which teaching modules others may request. Student results are never shared."
                    actions={
                      <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs font-semibold tabular-nums text-[var(--cc-text)]">
                        {sharedOnCount} of {mySharingCourses.length} sharing
                      </span>
                    }
                  />
                  <CourseExchangeGuidanceCallout kind="owner-sharing" dismissId="exchange:share-settings:owner" />

                  {loading && mySharingCourses.length === 0 ? (
                    <ListSkeleton rows={5} />
                  ) : mySharingCourses.length === 0 ? (
                    <EmptyPanel
                      icon={Settings2}
                      title="No courses to share"
                      description="Create or get assigned to a course first. Your owned courses will appear here so you can opt them into Discover."
                    />
                  ) : (
                    <div className={cn("overflow-hidden rounded-2xl border border-[var(--border)]", chrome.card)}>
                      <div className="divide-y divide-[var(--border)]">
                        {mySharingCourses.map((course, index) => {
                          const stripe = portalListStripe(index, chrome.theme.family)
                          const isOn = course.sharingMode === "request_only"
                          const isEditing = editingShareCourseId === course.courseId
                          const moduleCount = course.shareableModules?.length ?? 0
                          return (
                            <div key={course.courseId} className="px-3 py-3 sm:px-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex min-w-0 flex-1 items-start gap-3">
                                  <div className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold", stripe.iconBg, stripe.iconText)}>
                                    {(course.courseCode || "C").slice(0, 2).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className={cn("font-medium", PORTAL_TEXT)}>{course.courseTitle}</p>
                                    <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>{course.courseCode}</p>
                                    {isOn ? (
                                      <p className="mt-1 text-xs text-[var(--cc-text-secondary)]">
                                        {moduleCount} module{moduleCount === 1 ? "" : "s"} shareable
                                        {course.autoApprove ? " · auto-approve on" : ""}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                                      isOn
                                        ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200"
                                        : "border border-[var(--border)] bg-[var(--card)] text-[var(--cc-text-secondary)]",
                                    )}
                                  >
                                    {isOn ? "Sharing" : "Off"}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant={isEditing ? "outline" : "default"}
                                    className={isEditing ? undefined : chrome.solid}
                                    onClick={() => (isEditing ? setEditingShareCourseId(null) : openShareEditor(course))}
                                  >
                                    {isEditing ? "Cancel" : "Configure"}
                                  </Button>
                                </div>
                              </div>

                              {isEditing ? (
                                <div className="mt-4 space-y-4 border-t border-[var(--border)] pt-4">
                                  <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-3">
                                    <div>
                                      <p className={cn("text-sm font-medium", PORTAL_TEXT)}>List in Discover</p>
                                      <p className="text-xs text-[var(--cc-text-secondary)]">
                                        Shown as “{course.courseTitle}”. Student results are never included.
                                      </p>
                                    </div>
                                    <Switch
                                      checked={draftSharingMode === "request_only"}
                                      onCheckedChange={(on) => setDraftSharingMode(on ? "request_only" : "off")}
                                      className={chrome.switchChecked}
                                    />
                                  </div>
                                  {draftSharingMode === "request_only" ? (
                                    <>
                                      <div className="space-y-2">
                                        <Label>Modules others can request</Label>
                                        <ModulePicker
                                          selected={draftShareableModules}
                                          onChange={setDraftShareableModules}
                                          defaults={COURSE_EXCHANGE_DEFAULT_APPROVAL_MODULES}
                                        />
                                      </div>
                                      <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-3">
                                        <div>
                                          <p className={cn("text-sm font-medium", PORTAL_TEXT)}>Auto-approve requests</p>
                                          <p className="text-xs text-[var(--cc-text-secondary)]">
                                            Instantly import only the modules they selected into their course. Still logged for you.
                                          </p>
                                        </div>
                                        <Switch
                                          checked={draftAutoApprove}
                                          onCheckedChange={setDraftAutoApprove}
                                          className={chrome.switchChecked}
                                        />
                                      </div>
                                    </>
                                  ) : null}
                                  <Button className={cn("w-full sm:w-auto", chrome.solid)} disabled={loading} onClick={() => void saveSharingSettings()}>
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Save sharing settings
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {accessLog.length > 0 ? (
                    <div className="space-y-3 pt-2">
                      <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>Who accessed your materials</h3>
                      <div className={cn("overflow-hidden rounded-2xl border border-[var(--border)]", chrome.card)}>
                        <div className="divide-y divide-[var(--border)]">
                          {accessLog.slice(0, 40).map((ev, index) => {
                            const stripe = portalListStripe(index, chrome.theme.family)
                            return (
                              <div key={ev.id} className="flex items-start gap-3 px-3 py-3 sm:px-4">
                                <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", stripe.iconBg, stripe.iconText)}>
                                  <Share2 className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className={cn("text-sm font-medium", PORTAL_TEXT)}>
                                    {ev.requesterName}
                                    <span className={cn("font-normal", PORTAL_TEXT_MUTED)}> · {ev.eventType.replace(/_/g, " ")}</span>
                                    {ev.autoApproved ? (
                                      <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                                        auto
                                      </span>
                                    ) : null}
                                  </p>
                                  <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                                    {ev.courseCode} — {ev.courseTitle}
                                  </p>
                                  <p className={cn("mt-0.5 text-[11px]", PORTAL_TEXT_MUTED)}>
                                    {ev.modules.map((m) => COURSE_EXCHANGE_MODULE_LABELS[m]).join(", ") || "—"}
                                  </p>
                                  <p className={cn("text-[11px]", PORTAL_TEXT_MUTED)}>
                                    {new Date(ev.createdAt).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </FacultyModuleSplitLayout>

          <CourseExchangeUpdateSheet
            copyId={updateCopyId}
            open={updateCopyId != null}
            onOpenChange={(open) => {
              if (!open) setUpdateCopyId(null)
            }}
            onApplied={() => void loadCopies()}
          />

          <CourseExchangeDiscoverSheet
            course={drawerCourse}
            open={Boolean(drawerCourse)}
            onOpenChange={(open) => {
              if (!open) setDrawerCourse(null)
            }}
            destinationCourses={destinationCourseOptions.map((c) => ({
              course_id: c.course_id,
              course_code: c.course_code,
              course_title: c.course_title,
            }))}
            preferredDestinationCourseId={preferredDestinationForDrawer}
            loading={loading}
            onSubmit={async (payload) => {
              await submitDiscoverRequest(payload)
            }}
          />

          <CourseExchangeRequestSheet
            request={detailRequest}
            mode={detailRequestMode}
            open={Boolean(detailRequest)}
            onOpenChange={(open) => {
              if (!open) setDetailRequest(null)
            }}
            destinationLabel={detailDestinationLabel}
            loading={loading}
            onImport={
              detailRequest && detailRequestMode === "sent"
                ? () => {
                    setImportRequest(detailRequest)
                    setImportResult(null)
                    setDestinationCourseId(
                      detailRequest.destination_course_id ? String(detailRequest.destination_course_id) : "",
                    )
                    setDestinationSessionId(
                      detailRequest.destination_session_id ? String(detailRequest.destination_session_id) : "",
                    )
                    setDetailRequest(null)
                  }
                : undefined
            }
            onReview={
              detailRequest && detailRequestMode === "received"
                ? () => {
                    const pending = detailRequest.pendingSupplementModules ?? []
                    setReviewRequest(detailRequest)
                    setApprovalModules(
                      pending.length > 0
                        ? pending
                        : detailRequest.approved_modules?.length
                          ? [...detailRequest.approved_modules]
                          : [...COURSE_EXCHANGE_DEFAULT_APPROVAL_MODULES],
                    )
                    setDetailRequest(null)
                  }
                : undefined
            }
            onViewSharedWithMe={
              detailRequest && detailRequestMode === "sent"
                ? () => {
                    setDetailRequest(null)
                    setTab("shared-with-me")
                  }
                : undefined
            }
            onSupplement={
              detailRequest && detailRequestMode === "sent"
                ? async (modules) => {
                    await submitRequestSupplement(detailRequest.id, modules)
                  }
                : undefined
            }
          />

          {reviewRequest ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              onClick={() => setReviewRequest(null)}
            >
              <div
                className={cn("relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-[var(--card)] p-5 shadow-lg", chrome.card)}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className={cn("text-lg font-semibold", PORTAL_TEXT)}>Share course materials</h3>
                    <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
                      Requested by {reviewRequest.requesterName} · {reviewRequest.courseCode}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-lg border-[var(--border)] bg-[var(--card)]"
                    aria-label="Close"
                    onClick={() => setReviewRequest(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <CourseExchangeGuidanceCallout kind="owner-sharing" className="my-3" dismissId="exchange:review:owner" autoDismissMs={0} />
                <div className="my-4">
                  <Label className="mb-2 block">Select content to share</Label>
                  <ModulePicker
                    selected={approvalModules}
                    onChange={setApprovalModules}
                    defaults={COURSE_EXCHANGE_DEFAULT_APPROVAL_MODULES}
                    allowed={
                      reviewRequest.shareableModules?.length
                        ? reviewRequest.shareableModules
                        : COURSE_EXCHANGE_DEFAULT_APPROVAL_MODULES
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setReviewRequest(null)}>
                    Cancel
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => void rejectRequest(reviewRequest.id)}>
                    Reject
                  </Button>
                  <Button className={cn("flex-1", chrome.solid)} onClick={() => void approveRequest()}>
                    Approve
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {importRequest ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className={cn("max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-[var(--card)] p-5 shadow-lg", chrome.card)}>
                <h3 className={cn("text-lg font-semibold", PORTAL_TEXT)}>Import approved course</h3>
                <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
                  {importRequest.courseCode} · Approved:{" "}
                  {(importRequest.approved_modules ?? []).map((m) => COURSE_EXCHANGE_MODULE_LABELS[m]).join(", ")}
                </p>
                {!importResult ? (
                  <div className="my-4 space-y-3">
                    <CourseExchangeGuidanceCallout kind="destination-shell" dismissId="exchange:import:shell" autoDismissMs={0} />
                    <div className="space-y-1">
                      <Label>Destination course</Label>
                      <Select value={destinationCourseId} onValueChange={setDestinationCourseId}>
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Select course" />
                        </SelectTrigger>
                        <SelectContent>
                          {destinationCourseOptions.map((c) => (
                            <SelectItem key={c.course_id} value={String(c.course_id)}>
                              {c.course_code} — {c.course_title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Section (optional)</Label>
                      {importHasGroupsProjects ? (
                        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                          {ownGroupsProjectsSessionMessage()} Other modules can still import into those sections.
                        </p>
                      ) : null}
                      <Select value={destinationSessionId} onValueChange={setDestinationSessionId}>
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Select section" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredSessions.map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setImportRequest(null)}>
                        Cancel
                      </Button>
                      <Button
                        className={cn("flex-1", chrome.solid)}
                        disabled={!destinationCourseId}
                        onClick={() => void executeImport()}
                      >
                        Create copy
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="my-4 space-y-3">
                    <p className={cn("flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300")}>
                      <Check className="h-4 w-4" /> Course copied successfully
                    </p>
                    {importResult.provenance ? (
                      <CourseExchangeProvenanceBanner
                        provenance={importResult.provenance}
                        cloneSummary={importResult.cloneSummary ?? null}
                      />
                    ) : null}
                    <CourseExchangeGuidanceCallout kind="post-import-review" dismissId="exchange:import:review" autoDismissMs={0} />
                    <Button className={cn("mt-2 w-full", chrome.solid)} onClick={() => setImportRequest(null)}>
                      Done
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
