"use client"

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { uniqueSessionCodes } from "@/lib/unique-session-codes"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { useToast } from "@/hooks/use-toast"
import { downloadTradeCenterPdf } from "@/lib/trade-center-pdf-download"
import { RefreshCw, Download, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import {
  TC_MODULE_ID,
  TC_PANEL,
  TC_PANEL_INNER,
  TC_SPINNER,
  TC_TABS_LIST,
  TC_TABS_TRIGGER,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/trade-center/trade-center-instructor-ui"

type TradeLogData = {
  transactions?: Record<string, unknown>[]
  rollovers?: Record<string, unknown>[]
  donationRequests?: Record<string, unknown>[]
  pointRequests?: Record<string, unknown>[]
}

function statusBadgeVariant(status: string) {
  const s = (status || "").toLowerCase()
  if (s.includes("approved")) return "default" as const
  if (s.includes("reject")) return "destructive" as const
  return "secondary" as const
}

function formatLogWhen(iso: unknown): string {
  if (iso == null || iso === "") return "—"
  const d = new Date(String(iso))
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  })
}

function transactionTypeLabel(t: unknown): string {
  const u = String(t || "").toUpperCase()
  if (u === "TRADE") return "Trade for EC"
  if (u === "DONATION") return "Donation / transfer"
  return u ? u.charAt(0) + u.slice(1).toLowerCase() : "—"
}

function humanizeWorkflowStatus(s: unknown): string {
  const raw = String(s || "").trim()
  if (!raw) return "—"
  return raw
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ")
}

function formatCategory(cat: unknown): string {
  const c = String(cat || "").trim()
  if (!c) return "—"
  return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()
}

function rowMatchesSearch(row: Record<string, unknown>, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return Object.values(row).some((v) => v != null && String(v).toLowerCase().includes(q))
}

