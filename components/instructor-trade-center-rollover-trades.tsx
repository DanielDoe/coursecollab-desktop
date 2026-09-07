"use client"

import { useEffect, useState, useCallback } from "react"
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
import { RotateCw, RefreshCw, User, FileQuestion, Coins, ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { uniqueSessionCodes } from "@/lib/unique-session-codes"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { useToast } from "@/hooks/use-toast"
import { downloadTradeCenterPdf } from "@/lib/trade-center-pdf-download"
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import {
  TC_EMPTY,
  TC_MODULE_ID,
  TC_PANEL,
  TC_SPINNER,
  TC_TABLE_WRAP,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
  tcChrome,
  tcOutlineClass,
} from "@/lib/trade-center/trade-center-instructor-ui"

interface RolloverTrade {
  id: number
  studentId: number
  studentName: string
  studentNumber: string
  section: string
  membershipTier: string
  quizId: number
  quizTitle: string
  assessmentType: string
  sourceCategory: string
  sourceLabel: string
  pointsTraded: number
  hours: number
  appliedAt: string
  expiresAt: string
  isActive: boolean
}

const PAGE_SIZES = [10, 15, 25, 50]

export function InstructorTradeCenterRolloverTrades({ instructorId }: { instructorId?: number }) {
  const fp = tcChrome().p
  const [trades, setTrades] = useState<RolloverTrade[]>([])
  const [sessions, setSessions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(15)
  const [totalPages, setTotalPages] = useState(1)
  const [sessionFilter, setSessionFilter] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const { courseScopeVersion } = useInstructorDashboardV2()
  const { toast } = useToast()

  // Fetch sessions from instructor API (scoped to selected course)
  useEffect(() => {
    const headers = buildInstructorAuthorizedApiHeaders()
    instructorApiFetch("/api/instructor/sessions", { headers })
      .then((r) => r.json())
      .then((d) => {
        const sess = uniqueSessionCodes(d.sessions || []).map((s) => s.code)
        if (sess.length > 0) setSessions(sess)
      })
      .catch(() => {})
  }, [courseScopeVersion])

  const fetchTrades = useCallback(async () => {
    try {
      setLoading(true)
      const headers = buildInstructorAuthorizedApiHeaders()

      const params = new URLSearchParams()
      if (sessionFilter) params.set("session", sessionFilter)
      if (searchQuery) params.set("search", searchQuery)
      params.set("page", String(page))
      params.set("limit", String(limit))

      const res = await instructorApiFetch(`/api/instructor/trade-center/rollover-trades?${params}`, { headers })
      const data = await res.json()
      if (res.ok) {
        setTrades(data.trades || [])
        setTotal(data.total ?? 0)
        setTotalPages(data.totalPages ?? 1)
        // Merge API sessions with existing (instructor sessions loaded on mount)
        if (data.sessions?.length > 0) {
          setSessions((prev) => [...new Set([...prev, ...data.sessions])].sort())
        }
      } else {
        setTrades([])
      }
    } catch (error) {
      console.error("Error fetching rollover trades:", error)
      setTrades([])
    } finally {
      setLoading(false)
    }
  }, [sessionFilter, searchQuery, page, limit, courseScopeVersion])

  useEffect(() => {
    fetchTrades()
  }, [fetchTrades])

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const handleExportPdf = async () => {
    setExportingPdf(true)
    try {
      const fileName = await downloadTradeCenterPdf(
        "rollovers",
        buildInstructorAuthorizedApiHeaders(),
        { session: sessionFilter || undefined, search: searchQuery || undefined },
        `trade-center-rollovers-${Date.now()}.pdf`,
      )
      toast({ title: "PDF downloaded", description: fileName })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not export PDF"
      toast({ title: "Export failed", description: msg, variant: "destructive" })
    } finally {
      setExportingPdf(false)
    }
  }

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return d
    }
  }

  const tierColor = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case "trailblazer": return "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-300/50"
      case "explorer": return "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-300/50"
      case "scholar": return "bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-300/50"
      default: return "bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-300/50"
    }
  }

  return (
    <div className="space-y-4 min-w-0">
      <FacultyIntegratedToolbar
        moduleId={TC_MODULE_ID}
        search={searchInput}
        onSearchChange={setSearchInput}
        onSearchClear={() => setSearchInput("")}
        searchPlaceholder="Search by student name, ID, or assignment…"
        filters={
          <>
            <Select
              value={sessionFilter || "all"}
              onValueChange={(v) => {
                setSessionFilter(v === "all" ? "" : v)
                setPage(1)
              }}
            >
              <SelectTrigger
                className={cn(facultyToolbarFilterButtonClass(Boolean(sessionFilter)), "h-9 w-[148px] shadow-none")}
              >
                <SelectValue placeholder="All sessions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sessions</SelectItem>
                {sessions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(limit)}
              onValueChange={(v) => {
                setLimit(Number(v))
                setPage(1)
              }}
            >
              <SelectTrigger className={cn(facultyToolbarFilterButtonClass(), "h-9 w-[108px] shadow-none")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        meta={
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {loading ? "Loading…" : `Showing ${total === 0 ? 0 : (page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total} rollover trades`}
          </p>
        }
        trailing={
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={facultyToolbarFilterButtonClass()}
              disabled={exportingPdf || loading}
              onClick={() => void handleExportPdf()}
            >
              {exportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 opacity-70" />}
              <span className="hidden sm:inline">Export PDF</span>
            </Button>
            <Button variant="ghost" size="sm" className={facultyToolbarFilterButtonClass()} onClick={fetchTrades} disabled={loading}>
              <RefreshCw className={cn("h-3.5 w-3.5 opacity-70", loading && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </>
        }
      />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className={cn("h-8 w-8", TC_SPINNER)} />
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Loading rollover trades…</p>
          </div>
        ) : trades.length === 0 ? (
          <div className={TC_EMPTY}>
            <div className={cn("mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full", fp.softBg)}>
              <RotateCw className={cn("h-6 w-6", fp.iconText)} />
            </div>
            <p className={cn("text-sm font-medium", PORTAL_TEXT)}>
              {searchQuery || sessionFilter ? "No matching rollover trades" : "No rollover trades yet"}
            </p>
            <p className={cn("text-sm mt-1 max-w-sm mx-auto", PORTAL_TEXT_MUTED)}>
              {searchQuery || sessionFilter
                ? "Try adjusting your search or filters."
                : "Students can trade grade points for extensions in the Trade Center, or instructors can grant rollovers from the Edit Quiz form."}
            </p>
          </div>
        ) : (
          <>
          <div className={TC_TABLE_WRAP}>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                  <TableHead className="font-semibold">Student</TableHead>
                  <TableHead className="font-semibold">Section</TableHead>
                  <TableHead className="font-semibold">Membership</TableHead>
                  <TableHead className="font-semibold">Assignment</TableHead>
                  <TableHead className="font-semibold">Points</TableHead>
                  <TableHead className="font-semibold">Source</TableHead>
                  <TableHead className="font-semibold">Hours</TableHead>
                  <TableHead className="font-semibold">Expires</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((t) => (
                  <TableRow key={`${t.studentId}-${t.quizId}-${t.id}`} className="transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="font-medium">{t.studentName}</p>
                          <p className="text-xs text-slate-500">{t.studentNumber}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">{t.section}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs", tierColor(t.membershipTier))}>
                        {t.membershipTier}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileQuestion className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="font-medium">{t.quizTitle}</p>
                          <p className="text-xs text-slate-500 capitalize">{t.assessmentType?.replace("_", " ")}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Coins className="h-4 w-4 text-amber-500" />
                        <span className="font-medium">{t.pointsTraded}</span>
                        <span className="text-xs text-slate-500">pts</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{t.sourceLabel}</Badge>
                    </TableCell>
                    <TableCell>{t.hours}h</TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400 text-sm">
                      {formatDate(t.expiresAt)}
                    </TableCell>
                    <TableCell>
                      {t.isActive ? (
                        <Badge className="bg-emerald-600 text-xs">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Expired</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4 pt-4 border-t", "border-[var(--sidebar-border)]")}>
            <p className={cn("text-sm order-2 sm:order-1", PORTAL_TEXT_MUTED)}>
              Page <span className={cn("font-medium", PORTAL_TEXT)}>{page}</span> of{" "}
              <span className={cn("font-medium", PORTAL_TEXT)}>{totalPages}</span>
            </p>
            {totalPages > 1 ? (
              <div className="flex items-center gap-2 order-1 sm:order-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className={cn("h-9 w-9 p-0 rounded-lg", tcOutlineClass())}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className={cn("text-sm px-3 py-1.5 rounded-md font-medium", fp.softBg, fp.iconText)}>
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className={cn("h-9 w-9 p-0 rounded-lg", tcOutlineClass())}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
          </div>
          </>
        )}
    </div>
  )
}
