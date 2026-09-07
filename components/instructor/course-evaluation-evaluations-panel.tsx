"use client"

import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { CourseEvaluationDetailModal } from "@/components/instructor/course-evaluation-detail-modal"
import { CourseEvaluationListRow } from "@/components/instructor/course-evaluation-list-row"
import { useCourseEvaluationReview } from "@/components/instructor/use-course-evaluation-review"
import { CourseEvaluationExportAllButton } from "@/components/instructor/course-evaluation-export-actions"
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import {
  normalizeEvaluationRow,
  type EvaluationRow,
  type Proof,
} from "@/components/instructor/course-evaluation-shared"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Returned" },
]

export function CourseEvaluationEvaluationsPanel() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<EvaluationRow[]>([])
  const [pendingItems, setPendingItems] = useState<EvaluationRow[]>([])
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<EvaluationRow | null>(null)
  const [proofs, setProofs] = useState<Proof[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [note, setNote] = useState("")
  const [quickApprovingId, setQuickApprovingId] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [listRes, pendingRes] = await Promise.all([
        instructorApiFetch(`/api/instructor/course-evaluations?status=${encodeURIComponent(statusFilter)}&session=all`),
        instructorApiFetch("/api/instructor/course-evaluations?status=pending&session=all"),
      ])
      const listData = await listRes.json()
      const pendingData = await pendingRes.json()
      setItems((listData.evaluations ?? []).map((r: Record<string, unknown>) => normalizeEvaluationRow(r)))
      setPendingItems((pendingData.evaluations ?? []).map((r: Record<string, unknown>) => normalizeEvaluationRow(r)))
    } catch {
      toast({ title: "Error", description: "Failed to load evaluations", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, toast])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, searchQuery])

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (row) =>
        row.full_name.toLowerCase().includes(q) ||
        row.student_code.toLowerCase().includes(q) ||
        row.section.toLowerCase().includes(q),
    )
  }, [items, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedItems = filteredItems.slice(startIndex, endIndex)

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const { acting, bulkActing, reviewOne, approveAll } = useCourseEvaluationReview(() => {
    setModalOpen(false)
    setSelected(null)
    void load()
  })

  const counts = useMemo(() => {
    const c = { all: items.length, pending: 0, approved: 0, rejected: 0 }
    for (const row of items) {
      if (row.status === "pending") c.pending++
      else if (row.status === "approved") c.approved++
      else if (row.status === "rejected") c.rejected++
    }
    return c
  }, [items])

  const openDetail = async (row: EvaluationRow) => {
    setSelected(row)
    setNote("")
    setProofs([])
    setModalOpen(true)
    setLoadingDetail(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/course-evaluations?id=${row.id}`)
      const data = await res.json()
      if (data.evaluation) {
        setSelected(normalizeEvaluationRow({ ...row, ...data.evaluation }))
      }
      setProofs(data.evaluation?.proofs ?? [])
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleQuickApprove = async (row: EvaluationRow) => {
    setQuickApprovingId(row.id)
    await reviewOne(row.id, "approve")
    setQuickApprovingId(null)
  }

  const chrome = facultyEmbedChrome("course-evaluations")

  const statusFilterControl = (
    <Select value={statusFilter} onValueChange={setStatusFilter}>
      <SelectTrigger
        className={cn(
          facultyToolbarFilterButtonClass(statusFilter !== "all"),
          "h-9 w-[148px] shadow-none",
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_FILTER_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  const listMeta = loading
    ? "Loading evaluations…"
    : filteredItems.length === 0
      ? searchQuery.trim()
        ? `No evaluations matching “${searchQuery.trim()}”`
        : "No evaluations match this filter"
      : statusFilter === "all"
        ? `${filteredItems.length} submission${filteredItems.length === 1 ? "" : "s"} · ${pendingItems.length} pending · showing ${startIndex + 1}–${Math.min(endIndex, filteredItems.length)}`
        : `${filteredItems.length} with ${STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)?.label?.toLowerCase() ?? statusFilter} · showing ${startIndex + 1}–${Math.min(endIndex, filteredItems.length)}`

  return (
    <div className="space-y-3">
      <FacultyIntegratedToolbar
        moduleId="course-evaluations"
        search={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by name or ID…"
        filters={
          !loading && statusFilter === "all" ? (
            <>
              {statusFilterControl}
              <div className="hidden shrink-0 flex-wrap items-center gap-1.5 text-xs font-semibold tabular-nums sm:flex">
                <span className={cn("rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5", PORTAL_TEXT)}>
                  {counts.all} total
                </span>
                {counts.pending > 0 ? (
                  <span className="rounded-lg bg-[var(--cc-sem-warning)]/10 px-2 py-1.5 text-[var(--cc-sem-warning)]">
                    {counts.pending} pending
                  </span>
                ) : null}
                <span className="rounded-lg bg-[var(--cc-sem-success)]/10 px-2 py-1.5 text-[var(--cc-sem-success)]">
                  {counts.approved} approved
                </span>
                {counts.rejected > 0 ? (
                  <span className="rounded-lg bg-muted px-2 py-1.5 text-[var(--cc-text-muted)]">
                    {counts.rejected} returned
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            statusFilterControl
          )
        }
        meta={<p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{listMeta}</p>}
        trailing={
          <>
            {pendingItems.length > 0 ? (
              <Button
                size="sm"
                disabled={bulkActing}
                onClick={() => void approveAll(pendingItems.map((r) => r.id))}
                className={cn("h-9 gap-2", chrome.success)}
              >
                {bulkActing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Approve all</span>
                <span className="tabular-nums">({pendingItems.length})</span>
              </Button>
            ) : null}
            {!loading && filteredItems.length > 0 ? (
              <CourseEvaluationExportAllButton
                items={filteredItems}
                className={cn("h-9 gap-2", chrome.quiet)}
              />
            ) : null}
          </>
        }
      />

      {loading ? (
        <div className="space-y-2 py-1">
          <Skeleton className="h-[88px] w-full rounded-xl" />
          <Skeleton className="h-[88px] w-full rounded-xl" />
          <Skeleton className="h-[88px] w-2/3 rounded-xl" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className={cn(PORTAL_CARD, "py-10 text-center")}>
          <div className={cn("mx-auto mb-3", chrome.iconBadge())}>
            <CheckCircle2 className="h-5 w-5 !text-white" />
          </div>
          <p className={cn("text-sm font-medium", PORTAL_TEXT)}>
            {searchQuery.trim() ? "No matches" : "No evaluations match this filter"}
          </p>
          <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
            {searchQuery.trim()
              ? `No students matching “${searchQuery.trim()}”.`
              : "Try another status when students submit new evaluations."}
          </p>
        </div>
      ) : (
        <div className="max-w-3xl space-y-3">
          <div className={cn(chrome.card, "divide-y divide-[var(--border)] overflow-hidden")}>
            {paginatedItems.map((row, index) => (
              <CourseEvaluationListRow
                key={row.id}
                row={row}
                index={startIndex + index}
                onSelect={() => void openDetail(row)}
                onQuickApprove={row.status === "pending" ? handleQuickApprove : undefined}
                quickApproving={quickApprovingId === row.id}
              />
            ))}
          </div>

          {filteredItems.length > itemsPerPage ? (
            <div
              className={cn(
                PORTAL_CARD,
                "flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4",
              )}
            >
              <p className={cn("text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
                {startIndex + 1}–{Math.min(endIndex, filteredItems.length)} of {filteredItems.length}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className={cn("h-8 gap-1", chrome.quiet)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className={cn("px-1 text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className={cn("h-8 gap-1", chrome.quiet)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(v) => {
                    setItemsPerPage(Number(v))
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger
                    className={cn(facultyToolbarFilterButtonClass(), "h-8 w-[5.5rem] shadow-none")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 10, 20, 50].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} / page
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <CourseEvaluationDetailModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open)
          if (!open) setSelected(null)
        }}
        selected={selected}
        proofs={proofs}
        loadingDetail={loadingDetail}
        note={note}
        onNoteChange={setNote}
        acting={acting}
        showActions
        onApprove={() => selected && void reviewOne(selected.id, "approve", note)}
        onReject={() => selected && void reviewOne(selected.id, "reject", note)}
      />
    </div>
  )
}
