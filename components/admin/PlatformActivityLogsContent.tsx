"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Activity,
  Download,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  Users,
  Zap,
} from "lucide-react"
import { buildAdminApiHeaders } from "@/lib/admin-api-headers"
import {
  clientPlatformLabel,
  formatActivityActorPrimary,
  formatActivityActorSecondary,
  formatActivitySummaryPrimary,
  formatActivitySummarySecondary,
  portalLabel,
  resolveActivityClientPlatform,
  type PlatformActivityRow,
} from "@/lib/platform-activity-constants"
import { exportPlatformActivityPdf } from "@/lib/platform-activity-pdf"
import {
  PlatformActivityDetailModal,
  actionBadgeVariantPublic,
  formatTimeShort,
} from "@/components/admin/PlatformActivityDetailModal"
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type StatsPayload = {
  today: { total_today: number; logins_today: number; failures_today: number }
  portalBreakdown: { portal: string; count: number }[]
  categoryBreakdown: { category: string; count: number }[]
}

const PAGE_SIZE_OPTIONS = [10, 15, 25, 50] as const
const DEFAULT_PAGE_SIZE = 15

function getVisiblePages(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const pages = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1])
  return [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
}

function actionBadgeVariant(action: string) {
  return actionBadgeVariantPublic(action)
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string
  value: number | string
  icon: LucideIcon
  tone?: "default" | "success" | "danger" | "violet"
}) {
  const toneStyles = {
    default: "text-foreground",
    success: "text-emerald-600 dark:text-emerald-400",
    danger: "text-destructive",
    violet: "text-violet-600 dark:text-violet-400",
  }
  const iconStyles = {
    default: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
    danger: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  }

  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-background px-4 py-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={cn("mt-1 text-2xl sm:text-3xl font-semibold tabular-nums tracking-tight", toneStyles[tone])}>
            {value}
          </p>
        </div>
        <div className={cn("shrink-0 rounded-lg p-2", iconStyles[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

export function PlatformActivityLogsContent() {
  const { toast } = useToast()
  const [logs, setLogs] = useState<PlatformActivityRow[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [stats, setStats] = useState<StatsPayload | null>(null)
  const [distinctActions, setDistinctActions] = useState<string[]>([])

  const [portal, setPortal] = useState("all")
  const [category, setCategory] = useState("all")
  const [action, setAction] = useState("all")
  const [clientPlatform, setClientPlatform] = useState("all")
  const [success, setSuccess] = useState("all")
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selectedLog, setSelectedLog] = useState<PlatformActivityRow | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)

  const queryString = useMemo(() => {
    const p = new URLSearchParams()
    p.set("limit", String(pageSize))
    p.set("offset", String(offset))
    if (portal !== "all") p.set("portal", portal)
    if (category !== "all") p.set("category", category)
    if (action !== "all") p.set("action", action)
    if (clientPlatform !== "all") p.set("clientPlatform", clientPlatform)
    if (success !== "all") p.set("success", success)
    if (search.trim()) p.set("search", search.trim())
    if (dateFrom) p.set("dateFrom", dateFrom)
    if (dateTo) p.set("dateTo", dateTo)
    return p.toString()
  }, [portal, category, action, clientPlatform, success, search, dateFrom, dateTo, offset, pageSize])

  const load = useCallback(async (opts?: { bustCache?: boolean }) => {
    setLoading(true)
    try {
      const headers = buildAdminApiHeaders()
      const url =
        opts?.bustCache === true
          ? `/api/admin/platform-activity?${queryString}&_=${Date.now()}`
          : `/api/admin/platform-activity?${queryString}`
      const res = await fetch(url, { headers, cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load")
      setLogs(data.logs ?? [])
      setTotal(data.total ?? 0)
      setStats(data.stats ?? null)
      setDistinctActions(data.distinctActions ?? [])
    } catch (e) {
      toast({
        title: "Could not load activity logs",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [queryString, toast])

  useEffect(() => {
    void load()
  }, [load])

  const page = Math.floor(offset / pageSize) + 1
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const rangeStart = total === 0 ? 0 : offset + 1
  const rangeEnd = Math.min(offset + logs.length, total)
  const visiblePages = getVisiblePages(page, totalPages)

  const goToPage = (nextPage: number) => {
    const safePage = Math.min(Math.max(nextPage, 1), totalPages)
    setOffset((safePage - 1) * pageSize)
  }

  const handleExportPdf = async () => {
    setExporting(true)
    try {
      const p = new URLSearchParams(queryString)
      p.set("limit", "500")
      p.set("offset", "0")
      const res = await fetch(`/api/admin/platform-activity?${p.toString()}`, {
        headers: buildAdminApiHeaders(),
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to export")
      exportPlatformActivityPdf(data.logs ?? [], {
        portal,
        category,
        clientPlatform,
        dateFrom,
        dateTo,
        search: search.trim(),
      })
      toast({ title: "PDF exported", description: `${(data.logs ?? []).length} records included.` })
    } catch (e) {
      toast({
        title: "Export failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  const clearFilters = () => {
    setPortal("all")
    setCategory("all")
    setAction("all")
    setClientPlatform("all")
    setSuccess("all")
    setSearch("")
    setDateFrom("")
    setDateTo("")
    setOffset(0)
  }

  const hasFilters =
    portal !== "all" ||
    category !== "all" ||
    action !== "all" ||
    clientPlatform !== "all" ||
    success !== "all" ||
    search.trim() ||
    dateFrom ||
    dateTo

  const openDetail = (row: PlatformActivityRow) => {
    setSelectedLog(row)
    setDetailOpen(true)
  }

  return (
    <div className="space-y-4 sm:space-y-5 w-full min-w-0">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-start sm:items-center gap-2">
          <Activity className="h-6 w-6 sm:h-7 sm:w-7 text-violet-500 shrink-0 mt-0.5 sm:mt-0" />
          <span className="min-w-0 leading-snug">Platform Activity &amp; Audit Logs</span>
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl">
          Track logins, page access, password changes, quiz activity, and which client
          students used (web, mobile app, or desktop app) across portals.
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Events today" value={stats.today.total_today} icon={Zap} tone="violet" />
          <KpiCard label="Logins today" value={stats.today.logins_today} icon={Users} tone="success" />
          <KpiCard
            label="Failed attempts today"
            value={stats.today.failures_today}
            icon={Shield}
            tone="danger"
          />
          <KpiCard label="Matching filter" value={total.toLocaleString()} icon={FileText} />
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-10 sm:h-11 w-full justify-center gap-2 rounded-xl border-slate-200/80 dark:border-white/10"
          onClick={() => void load({ bustCache: true })}
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh logs
        </Button>
        <Button
          type="button"
          className="h-10 sm:h-11 w-full justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600"
          onClick={() => void handleExportPdf()}
          disabled={exporting || loading}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export PDF
        </Button>
      </div>

      <Card className="border-slate-200/80 dark:border-white/10 shadow-sm">
        <CardHeader className="border-b pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-lg">Activity log</CardTitle>
              <CardDescription>Filter and inspect platform events</CardDescription>
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4 sm:pt-6 space-y-4">
          <div className="space-y-3">
            <div className="relative w-full min-w-0">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search user, summary, path…"
                className="pl-9"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setOffset(0)
                }}
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <Select
                value={portal}
                onValueChange={(v) => {
                  setPortal(v)
                  setOffset(0)
                }}
              >
                <SelectTrigger className="min-w-0 w-full">
                  <SelectValue placeholder="Portal" />
                </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All portals</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="faculty">Faculty</SelectItem>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="summer_camper">Summer Camp</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={clientPlatform}
              onValueChange={(v) => {
                setClientPlatform(v)
                setOffset(0)
              }}
            >
              <SelectTrigger className="min-w-0 w-full">
                <SelectValue placeholder="Client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                <SelectItem value="web">Web</SelectItem>
                <SelectItem value="mobile">Mobile app</SelectItem>
                <SelectItem value="desktop">Desktop app</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v)
                setOffset(0)
              }}
            >
              <SelectTrigger className="min-w-0 w-full">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="auth">Authentication</SelectItem>
                <SelectItem value="navigation">Navigation</SelectItem>
                <SelectItem value="assessment">Assessment</SelectItem>
                <SelectItem value="profile">Profile</SelectItem>
                <SelectItem value="admin">Administration</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={action}
              onValueChange={(v) => {
                setAction(v)
                setOffset(0)
              }}
            >
              <SelectTrigger className="min-w-0 w-full">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {distinctActions.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={success}
              onValueChange={(v) => {
                setSuccess(v)
                setOffset(0)
              }}
            >
              <SelectTrigger className="min-w-0 w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="true">Success only</SelectItem>
                <SelectItem value="false">Failed only</SelectItem>
              </SelectContent>
            </Select>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 min-w-0">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value)
                  setOffset(0)
                }}
                aria-label="From date"
                className="min-w-0 w-full"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value)
                  setOffset(0)
                }}
                aria-label="To date"
                className="min-w-0 w-full"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
              Loading activity logs…
            </div>
          ) : logs.length === 0 ? (
            <div className="rounded-xl border border-dashed py-14 text-center text-sm text-muted-foreground">
              No activity logs match your filters yet. Log in to any portal to generate events.
            </div>
          ) : (
            <>
              {/* Mobile card list */}
              <div className="space-y-3 md:hidden">
                {logs.map((row) => {
                  const userLabel = formatActivityActorPrimary(row)
                  const userSubLabel = formatActivityActorSecondary(row)
                  const summaryLabel = formatActivitySummaryPrimary(row)
                  const summarySubLabel = formatActivitySummarySecondary(row)
                  const platformLabel = clientPlatformLabel(resolveActivityClientPlatform(row))
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => openDetail(row)}
                      className="w-full rounded-xl border border-slate-200/80 dark:border-white/10 bg-background p-3.5 text-left shadow-sm transition-colors hover:bg-muted/30 active:bg-muted/40"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{summaryLabel}</p>
                          {summarySubLabel ? (
                            <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                              {summarySubLabel}
                            </p>
                          ) : null}
                        </div>
                        {row.success ? (
                          <span className="inline-flex h-2 w-2 mt-1.5 shrink-0 rounded-full bg-emerald-500" title="Success" />
                        ) : (
                          <span className="inline-flex h-2 w-2 mt-1.5 shrink-0 rounded-full bg-destructive" title="Failed" />
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <Badge variant={actionBadgeVariant(row.action)} className="font-normal text-[10px] px-1.5 py-0">
                          {row.action.replace(/_/g, " ")}
                        </Badge>
                        <Badge variant="outline" className="font-normal text-[10px] px-1.5 py-0">
                          {portalLabel(row.portal)}
                        </Badge>
                        <Badge variant="secondary" className="font-normal text-[10px] px-1.5 py-0">
                          {platformLabel}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span className="truncate min-w-0">
                          {userLabel}
                          {userSubLabel ? ` · ${userSubLabel}` : ""}
                        </span>
                        <span className="shrink-0 whitespace-nowrap">{formatTimeShort(row.created_at)}</span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block rounded-xl border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap w-[120px]">When</TableHead>
                    <TableHead className="min-w-[140px]">User</TableHead>
                    <TableHead className="min-w-[200px]">Summary</TableHead>
                    <TableHead className="min-w-[100px]">Action</TableHead>
                    <TableHead className="min-w-[88px]">Portal</TableHead>
                    <TableHead className="min-w-[96px]">Client</TableHead>
                    <TableHead className="w-[72px]">Status</TableHead>
                    <TableHead className="w-[88px] text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((row) => {
                    const userLabel = formatActivityActorPrimary(row)
                    const userSubLabel = formatActivityActorSecondary(row)
                    const summaryLabel = formatActivitySummaryPrimary(row)
                    const summarySubLabel = formatActivitySummarySecondary(row)
                    const platformLabel = clientPlatformLabel(resolveActivityClientPlatform(row))
                    return (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => openDetail(row)}
                      >
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatTimeShort(row.created_at)}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <div className="truncate font-medium text-sm">{userLabel}</div>
                          <div className="truncate text-xs text-muted-foreground">{userSubLabel}</div>
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          <div className="truncate text-sm">{summaryLabel}</div>
                          {summarySubLabel ? (
                            <div className="truncate text-xs text-muted-foreground font-mono">
                              {summarySubLabel}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant={actionBadgeVariant(row.action)} className="font-normal">
                            {row.action.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal whitespace-nowrap">
                            {portalLabel(row.portal)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal whitespace-nowrap">
                            {platformLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {row.success ? (
                            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" title="Success" />
                          ) : (
                            <span className="inline-flex h-2 w-2 rounded-full bg-destructive" title="Failed" />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-500/10"
                            onClick={(e) => {
                              e.stopPropagation()
                              openDetail(row)
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            </>
          )}

          {!loading && total > 0 && (
            <div className="flex flex-col gap-4 border-t pt-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of{" "}
                  {total.toLocaleString()} · Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => {
                      setPageSize(Number(v))
                      setOffset(0)
                    }}
                  >
                    <SelectTrigger className="h-9 w-[88px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Pagination className="mx-0 w-full justify-center sm:justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        goToPage(page - 1)
                      }}
                      className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      aria-disabled={page <= 1}
                    />
                  </PaginationItem>
                  {visiblePages.map((pageNum, idx) => (
                    <Fragment key={pageNum}>
                      {idx > 0 && visiblePages[idx - 1] !== pageNum - 1 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            goToPage(pageNum)
                          }}
                          isActive={page === pageNum}
                          className="cursor-pointer min-w-9"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    </Fragment>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        goToPage(page + 1)
                      }}
                      className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      aria-disabled={page >= totalPages}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}

          <PlatformActivityDetailModal
            row={selectedLog}
            open={detailOpen}
            onOpenChange={setDetailOpen}
          />
        </CardContent>
      </Card>
    </div>
  )
}
