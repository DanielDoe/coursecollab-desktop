"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  AlertTriangle,
  Bot,
  Bug,
  CheckCircle,
  Copy,
  Eye,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react"
import { buildPortalApiHeaders } from "@/lib/admin-api-headers"
import type { RemediationJobStatus } from "@/lib/ai-remediation-constants"
import {
  LOG_CATEGORIES,
  LOG_SEVERITIES,
  categoryLabel,
  environmentSourceBadgeVariant,
  environmentSourceLabel,
  isDevLogEnvironment,
  groupStatusBadgeVariant,
  groupStatusLabel,
  normalizeGroupStatus,
  severityLabel,
  type SystemLogGroupRow,
  type SystemLogRow,
} from "@/lib/system-log-constants"
import { SystemLogDetailModal } from "@/components/admin/SystemLogDetailModal"
import { formatGroupForClaude } from "@/lib/system-log-diagnostics"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type StatsPayload = {
  today: { errors_today: number; critical_today: number; error_level_today: number }
  needsAttentionIssues: number
  openIssues: number
  resolvedIssues: number
  topModules: { module_name: string; count: number }[]
  topErrors: { title: string; fingerprint: string; count: number }[]
  distinctModules: string[]
  distinctEnvironments: string[]
}

type RemediationJobRow = {
  id: number
  group_id: number
  status: RemediationJobStatus
  priority: string
  group_title?: string
  group_status?: string
  commit_hash?: string | null
  error_message?: string | null
  requires_human_reason?: string | null
  updated_at: string
}

const DEFAULT_EVENTS_PAGE_SIZE = 25
const DEFAULT_GROUP_PAGE_SIZE = 15
const PAGE_SIZE_OPTIONS = [10, 15, 25, 50, 100] as const
const BTN = "h-9 w-full px-3 text-sm sm:w-auto"
const TOOLBAR_BTN =
  "h-9 w-full justify-center px-3 text-sm sm:w-auto sm:shrink-0 sm:justify-start"
const FILTER_BTN =
  "h-9 w-full px-2.5 text-xs sm:w-auto sm:min-w-[7rem] sm:px-3 sm:text-sm"
const HEADER_BTN =
  "h-10 w-full justify-center gap-2 rounded-xl border-slate-200/80 px-3 text-sm dark:border-white/10 sm:h-9 sm:w-auto sm:justify-start"
const REFRESH_MS = 30_000
const CELL = "overflow-hidden whitespace-normal px-3 py-2.5"