export function InstructorTradeCenterTradeLog({ instructorId: _instructorId }: { instructorId?: number }) {
  const [data, setData] = useState<TradeLogData | null>(null)
  const [loading, setLoading] = useState(true)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [sessionFilter, setSessionFilter] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [sessions, setSessions] = useState<string[]>([])
  const { courseScopeVersion } = useInstructorDashboardV2()
  const { toast } = useToast()

  useEffect(() => {
    const headers = buildInstructorAuthorizedApiHeaders()
    instructorApiFetch("/api/instructor/sessions", { headers })
      .then((r) => r.json())
      .then((d) => {
        const sess = uniqueSessionCodes(d.sessions || []).map((s) => s.code)
        if (sess.length) setSessions(sess)
      })
      .catch(() => {})
  }, [courseScopeVersion])

  const fetchLog = useCallback(async () => {
    setLoading(true)
    try {
      const headers = buildInstructorAuthorizedApiHeaders()
      const params = new URLSearchParams()
      if (sessionFilter) params.set("session", sessionFilter)
      const res = await fetch(`/api/trade-center/instructor-trade-log?${params}`, { headers })
      const json = await res.json()
      if (res.ok) setData(json)
      else setData(null)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [sessionFilter, courseScopeVersion])

  useEffect(() => {
    fetchLog()
  }, [fetchLog])

  const handleExportPdf = async () => {
    setExportingPdf(true)
    try {
      const fileName = await downloadTradeCenterPdf(
        "trade-log",
        buildInstructorAuthorizedApiHeaders(),
        { session: sessionFilter || undefined },
        `trade-center-trade-log-${Date.now()}.pdf`,
      )
      toast({ title: "PDF downloaded", description: fileName })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not export PDF"
      toast({ title: "Export failed", description: msg, variant: "destructive" })
    } finally {
      setExportingPdf(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex justify-center py-16">
        <div className={cn("h-8 w-8", TC_SPINNER)} />
      </div>
    )
  }

  const tx = (data?.transactions || []).filter((row) => rowMatchesSearch(row, searchQuery))
  const ro = (data?.rollovers || []).filter((row) => rowMatchesSearch(row, searchQuery))
  const dr = (data?.donationRequests || []).filter((row) => rowMatchesSearch(row, searchQuery))
  const pr = (data?.pointRequests || []).filter((row) => rowMatchesSearch(row, searchQuery))
  const q = searchQuery.trim()

  const panelClass = cn(TC_PANEL, "overflow-hidden")

  return (
    <div className="space-y-4 min-w-0">
      <FacultyIntegratedToolbar
        moduleId={TC_MODULE_ID}
        search={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchClear={() => setSearchQuery("")}
        searchPlaceholder="Search activity, students, sections…"
        filters={
          <Select value={sessionFilter || "__all__"} onValueChange={(v) => setSessionFilter(v === "__all__" ? "" : v)}>
            <SelectTrigger
              className={cn(
                facultyToolbarFilterButtonClass(Boolean(sessionFilter)),
                "h-9 w-[168px] shadow-none",
              )}
            >
              <SelectValue placeholder="All sections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All sections</SelectItem>
              {sessions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        meta={
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {q
              ? `${tx.length + ro.length + dr.length + pr.length} matching records`
              : "Activity history: trades, rollovers, and pending requests"}
            {sessionFilter ? ` · ${sessionFilter}` : ""}
          </p>
        }
        trailing={
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={facultyToolbarFilterButtonClass()}
              onClick={() => void handleExportPdf()}
              disabled={exportingPdf || loading}
            >
              {exportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 opacity-70" />}
              <span className="hidden sm:inline">Export PDF</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={facultyToolbarFilterButtonClass()}
              onClick={() => fetchLog()}
              disabled={loading}
            >
              <RefreshCw className={cn("h-3.5 w-3.5 opacity-70", loading && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </>
        }
      />

      <Tabs defaultValue="transactions" className="min-w-0 space-y-4">
        <TabsList className={TC_TABS_LIST}>
          <TabsTrigger value="transactions" className={TC_TABS_TRIGGER}>
            Transactions
            <Badge variant="secondary" className="ml-1.5 rounded-md px-1.5 py-0 text-[10px] tabular-nums">
              {tx.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="rollovers" className={TC_TABS_TRIGGER}>
            Rollovers
            <Badge variant="secondary" className="ml-1.5 rounded-md px-1.5 py-0 text-[10px] tabular-nums">
              {ro.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="donations" className={TC_TABS_TRIGGER}>
            Donation requests
            <Badge variant="secondary" className="ml-1.5 rounded-md px-1.5 py-0 text-[10px] tabular-nums">
              {dr.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="points" className={TC_TABS_TRIGGER}>
            Point requests
            <Badge variant="secondary" className="ml-1.5 rounded-md px-1.5 py-0 text-[10px] tabular-nums">
              {pr.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-0 space-y-2 focus-visible:outline-none">
          <div className={panelClass}>
            <div className={cn("border-b px-4 py-3", "border-[var(--sidebar-border)]")}>
              <h3 className={cn("font-medium", PORTAL_TEXT)}>Completed trades & transfers</h3>
              <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>
                Records when students convert points to EC or complete peer donations (newest first). Times are Central.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="whitespace-nowrap">When</TableHead>
                    <TableHead className="whitespace-nowrap">Section</TableHead>
                    <TableHead className="whitespace-nowrap">Type</TableHead>
                    <TableHead className="min-w-[240px]">What happened</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Points</TableHead>
                    <TableHead className="text-right whitespace-nowrap">EC gained</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tx.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-500">
                        {q ? "No transactions match your search." : "No transactions for this filter yet."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    tx.map((row) => (
                      <TableRow key={`tx-${row.id}`}>
                        <TableCell className="align-top text-xs tabular-nums whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {formatLogWhen(row.created_at)}
                        </TableCell>
                        <TableCell className="align-top text-sm">{String(row.donor_section || row.session || "—")}</TableCell>
                        <TableCell className="align-top">
                          <Badge variant="outline" className="font-normal">
                            {transactionTypeLabel(row.transaction_type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top text-sm leading-snug text-slate-700 dark:text-slate-300">
                          {String(row.summary || "—")}
                        </TableCell>
                        <TableCell className="align-top text-right tabular-nums text-sm">
                          {row.points_used != null ? String(row.points_used) : "—"}
                        </TableCell>
                        <TableCell className="align-top text-right tabular-nums text-sm">
                          {row.transaction_type === "TRADE" && row.credits_gained != null ? String(row.credits_gained) : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="rollovers" className="mt-0 space-y-2 focus-visible:outline-none">
          <div className={panelClass}>
            <div className="border-b border-slate-200/60 px-4 py-3 dark:border-white/[0.08]">
              <h3 className="font-medium text-slate-800 dark:text-slate-200">Grade rollover trades</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Assessment points applied toward deadline extensions. “Pts” is the amount deducted from the grade bucket.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Student</TableHead>
                    <TableHead className="whitespace-nowrap">ID</TableHead>
                    <TableHead className="whitespace-nowrap">Section</TableHead>
                    <TableHead className="min-w-[200px]">Assessment</TableHead>
                    <TableHead className="whitespace-nowrap">Category</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Pts</TableHead>
                    <TableHead className="whitespace-nowrap">Applied</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ro.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">
                        {q ? "No rollovers match your search." : "No rollover trades for this filter."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    ro.map((row) => (
                      <TableRow key={`ro-${row.id}`}>
                        <TableCell className="max-w-[160px] truncate text-sm font-medium">
                          {String(row.student_name || "—")}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-slate-600 dark:text-slate-400">
                          {String(row.student_number || "—")}
                        </TableCell>
                        <TableCell className="text-sm">{String(row.section_code || "—")}</TableCell>
                        <TableCell className="text-sm leading-snug">{String(row.quiz_title || "—")}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {formatCategory(row.source_category)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {row.points_deducted != null ? String(row.points_deducted) : "—"}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {formatLogWhen(row.applied_at)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="donations" className="mt-0 space-y-2 focus-visible:outline-none">
          <div className={panelClass}>
            <div className="border-b border-slate-200/60 px-4 py-3 dark:border-white/[0.08]">
              <h3 className="font-medium text-slate-800 dark:text-slate-200">Donation requests</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">All workflow states (pending, approved, rejected).</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="whitespace-nowrap">Requested</TableHead>
                    <TableHead>Donor</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Points</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dr.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-500">
                        {q ? "No donation requests match your search." : "No donation requests for this filter."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    dr.map((row) => (
                      <TableRow key={`dr-${row.id}`}>
                        <TableCell className="text-xs tabular-nums whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {formatLogWhen(row.created_at)}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="font-medium">{String(row.donor_name || "—")}</div>
                          {row.donor_number ? (
                            <div className="text-xs text-slate-500 tabular-nums">{String(row.donor_number)}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="font-medium">{String(row.recipient_name || "—")}</div>
                          {row.recipient_number ? (
                            <div className="text-xs text-slate-500 tabular-nums">{String(row.recipient_number)}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm">{String((row as { source_label?: string }).source_label || row.source || "—")}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{row.points != null ? String(row.points) : "—"}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(String(row.status || ""))} className="font-normal">
                            {humanizeWorkflowStatus(row.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="points" className="mt-0 space-y-2 focus-visible:outline-none">
          <div className={panelClass}>
            <div className="border-b border-slate-200/60 px-4 py-3 dark:border-white/[0.08]">
              <h3 className="font-medium text-slate-800 dark:text-slate-200">Peer point requests</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Flow: pending → pending instructor (after peer accepts) → instructor decision.
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="whitespace-nowrap">Requested</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Peer</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Points</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pr.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-slate-500">
                        {q ? "No point requests match your search." : "No point requests for this filter."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pr.map((row) => (
                      <TableRow key={`pr-${row.id}`}>
                        <TableCell className="text-xs tabular-nums whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {formatLogWhen(row.created_at)}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="font-medium">{String(row.requester_name || "—")}</div>
                          {row.requester_number ? (
                            <div className="text-xs text-slate-500 tabular-nums">{String(row.requester_number)}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="font-medium">{String(row.requestee_name || "—")}</div>
                          {row.requestee_number ? (
                            <div className="text-xs text-slate-500 tabular-nums">{String(row.requestee_number)}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-sm">{String((row as { source_label?: string }).source_label || row.source || "—")}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{row.points != null ? String(row.points) : "—"}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(String(row.status || ""))} className="font-normal">
                            {humanizeWorkflowStatus(row.status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
