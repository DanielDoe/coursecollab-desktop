"use client"

import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Clock, Inbox, Loader2, RefreshCw } from "lucide-react"
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
import { COURSE_EVALUATION_ENGAGEMENT_CREDITS } from "@/lib/course-evaluation-constants"
import { CourseEvaluationDetailModal } from "@/components/instructor/course-evaluation-detail-modal"
import { CourseEvaluationReviewTicket } from "@/components/instructor/course-evaluation-review-ticket"
import { useCourseEvaluationReview } from "@/components/instructor/use-course-evaluation-review"
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import {
  gradeMismatch,
  normalizeEvaluationRow,
  type EvaluationRow,
  type Proof,
} from "@/components/instructor/course-evaluation-shared"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import {
  PORTAL_CARD,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/course-evaluations/course-evaluation-surface-classes"
import { cn } from "@/lib/utils"

const QUEUE_FOCUS_OPTIONS = [
  { value: "all", label: "All waiting" },
  { value: "mismatch", label: "Grade mismatch" },
  { value: "missing-proof", label: "Missing proof" },
  { value: "has-proof", label: "Has proof" },
] as const

type QueueFocus = (typeof QUEUE_FOCUS_OPTIONS)[number]["value"]

export function CourseEvaluationPendingPanel({
  onOpenEvaluations,
}: {
  onOpenEvaluations?: () => void
}) {
  const { toast } = useToast()
  const { courseScopeVersion } = useInstructorDashboardV2()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<EvaluationRow[]>([])
  const [approvedCount, setApprovedCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [queueFocus, setQueueFocus] = useState<QueueFocus>("all")
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<EvaluationRow | null>(null)
  const [proofs, setProofs] = useState<Proof[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [note, setNote] = useState("")
  const [actingId, setActingId] = useState<number | null>(null)
  const [actingAction, setActingAction] = useState<"approve" | "reject" | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pendingRes, approvedRes] = await Promise.all([
        instructorApiFetch("/api/instructor/course-evaluations?status=pending&session=all"),
        instructorApiFetch("/api/instructor/course-evaluations?status=approved&session=all"),
      ])
      const pendingData = await pendingRes.json()
      const approvedData = await approvedRes.json()
      if (!pendingRes.ok) throw new Error(pendingData.error || "Failed to load pending evaluations")
      if (!approvedRes.ok) throw new Error(approvedData.error || "Failed to load approved count")
      setItems((pendingData.evaluations ?? []).map((r: Record<string, unknown>) => normalizeEvaluationRow(r)))
      setApprovedCount((approvedData.evaluations ?? []).length)
    } catch {
      toast({ title: "Error", description: "Failed to load review queue", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load, courseScopeVersion])

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return items.filter((row) => {
      if (q) {
        const haystack = `${row.full_name} ${row.student_code} ${row.section}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (queueFocus === "mismatch") {
        return gradeMismatch(row.self_assessed_letter_grade, row.actual_letter_grade)
      }
      if (queueFocus === "missing-proof") return (row.proof_count ?? 0) === 0
      if (queueFocus === "has-proof") return (row.proof_count ?? 0) > 0
      return true
    })
  }, [items, queueFocus, searchQuery])

  useEffect(() => {
    setCurrentPage(1)
  }, [queueFocus, searchQuery])

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
    setActingId(null)
    setActingAction(null)
    void load()
  })

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

  const handleTicketAction = async (row: EvaluationRow, action: "approve" | "reject") => {
    setActingId(row.id)
    setActingAction(action)
    await reviewOne(row.id, action)
    setActingId(null)
    setActingAction(null)
  }

  const chrome = facultyEmbedChrome("course-evaluations")
  const hasActiveQuery = Boolean(searchQuery.trim()) || queueFocus !== "all"
  const queueMeta = loading
    ? "Loading review queue…"
    : items.length === 0
      ? "Nothing waiting for Canvas-proof review"
      : filteredItems.length === 0
        ? hasActiveQuery
          ? "No waiting tickets match this search or filter"
          : "Nothing waiting for Canvas-proof review"
        : `${filteredItems.length} waiting${filteredItems.length !== items.length ? ` of ${items.length}` : ""} · ${COURSE_EVALUATION_ENGAGEMENT_CREDITS} credits each · showing ${startIndex + 1}–${Math.min(endIndex, filteredItems.length)}`

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <FacultyIntegratedToolbar
        moduleId="course-evaluations"
        search={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search waiting students…"
        searchResetToken={courseScopeVersion}
        filters={
          <Select value={queueFocus} onValueChange={(value) => setQueueFocus(value as QueueFocus)}>
            <SelectTrigger
              className={cn(
                facultyToolbarFilterButtonClass(queueFocus !== "all"),
                "h-9 w-[168px] shadow-none",
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUEUE_FOCUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        meta={<p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{queueMeta}</p>}
        trailing={
          <>
            {filteredItems.length > 0 ? (
              <Button
                size="sm"
                disabled={bulkActing || loading}
                onClick={() => void approveAll(filteredItems.map((r) => r.id))}
                className={cn("h-9 gap-2", chrome.success)}
              >
                {bulkActing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Approve all</span>
                <span className="tabular-nums">({items.length})</span>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-lg"
              disabled={loading}
              onClick={() => void load()}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="space-y-2 py-1">
          <Skeleton className="h-[88px] w-full rounded-xl" />
          <Skeleton className="h-[88px] w-full rounded-xl" />
          <Skeleton className="h-[72px] w-2/3 rounded-xl" />
        </div>
      ) : items.length === 0 || filteredItems.length === 0 ? (
        <div
          className={cn(
            PORTAL_CARD,
            "flex min-h-[min(420px,50vh)] flex-1 flex-col items-center justify-center border-dashed px-6 py-12 text-center sm:px-8",
          )}
        >
          <div className={cn("mx-auto mb-3", chrome.iconBadge())}>
            <Inbox className="h-5 w-5 !text-white" />
          </div>
          <p className={cn("text-sm font-medium", PORTAL_TEXT)}>
            {items.length === 0 ? "Review queue is clear" : "No matching tickets"}
          </p>
          <p className={cn("mt-1 max-w-sm text-xs", PORTAL_TEXT_MUTED)}>
            {items.length === 0
              ? "New surveys appear here only after a student submits and uploads Canvas proof. Approved reports stay in Evaluations."
              : "Try another name, ID, or queue filter. Waiting tickets stay in this inbox until you approve or return them."}
          </p>
          {items.length === 0 && approvedCount > 0 && onOpenEvaluations ? (
            <Button
              type="button"
              size="sm"
              onClick={onOpenEvaluations}
              className={cn("mt-4 h-9 gap-2", chrome.solid)}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              View {approvedCount} approved evaluation{approvedCount === 1 ? "" : "s"}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="max-w-3xl space-y-3">
          <div className={cn(PORTAL_CARD, "flex items-start gap-3 px-3 py-3 sm:px-4")}>
            <div className={cn("mt-0.5 shrink-0", chrome.iconBadge())}>
              <Clock className="h-4 w-4 !text-white" />
            </div>
            <div className="min-w-0">
              <p className={cn("text-sm font-medium", PORTAL_TEXT)}>Review inbox</p>
              <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>
                Approve to award {COURSE_EVALUATION_ENGAGEMENT_CREDITS} credits, or return if proof is
                missing or unclear.
              </p>
            </div>
          </div>

          <div className={cn(chrome.card, "divide-y divide-[var(--border)] overflow-hidden")}>
            {paginatedItems.map((row, index) => (
              <CourseEvaluationReviewTicket
                key={row.id}
                row={row}
                index={startIndex + index}
                actingAction={actingId === row.id ? actingAction : null}
                onOpen={() => void openDetail(row)}
                onApprove={() => void handleTicketAction(row, "approve")}
                onReturn={() => void handleTicketAction(row, "reject")}
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