function getVisiblePages(current: number, total: number): number[] {
  if (total <= 1) return total === 0 ? [] : [1]
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set([1, total, current, current - 1, current + 1])
  if (current <= 3) {
    pages.add(2)
    pages.add(3)
  }
  if (current >= total - 2) {
    pages.add(total - 1)
    pages.add(total - 2)
  }
  return [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
}

function TablePager({
  total,
  offset,
  pageSize,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  onPageChange,
  onPageSizeChange,
}: {
  total: number
  offset: number
  pageSize: number
  pageSizeOptions?: readonly number[]
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
}) {
  const currentPage = Math.floor(offset / pageSize) + 1
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const rangeStart = total === 0 ? 0 : offset + 1
  const rangeEnd = Math.min(offset + pageSize, total)
  const visiblePages = getVisiblePages(currentPage, totalPages)

  const goToPage = (page: number) => {
    onPageChange(Math.min(totalPages, Math.max(1, page)))
  }

  return (
    <div className="flex flex-col gap-2 border-t border-slate-200/80 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3 sm:px-4 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:justify-start">
        <p className="text-xs text-muted-foreground">
          {total === 0
            ? "No results"
            : `Showing ${rangeStart}–${rangeEnd} of ${total.toLocaleString()}`}
        </p>
        {onPageSizeChange ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Rows</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-[4.25rem] text-xs" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1 sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hidden h-8 px-2.5 sm:inline-flex"
          disabled={currentPage <= 1}
          onClick={() => goToPage(1)}
          title="First page"
        >
          «
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2 sm:px-3"
          disabled={currentPage <= 1}
          onClick={() => goToPage(currentPage - 1)}
        >
          <span className="sm:hidden">Prev</span>
          <span className="hidden sm:inline">Previous</span>
        </Button>
        {visiblePages.map((page, index) => {
          const prev = visiblePages[index - 1]
          const showEllipsis = prev != null && page - prev > 1
          return (
            <span key={page} className="inline-flex items-center gap-1">
              {showEllipsis && <span className="px-1 text-xs text-muted-foreground">…</span>}
              <Button
                type="button"
                variant={page === currentPage ? "default" : "outline"}
                size="sm"
                className="h-8 min-w-8 px-2"
                onClick={() => goToPage(page)}
              >
                {page}
              </Button>
            </span>
          )
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2 sm:px-3"
          disabled={currentPage >= totalPages || total === 0}
          onClick={() => goToPage(currentPage + 1)}
        >
          Next
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hidden h-8 px-2.5 sm:inline-flex"
          disabled={currentPage >= totalPages || total === 0}
          onClick={() => goToPage(totalPages)}
          title="Last page"
        >
          »
        </Button>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  active = false,
  onClick,
}: {
  label: string
  value: number | string
  icon: LucideIcon
  tone?: "default" | "danger" | "warning" | "violet"
  active?: boolean
  onClick?: () => void
}) {
  const tones = {
    default: "text-foreground",
    danger: "text-destructive",
    warning: "text-amber-600 dark:text-amber-400",
    violet: "text-violet-600 dark:text-violet-400",
  }
  const icons = {
    default: "bg-slate-100 text-slate-600 dark:bg-white/10",
    danger: "bg-red-100 text-red-600 dark:bg-red-500/15",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-500/15",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15",
  }
  const Comp = onClick ? "button" : "div"
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-xl border bg-background px-4 py-3.5 text-left shadow-sm transition-colors",
        "border-slate-200/80 dark:border-white/10",
        onClick && "cursor-pointer hover:border-[var(--cc-accent-border)] hover:bg-[var(--cc-accent-soft)]",
        active && "border-[var(--cc-accent-border)] ring-2 ring-[var(--cc-accent-soft)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tones[tone])}>{value}</p>
        </div>
        <div className={cn("rounded-lg p-2", icons[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Comp>
  )
}

function severityBadgeVariant(severity: string): "destructive" | "secondary" | "default" | "outline" {
  if (severity === "critical" || severity === "error") return "destructive"
  if (severity === "warning") return "secondary"
  return "outline"
}

function remediationStatusLabel(status: RemediationJobStatus): string {
  return status.replace(/_/g, " ")
}

function remediationStatusVariant(
  status: RemediationJobStatus,
): "destructive" | "secondary" | "default" | "outline" {
  if (status === "failed") return "destructive"
  if (status === "requires_human_review") return "secondary"
  if (status === "completed") return "default"
  if (status === "queued") return "outline"
  return "secondary"
}

interface SystemLogsContentProps {
  embedInDashboard?: boolean
  portal?: "admin" | "instructor"
}

export function SystemLogsContent({
  embedInDashboard = false,
  portal = "admin",
}: SystemLogsContentProps) {
  const { toast } = useToast()

  const [logs, setLogs] = useState<SystemLogRow[]>([])
  const [groups, setGroups] = useState<SystemLogGroupRow[]>([])
  const [groupTotal, setGroupTotal] = useState(0)
  const [groupOffset, setGroupOffset] = useState(0)
  const [groupPageSize, setGroupPageSize] = useState(DEFAULT_GROUP_PAGE_SIZE)
  const [eventsPageSize, setEventsPageSize] = useState(DEFAULT_EVENTS_PAGE_SIZE)
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [remediationJobs, setRemediationJobs] = useState<RemediationJobRow[]>([])
  const [remediationSummary, setRemediationSummary] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [remediationLoading, setRemediationLoading] = useState(false)
  const [devResolveLoading, setDevResolveLoading] = useState(false)
  const [stats, setStats] = useState<StatsPayload | null>(null)
  const [activeTab, setActiveTab] = useState("issues")

  const [severity, setSeverity] = useState("all")
  const [category, setCategory] = useState("all")
  const [module, setModule] = useState("all")
  const [environment, setEnvironment] = useState("all")
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [groupStatus, setGroupStatus] = useState("open")

  const [selectedLogId, setSelectedLogId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<SystemLogGroupRow | null>(null)
  const [selectedGroupSample, setSelectedGroupSample] = useState<SystemLogRow | null>(null)
  const [groupSampleLoading, setGroupSampleLoading] = useState(false)
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [assignedTo, setAssignedTo] = useState("")
  const detailPanelRef = useRef<HTMLDivElement>(null)

  const queryString = useMemo(() => {
    const p = new URLSearchParams()
    p.set("limit", String(eventsPageSize))
    p.set("offset", String(offset))
    if (severity !== "all") p.set("severity", severity)
    if (category !== "all") p.set("category", category)
    if (module !== "all") p.set("module", module)
    if (environment !== "all") p.set("environment", environment)
    if (search.trim()) p.set("search", search.trim())
    if (dateFrom) p.set("dateFrom", dateFrom)
    if (dateTo) p.set("dateTo", dateTo)
    return p.toString()
  }, [severity, category, module, environment, search, dateFrom, dateTo, offset, eventsPageSize])

  const jobByGroupId = useMemo(() => {
    const map = new Map<number, RemediationJobRow>()
    for (const j of remediationJobs) {
      const prev = map.get(j.group_id)
      if (!prev || j.updated_at > prev.updated_at) map.set(j.group_id, j)
    }
    return map
  }, [remediationJobs])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const headers = buildPortalApiHeaders(portal)
      const [logsRes, statsRes] = await Promise.all([
        fetch(`/api/admin/system-logs?${queryString}`, { headers, cache: "no-store" }),
        fetch("/api/admin/system-logs/stats", { headers, cache: "no-store" }),
      ])
      if (logsRes.ok) {
        const data = await logsRes.json()
        setLogs(data.logs ?? [])
        setTotal(data.total ?? 0)
      }
      if (statsRes.ok) {
        setStats(await statsRes.json())
      }
    } catch {
      toast({ title: "Failed to load system logs", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [queryString, portal, toast])

  const fetchGroups = useCallback(async () => {
    setGroupsLoading(true)
    try {
      const headers = buildPortalApiHeaders(portal)
      const params = new URLSearchParams({
        status: groupStatus,
        limit: String(groupPageSize),
        offset: String(groupOffset),
      })
      const res = await fetch(`/api/admin/system-logs/groups?${params}`, { headers, cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setGroups(data.groups ?? [])
        setGroupTotal(data.total ?? 0)
      }
    } catch {
      /* silent */
    } finally {
      setGroupsLoading(false)
    }
  }, [groupStatus, groupOffset, groupPageSize, portal])

  const fetchRemediation = useCallback(async () => {
    try {
      const headers = buildPortalApiHeaders(portal)
      const res = await fetch("/api/admin/system-logs/remediation", { headers, cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setRemediationJobs(data.jobs ?? [])
        setRemediationSummary(data.summary ?? {})
      }
    } catch {
      /* silent */
    }
  }, [portal])

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchLogs(), fetchGroups(), fetchRemediation()])
  }, [fetchLogs, fetchGroups, fetchRemediation])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  useEffect(() => {
    void fetchGroups()
    void fetchRemediation()
  }, [fetchGroups, fetchRemediation])

  useEffect(() => {
    setGroupOffset(0)
    setSelectedGroup(null)
    setSelectedGroupSample(null)
  }, [groupStatus])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (activeTab === "issues" || activeTab === "remediation") {
        void fetchGroups()
        void fetchRemediation()
        void fetchLogs()
      }
    }, REFRESH_MS)
    return () => window.clearInterval(id)
  }, [activeTab, fetchGroups, fetchRemediation, fetchLogs])

  const clearOldLogs = async () => {
    const olderThan = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    try {
      const headers = buildPortalApiHeaders(portal)
      const res = await fetch("/api/admin/system-logs", {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ olderThan }),
      })
      if (res.ok) {
        const data = await res.json()
        toast({ title: `Deleted ${data.deletedCount} old log entries` })
        void fetchLogs()
      }
    } catch {
      toast({ title: "Failed to clear logs", variant: "destructive" })
    }
  }

  const openDevIssueCount = useMemo(
    () =>
      groups.filter(
        (g) =>
          normalizeGroupStatus(g.status) === "open" &&
          isDevLogEnvironment(g.latest_environment),
      ).length,
    [groups],
  )

  const resolveAllDevOpen = async () => {
    const countHint =
      openDevIssueCount > 0
        ? `${openDevIssueCount} open dev issue(s) on this page`
        : "all open dev issues (localhost/preview)"
    if (
      !window.confirm(
        `Resolve ${countHint}? Production issues are not affected. Dev groups auto-close after 30 min quiet anyway.`,
      )
    ) {
      return
    }
    setDevResolveLoading(true)
    try {
      const headers = buildPortalApiHeaders(portal)
      const res = await fetch("/api/admin/system-logs/remediation", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve-dev-open" }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        resolvedCount?: number
        error?: string
        message?: string
      }
      if (!res.ok) {
        throw new Error(data.error ?? data.message ?? `Request failed (${res.status})`)
      }
      toast({
        title: `Resolved ${data.resolvedCount ?? 0} dev issue(s)`,
        description: data.message ?? "Issues list refreshed.",
      })
      void fetchGroups()
      void fetchRemediation()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      toast({
        title: "Failed to resolve dev issues",
        description: message,
        variant: "destructive",
      })
    } finally {
      setDevResolveLoading(false)
    }
  }

  const scanRemediation = async () => {
    setRemediationLoading(true)
    try {
      const headers = buildPortalApiHeaders(portal)
      const res = await fetch("/api/admin/system-logs/remediation", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan" }),
      })
      if (res.ok) {
        const data = await res.json()
        toast({ title: `Enqueued ${data.enqueued ?? 0} open issue(s) for AI remediation` })
        setRemediationJobs(data.jobs ?? [])
        setRemediationSummary(data.summary ?? {})
      }
    } catch {
      toast({ title: "Failed to scan for remediation", variant: "destructive" })
    } finally {
      setRemediationLoading(false)
    }
  }

  const fetchGroupSample = useCallback(
    async (groupId: number) => {
      setGroupSampleLoading(true)
      try {
        const headers = buildPortalApiHeaders(portal)
        const res = await fetch(`/api/admin/system-logs/groups/${groupId}`, { headers, cache: "no-store" })
        if (!res.ok) throw new Error("Failed to load group sample")
        const data = await res.json()
        setSelectedGroupSample(data.latestLog ?? null)
      } catch {
        setSelectedGroupSample(null)
      } finally {
        setGroupSampleLoading(false)
      }
    },
    [portal],
  )

  const copyGroupsForClaude = async (status: "needs_attention" | "open", label: string) => {
    try {
      const headers = buildPortalApiHeaders(portal)
      const res = await fetch(`/api/admin/system-logs/groups?status=${status}&limit=500`, { headers, cache: "no-store" })
      if (!res.ok) throw new Error(`Failed to load ${label} issues`)
      const data = await res.json()
      const list: SystemLogGroupRow[] = data.groups ?? []
      if (list.length === 0) {
        toast({ title: `No ${label.toLowerCase()} issues to copy` })
        return
      }

      const samples = await Promise.all(
        list.map(async (g) => {
          try {
            const detailRes = await fetch(`/api/admin/system-logs/groups/${g.id}`, { headers })
            if (!detailRes.ok) return { g, sample: null as SystemLogRow | null }
            const detail = await detailRes.json()
            return { g, sample: (detail.latestLog ?? null) as SystemLogRow | null }
          } catch {
            return { g, sample: null as SystemLogRow | null }
          }
        }),
      )

      const text = [
        `# CourseCollab — ${label} Issues`,
        "",
        `Generated: ${new Date().toISOString()}`,
        `Count: ${list.length}`,
        status === "needs_attention"
          ? "Review these first. Promote confirmed bugs to Open after triage."
          : "Fix these — confirmed open issues for investigation.",
        "",
        ...samples.map(({ g, sample }, i) => `## ${i + 1}. ${formatGroupForClaude(g, sample)}`),
      ].join("\n\n")
      await navigator.clipboard.writeText(text)
      toast({ title: `Copied ${list.length} ${label.toLowerCase()} issue(s) with diagnostics` })
    } catch {
      toast({ title: `Failed to copy ${label.toLowerCase()} issues`, variant: "destructive" })
    }
  }

  const updateGroup = async (groupId: number, status: string) => {
    try {
      const headers = buildPortalApiHeaders(portal)
      const res = await fetch("/api/admin/system-logs/groups", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          status,
          assignedTo: assignedTo || null,
          resolutionNotes: resolutionNotes || null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        toast({
          title:
            status === "resolved"
              ? "Issue marked resolved"
              : status === "open"
                ? data.remediationEnqueued
                  ? "Promoted to open — AI job enqueued"
                  : "Promoted to open"
                : status === "needs_attention"
                  ? "Moved to needs attention"
                  : "Issue updated",
        })
        setSelectedGroup(null)
        setSelectedGroupSample(null)
        setResolutionNotes("")
        void fetchGroups()
        void fetchLogs()
        void fetchRemediation()
      }
    } catch {
      toast({ title: "Failed to update issue", variant: "destructive" })
    }
  }

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago" })
    } catch {
      return iso
    }
  }

  const formatShortTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-US", {
        timeZone: "America/Chicago",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    } catch {
      return iso
    }
  }

  const selectGroup = (g: SystemLogGroupRow) => {
    setSelectedGroup(g)
    setAssignedTo(g.assigned_to ?? "")
    setResolutionNotes(g.resolution_notes ?? "")
    void fetchGroupSample(g.id)
    requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 1023px)").matches) {
        detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    })
  }

  const copySelectedGroupForClaude = () => {
    if (!selectedGroup) return
    const text = formatGroupForClaude(selectedGroup, selectedGroupSample)
    void navigator.clipboard.writeText(text)
    toast({ title: "Copied issue diagnostics for Claude" })
  }

  const statusFilters = [
    { id: "needs_attention", label: "Needs attention" },
    { id: "open", label: "Open" },
    { id: "resolved", label: "Resolved" },
    { id: "all", label: "All" },
  ] as const

  return (
    <div className={cn("w-full min-w-0 space-y-5", embedInDashboard && "sm:space-y-6")}>
      <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2
            className={cn(
              "font-semibold tracking-tight text-slate-900 dark:text-slate-50",
              embedInDashboard ? "text-lg sm:text-xl" : "text-xl sm:text-2xl",
            )}
          >
            System Logs
          </h2>
          <p className="mt-1 max-w-2xl text-xs sm:text-sm text-muted-foreground">
            Track grouped issues, AI remediation jobs, and raw events. Resolving an issue updates
            workflow status — historical log entries remain for audit.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:gap-2">
          <Button variant="outline" className={HEADER_BTN} onClick={() => void refreshAll()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" className={HEADER_BTN} onClick={() => void clearOldLogs()}>
            <Trash2 className="h-4 w-4" />
            Clear 30d+
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            label="Needs attention"
            value={stats.needsAttentionIssues}
            icon={AlertTriangle}
            tone="warning"
            active={groupStatus === "needs_attention"}
            onClick={() => {
              setGroupStatus("needs_attention")
              setActiveTab("issues")
            }}
          />
          <KpiCard
            label="Open issues"
            value={stats.openIssues}
            icon={Bug}
            tone="violet"
            active={groupStatus === "open"}
            onClick={() => {
              setGroupStatus("open")
              setActiveTab("issues")
            }}
          />
          <KpiCard
            label="Resolved"
            value={stats.resolvedIssues}
            icon={CheckCircle}
            active={groupStatus === "resolved"}
            onClick={() => {
              setGroupStatus("resolved")
              setActiveTab("issues")
            }}
          />
          <KpiCard
            label="Errors today"
            value={stats.today.error_level_today}
            icon={XCircle}
            tone="danger"
            onClick={() => setActiveTab("events")}
          />
          <KpiCard
            label="Critical today"
            value={stats.today.critical_today}
            icon={Zap}
            tone="warning"
            onClick={() => setActiveTab("events")}
          />
          <KpiCard
            label="Total events"
            value={stats.today.errors_today}
            icon={FileText}
            onClick={() => setActiveTab("events")}
          />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 p-1 sm:inline-flex sm:h-10 sm:w-auto sm:justify-start">
          <TabsTrigger value="issues" className="h-9 px-2 text-xs sm:px-4 sm:text-sm">
            Issues
          </TabsTrigger>
          <TabsTrigger value="remediation" className="h-9 px-2 text-xs sm:px-4 sm:text-sm">
            <span className="sm:hidden">AI fix</span>
            <span className="hidden sm:inline">AI remediation</span>
          </TabsTrigger>
          <TabsTrigger value="events" className="h-9 px-2 text-xs sm:px-4 sm:text-sm">
            Events
          </TabsTrigger>
        </TabsList>

        <TabsContent value="issues" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 p-1 dark:border-white/10 sm:inline-flex sm:gap-0">
              {statusFilters.map((s) => (
                <Button
                  key={s.id}
                  type="button"
                  variant={groupStatus === s.id ? "default" : "ghost"}
                  className={FILTER_BTN}
                  onClick={() => setGroupStatus(s.id)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
              <Button
                variant="outline"
                className={TOOLBAR_BTN}
                onClick={() => void copyGroupsForClaude("needs_attention", "Needs attention")}
              >
                <Copy className="mr-1.5 h-4 w-4 shrink-0" />
                Copy triage
              </Button>
              <Button
                variant="outline"
                className={TOOLBAR_BTN}
                onClick={() => void copyGroupsForClaude("open", "Open")}
              >
                <Copy className="mr-1.5 h-4 w-4 shrink-0" />
                Copy open
              </Button>
              <Button
                variant="outline"
                className={TOOLBAR_BTN}
                onClick={() => void resolveAllDevOpen()}
                disabled={devResolveLoading}
                title="Mark all open localhost/preview issues resolved"
              >
                {devResolveLoading ? (
                  <Loader2 className="mr-1.5 h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <CheckCircle className="mr-1.5 h-4 w-4 shrink-0" />
                )}
                Resolve Dev
                {openDevIssueCount > 0 ? ` (${openDevIssueCount})` : ""}
              </Button>
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_min(340px,38%)]">
            <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200/80 bg-card dark:border-white/10">
              <div className="border-b px-3 py-3 sm:px-4">
                <p className="text-sm font-medium">Issues</p>
                <p className="text-xs text-muted-foreground">
                  <span className="lg:hidden">Tap a row — details appear below.</span>
                  <span className="hidden lg:inline">Select a row — full diagnostics appear in the panel →</span>
                </p>
              </div>
              {groupsLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : groups.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  {groupStatus === "needs_attention"
                    ? "No items need attention."
                    : groupStatus === "open"
                      ? "No open issues."
                      : groupStatus === "resolved"
                        ? "No resolved issues yet."
                        : "No grouped issues found."}
                </div>
              ) : (
                <>
                  <div className="space-y-3 p-3 md:hidden">
                    {groups.map((g) => {
                      const selected = selectedGroup?.id === g.id
                      const job = jobByGroupId.get(g.id)
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => selectGroup(g)}
                          className={cn(
                            "w-full rounded-xl border border-slate-200/80 bg-background p-3.5 text-left shadow-sm transition-colors hover:bg-muted/30 active:bg-muted/40 dark:border-white/10",
                            selected && "ring-2 ring-[var(--cc-accent-soft)] bg-[var(--cc-accent-soft)]",
                          )}
                        >
                          <div className="mb-2 flex flex-wrap items-center gap-1.5">
                            <Badge variant={severityBadgeVariant(g.severity)} className="text-[10px]">
                              {g.severity}
                            </Badge>
                            <Badge
                              variant={environmentSourceBadgeVariant(g.latest_environment)}
                              className="text-[10px]"
                            >
                              {environmentSourceLabel(g.latest_environment)}
                            </Badge>
                            {groupStatus === "all" && (
                              <Badge variant={groupStatusBadgeVariant(g.status)} className="text-[10px]">
                                {groupStatusLabel(g.status)}
                              </Badge>
                            )}
                          </div>
                          <p className="line-clamp-2 text-sm font-medium leading-snug">{g.title}</p>
                          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                            <span>
                              #{g.id} · {g.occurrence_count.toLocaleString()} events
                              {job ? ` · ${remediationStatusLabel(job.status)}` : ""}
                            </span>
                            <span className="shrink-0 whitespace-nowrap">
                              {formatShortTime(g.last_seen_at)}
                            </span>
                          </div>
                          {g.module_name ? (
                            <p className="mt-1 truncate text-[11px] text-muted-foreground">{g.module_name}</p>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                  <Table className="hidden w-full table-fixed md:table md:min-w-0">
                  <colgroup>
                    <col style={{ width: "72px" }} />
                    <col style={{ width: "52px" }} />
                    <col />
                    <col className="hidden md:table-column" style={{ width: "22%" }} />
                    <col style={{ width: "48px" }} />
                    <col className="hidden lg:table-column" style={{ width: "100px" }} />
                  </colgroup>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-[var(--cc-accent-soft)]/45">
                      <TableHead className="px-2 sm:px-3">Severity</TableHead>
                      <TableHead className="px-2 text-center">Env</TableHead>
                      <TableHead className="px-2 sm:px-3">Issue</TableHead>
                      <TableHead className="hidden px-3 md:table-cell">Module</TableHead>
                      <TableHead className="px-2 text-right">#</TableHead>
                      <TableHead className="hidden px-3 text-right lg:table-cell">Last seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.map((g) => {
                      const selected = selectedGroup?.id === g.id
                      const job = jobByGroupId.get(g.id)
                      return (
                        <TableRow
                          key={g.id}
                          className={cn(
                            "cursor-pointer",
                            selected && "bg-[var(--cc-accent-soft)] hover:bg-[var(--cc-accent-soft)]",
                          )}
                          onClick={() => selectGroup(g)}
                        >
                          <TableCell className={CELL}>
                            <Badge variant={severityBadgeVariant(g.severity)} className="text-[10px]">
                              {g.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className={cn(CELL, "px-2 text-center")}>
                            <Badge
                              variant={environmentSourceBadgeVariant(g.latest_environment)}
                              className="text-[10px]"
                              title={g.latest_environment ?? "Unknown environment"}
                            >
                              {environmentSourceLabel(g.latest_environment)}
                            </Badge>
                          </TableCell>
                          <TableCell className={CELL}>
                            <div className="flex min-w-0 items-center gap-1.5">
                              {groupStatus === "all" && (
                                <Badge
                                  variant={groupStatusBadgeVariant(g.status)}
                                  className="shrink-0 text-[10px]"
                                >
                                  {groupStatusLabel(g.status)}
                                </Badge>
                              )}
                              <p className="truncate text-sm font-medium leading-snug" title={g.title}>
                                {g.title}
                              </p>
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              #{g.id}
                              {job ? ` · ${remediationStatusLabel(job.status)}` : ""}
                              {g.module_name ? (
                                <span className="md:hidden"> · {g.module_name}</span>
                              ) : null}
                            </p>
                          </TableCell>
                          <TableCell className={cn(CELL, "hidden md:table-cell")}>
                            <p
                              className="truncate text-xs text-muted-foreground"
                              title={g.module_name ?? undefined}
                            >
                              {g.module_name ?? "—"}
                            </p>
                          </TableCell>
                          <TableCell
                            className={cn(
                              CELL,
                              "px-2 text-right text-sm tabular-nums text-muted-foreground",
                            )}
                          >
                            {g.occurrence_count.toLocaleString()}
                          </TableCell>
                          <TableCell
                            className={cn(CELL, "hidden text-right text-xs text-muted-foreground lg:table-cell")}
                          >
                            {formatShortTime(g.last_seen_at)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                </>
              )}
              <TablePager
                total={groupTotal}
                offset={groupOffset}
                pageSize={groupPageSize}
                onPageChange={(page) => setGroupOffset((page - 1) * groupPageSize)}
                onPageSizeChange={(size) => {
                  setGroupPageSize(size)
                  setGroupOffset(0)
                }}
              />
            </div>

            <div ref={detailPanelRef} className="min-w-0 scroll-mt-4">
            <Card
              className={cn(
                "h-fit gap-4 overflow-y-auto border-slate-200/80 py-4 dark:border-white/10",
                "lg:max-h-[calc(100vh-12rem)]",
                selectedGroup && "ring-2 ring-primary/15 lg:ring-0",
              )}
            >
              <CardHeader className="px-4 pb-3 sm:px-6">
                <CardTitle className="text-base">Issue detail & workflow</CardTitle>
                <CardDescription className="text-xs">
                  {selectedGroup
                    ? `Group #${selectedGroup.id} · ${selectedGroup.occurrence_count} events`
                    : "Select an issue — diagnostics load from the latest event"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 px-4 sm:px-6">
                {selectedGroup ? (
                  <>
                    <p className="text-sm font-medium leading-snug">{selectedGroup.title}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge
                        variant={environmentSourceBadgeVariant(
                          selectedGroupSample?.environment ?? selectedGroup.latest_environment,
                        )}
                        className="text-[10px]"
                      >
                        {environmentSourceLabel(
                          selectedGroupSample?.environment ?? selectedGroup.latest_environment,
                        )}
                        {(selectedGroupSample?.environment ?? selectedGroup.latest_environment)
                          ? ` (${selectedGroupSample?.environment ?? selectedGroup.latest_environment})`
                          : ""}
                      </Badge>
                      {selectedGroup.module_name && <span>{selectedGroup.module_name}</span>}
                      <span>Last seen {formatTime(selectedGroup.last_seen_at)}</span>
                      {jobByGroupId.get(selectedGroup.id) && (
                        <Badge
                          variant={remediationStatusVariant(jobByGroupId.get(selectedGroup.id)!.status)}
                          className="text-[10px]"
                        >
                          AI: {remediationStatusLabel(jobByGroupId.get(selectedGroup.id)!.status)}
                        </Badge>
                      )}
                    </div>

                    <div className="rounded-lg border border-slate-200/80 bg-muted/30 p-3 text-xs dark:border-white/10">
                      <p className="mb-2 font-semibold text-foreground">AI diagnostic context</p>
                      {groupSampleLoading ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Loading latest event…
                        </div>
                      ) : selectedGroupSample ? (
                        <div className="space-y-2 text-muted-foreground">
                          {selectedGroupSample.error_message && (
                            <p>
                              <span className="font-medium text-foreground">Error: </span>
                              {selectedGroupSample.error_message}
                            </p>
                          )}
                          {selectedGroupSample.description && (
                            <p>
                              <span className="font-medium text-foreground">Summary: </span>
                              {selectedGroupSample.description}
                            </p>
                          )}
                          {(selectedGroupSample.page_url || selectedGroupSample.route) && (
                            <p className="break-all">
                              <span className="font-medium text-foreground">URL: </span>
                              {selectedGroupSample.page_url ?? selectedGroupSample.route}
                            </p>
                          )}
                          {selectedGroupSample.api_endpoint && (
                            <p className="break-all">
                              <span className="font-medium text-foreground">API: </span>
                              {[selectedGroupSample.http_method, selectedGroupSample.api_endpoint, selectedGroupSample.http_status_code != null ? `→ ${selectedGroupSample.http_status_code}` : null]
                                .filter(Boolean)
                                .join(" ")}
                            </p>
                          )}
                          {(selectedGroupSample.user_name || selectedGroupSample.user_id) && (
                            <p>
                              <span className="font-medium text-foreground">User: </span>
                              {selectedGroupSample.user_name ?? selectedGroupSample.user_id}
                              {selectedGroupSample.user_role ? ` (${selectedGroupSample.user_role})` : ""}
                              {selectedGroupSample.course_id != null ? ` · course #${selectedGroupSample.course_id}` : ""}
                            </p>
                          )}
                          <p>
                            <span className="font-medium text-foreground">Log: </span>
                            #{selectedGroupSample.id} · {selectedGroupSample.log_id}
                          </p>
                          {selectedGroupSample.stack_trace && (
                            <pre className="max-h-28 overflow-auto rounded-md bg-slate-950 p-2 font-mono text-[10px] text-slate-200">
                              {selectedGroupSample.stack_trace.split("\n").slice(0, 6).join("\n")}
                            </pre>
                          )}
                          {selectedGroupSample.root_cause_hints?.length ? (
                            <ul className="list-inside list-disc space-y-0.5">
                              {selectedGroupSample.root_cause_hints.map((h) => (
                                <li key={h}>{h}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ) : (
                        <p>No events linked yet. Check the Events tab for raw logs.</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={copySelectedGroupForClaude}
                          disabled={!selectedGroup}
                        >
                          <Copy className="mr-1.5 h-3.5 w-3.5" />
                          Copy for Claude
                        </Button>
                        {selectedGroupSample && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => {
                              setSelectedLogId(selectedGroupSample.id)
                              setDetailOpen(true)
                            }}
                          >
                            <Eye className="mr-1.5 h-3.5 w-3.5" />
                            Full event
                          </Button>
                        )}
                      </div>
                    </div>

                    <Input
                      placeholder="Assign to developer..."
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      className="h-9 text-sm"
                    />
                    <Textarea
                      placeholder="Resolution notes..."
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      rows={4}
                      className="text-sm"
                    />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {normalizeGroupStatus(selectedGroup.status) === "needs_attention" && (
                        <Button className={BTN} onClick={() => void updateGroup(selectedGroup.id, "open")}>
                          Promote to open
                        </Button>
                      )}
                      {normalizeGroupStatus(selectedGroup.status) !== "resolved" && (
                        <Button
                          className={BTN}
                          variant={
                            normalizeGroupStatus(selectedGroup.status) === "open" ? "default" : "secondary"
                          }
                          onClick={() => void updateGroup(selectedGroup.id, "resolved")}
                        >
                          Mark resolved
                        </Button>
                      )}
                      {normalizeGroupStatus(selectedGroup.status) === "resolved" && (
                        <Button
                          className={BTN}
                          variant="secondary"
                          onClick={() => void updateGroup(selectedGroup.id, "open")}
                        >
                          Reopen
                        </Button>
                      )}
                      {normalizeGroupStatus(selectedGroup.status) === "open" && (
                        <Button
                          className={BTN}
                          variant="outline"
                          onClick={() => void updateGroup(selectedGroup.id, "needs_attention")}
                        >
                          Needs attention
                        </Button>
                      )}
                      <Button
                        className={BTN}
                        variant="outline"
                        onClick={() => void updateGroup(selectedGroup.id, selectedGroup.status)}
                      >
                        Save notes
                      </Button>
                    </div>
                    {jobByGroupId.get(selectedGroup.id)?.requires_human_reason && (
                      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                        AI: {jobByGroupId.get(selectedGroup.id)?.requires_human_reason}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Click a row to see URL, stack trace, API failures, user/course IDs, and workflow
                    actions. Use <strong>Events</strong> for the full searchable log history.
                  </p>
                )}
              </CardContent>
            </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="remediation" className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">AI remediation queue</p>
              <p className="text-xs text-muted-foreground">
                Cursor automation must call the resolve API after deploy — otherwise Issues tab stays
                unchanged.
              </p>
            </div>
            <Button
              className="h-10 w-full justify-center gap-2 rounded-xl sm:h-9 sm:w-auto sm:justify-start"
              onClick={() => void scanRemediation()}
              disabled={remediationLoading}
            >
              {remediationLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Enqueue open issues
            </Button>
          </div>

          {Object.keys(remediationSummary).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(remediationSummary)
                .filter(([, n]) => n > 0)
                .map(([status, count]) => (
                  <Badge key={status} variant="outline" className="h-8 px-3 text-xs">
                    {remediationStatusLabel(status as RemediationJobStatus)}: {count}
                  </Badge>
                ))}
            </div>
          )}

          <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200/80 bg-card dark:border-white/10">
            {remediationJobs.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                <Bot className="mx-auto mb-2 h-6 w-6 opacity-40" />
                No remediation jobs yet. Enqueue open issues or promote groups to Open.
              </div>
            ) : (
              <>
                <div className="space-y-3 p-3 md:hidden">
                  {remediationJobs.map((j) => (
                    <button
                      key={j.id}
                      type="button"
                      onClick={() => {
                        const g = groups.find((x) => x.id === j.group_id)
                        if (g) {
                          selectGroup(g)
                          setActiveTab("issues")
                        } else {
                          setGroupStatus("open")
                          setActiveTab("issues")
                        }
                      }}
                      className="w-full rounded-xl border border-slate-200/80 bg-background p-3.5 text-left shadow-sm transition-colors hover:bg-muted/30 active:bg-muted/40 dark:border-white/10"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        <Badge variant={remediationStatusVariant(j.status)} className="text-[10px]">
                          {remediationStatusLabel(j.status)}
                        </Badge>
                        {j.group_status ? (
                          <Badge variant={groupStatusBadgeVariant(j.group_status)} className="text-[10px]">
                            {groupStatusLabel(j.group_status)}
                          </Badge>
                        ) : null}
                        <span className="text-[11px] text-muted-foreground">Job #{j.id}</span>
                      </div>
                      <p className="line-clamp-2 text-sm font-medium">{j.group_title ?? "—"}</p>
                      {j.error_message ? (
                        <p className="mt-1 line-clamp-2 text-xs text-destructive">{j.error_message}</p>
                      ) : null}
                      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span>
                          Group #{j.group_id}
                          {j.priority ? ` · ${j.priority}` : ""}
                          {j.commit_hash ? ` · ${j.commit_hash.slice(0, 7)}` : ""}
                        </span>
                        <span className="shrink-0 whitespace-nowrap">{formatShortTime(j.updated_at)}</span>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
            <Table className="min-w-0 w-full">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-[var(--cc-accent-soft)]/45">
                  <TableHead className="w-[56px]">Job</TableHead>
                  <TableHead className="hidden w-[56px] sm:table-cell">Group</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead className="w-[110px]">Status</TableHead>
                  <TableHead className="hidden w-[90px] md:table-cell">Group UI</TableHead>
                  <TableHead className="hidden w-[72px] lg:table-cell">Priority</TableHead>
                  <TableHead className="hidden w-[72px] xl:table-cell">Commit</TableHead>
                  <TableHead className="hidden w-[100px] sm:table-cell">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {remediationJobs.map((j) => (
                  <TableRow
                    key={j.id}
                    className="cursor-pointer"
                    onClick={() => {
                      const g = groups.find((x) => x.id === j.group_id)
                      if (g) {
                        selectGroup(g)
                        setActiveTab("issues")
                      } else {
                        setGroupStatus("open")
                        setActiveTab("issues")
                      }
                    }}
                  >
                    <TableCell className="text-sm tabular-nums">#{j.id}</TableCell>
                    <TableCell className="hidden text-sm tabular-nums sm:table-cell">#{j.group_id}</TableCell>
                    <TableCell>
                      <p className="line-clamp-2 text-sm">{j.group_title ?? "—"}</p>
                      {j.error_message && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-destructive">{j.error_message}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={remediationStatusVariant(j.status)} className="text-xs">
                        {remediationStatusLabel(j.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {j.group_status ? (
                        <Badge variant={groupStatusBadgeVariant(j.group_status)} className="text-xs">
                          {groupStatusLabel(j.group_status)}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="hidden text-sm capitalize lg:table-cell">{j.priority}</TableCell>
                    <TableCell className="hidden font-mono text-xs xl:table-cell">
                      {j.commit_hash ? j.commit_hash.slice(0, 7) : "—"}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                      {formatShortTime(j.updated_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="events" className="mt-4 space-y-4">
          <div className="space-y-3">
            <div className="relative w-full min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search message, URL, endpoint, stack trace..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setOffset(0)
                }}
                className="h-9 pl-9 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Select value={severity} onValueChange={(v) => { setSeverity(v); setOffset(0) }}>
                <SelectTrigger className="h-9 w-full min-w-0 text-sm">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severities</SelectItem>
                  {LOG_SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s}>{severityLabel(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={category} onValueChange={(v) => { setCategory(v); setOffset(0) }}>
                <SelectTrigger className="h-9 w-full min-w-0 text-sm">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {LOG_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={module} onValueChange={(v) => { setModule(v); setOffset(0) }}>
                <SelectTrigger className="h-9 w-full min-w-0 text-sm">
                  <SelectValue placeholder="Module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All modules</SelectItem>
                  {(stats?.distinctModules ?? []).map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={environment} onValueChange={(v) => { setEnvironment(v); setOffset(0) }}>
                <SelectTrigger className="h-9 w-full min-w-0 text-sm">
                  <SelectValue placeholder="Environment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All environments</SelectItem>
                  {(stats?.distinctEnvironments ?? []).map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setOffset(0) }}
                className="h-9 w-full min-w-0 text-sm"
                aria-label="From date"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setOffset(0) }}
                className="h-9 w-full min-w-0 text-sm"
                aria-label="To date"
              />
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200/80 bg-card dark:border-white/10">
            <div className="border-b px-3 py-3 sm:px-4">
              <p className="text-sm font-medium">Log events</p>
              <p className="text-xs text-muted-foreground">
                <span className="md:hidden">Tap a card for full detail.</span>
                <span className="hidden md:inline">Click a row for full detail in the modal</span>
              </p>
            </div>
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No logs match your filters.
              </div>
            ) : (
              <>
                <div className="space-y-3 p-3 md:hidden">
                  {logs.map((log) => (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => { setSelectedLogId(log.id); setDetailOpen(true) }}
                      className="w-full rounded-xl border border-slate-200/80 bg-background p-3.5 text-left shadow-sm transition-colors hover:bg-muted/30 active:bg-muted/40 dark:border-white/10"
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <Badge variant={severityBadgeVariant(log.severity)} className="text-[10px]">
                          {log.severity}
                        </Badge>
                        <span className="shrink-0 text-[11px] text-muted-foreground whitespace-nowrap">
                          {formatShortTime(log.created_at)}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-sm font-medium">
                        {log.title ?? log.error_message}
                      </p>
                      {log.module_name ? (
                        <p className="mt-1 truncate text-[11px] text-muted-foreground">{log.module_name}</p>
                      ) : null}
                    </button>
                  ))}
                </div>
                <Table className="hidden w-full table-fixed md:table md:min-w-0">
                <colgroup>
                  <col style={{ width: "76px" }} />
                  <col className="hidden sm:table-column" style={{ width: "22%" }} />
                  <col />
                  <col className="hidden sm:table-column" style={{ width: "108px" }} />
                  <col style={{ width: "44px" }} />
                </colgroup>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-[var(--cc-accent-soft)]/45">
                    <TableHead className="px-2 sm:px-3">Severity</TableHead>
                    <TableHead className="hidden px-3 sm:table-cell">Module</TableHead>
                    <TableHead className="px-2 sm:px-3">Event</TableHead>
                    <TableHead className="hidden px-3 text-right sm:table-cell">When</TableHead>
                    <TableHead className="px-1" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow
                      key={log.id}
                      className="cursor-pointer"
                      onClick={() => { setSelectedLogId(log.id); setDetailOpen(true) }}
                    >
                      <TableCell className={CELL}>
                        <Badge variant={severityBadgeVariant(log.severity)} className="text-[10px]">
                          {log.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn(CELL, "hidden sm:table-cell")}>
                        <p className="truncate text-xs text-muted-foreground" title={log.module_name ?? undefined}>
                          {log.module_name ?? "—"}
                        </p>
                      </TableCell>
                      <TableCell className={CELL}>
                        <p className="truncate text-sm" title={log.title ?? log.error_message ?? undefined}>
                          {log.title ?? log.error_message}
                        </p>
                        {log.module_name && (
                          <p className="truncate text-[11px] text-muted-foreground sm:hidden">
                            {log.module_name}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className={cn(CELL, "hidden text-right text-xs text-muted-foreground sm:table-cell")}>
                        {formatShortTime(log.created_at)}
                      </TableCell>
                      <TableCell className="px-1 py-2.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedLogId(log.id)
                            setDetailOpen(true)
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </>
            )}
            <TablePager
              total={total}
              offset={offset}
              pageSize={eventsPageSize}
              onPageChange={(page) => setOffset((page - 1) * eventsPageSize)}
              onPageSizeChange={(size) => {
                setEventsPageSize(size)
                setOffset(0)
              }}
            />
          </div>
        </TabsContent>
      </Tabs>

      <SystemLogDetailModal
        logId={selectedLogId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        portal={portal}
        onSelectRelated={(id) => setSelectedLogId(id)}
      />
    </div>
  )
}
