"use client"

import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Loader2 } from "lucide-react"
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
import { CourseEvaluationExportAllButton } from "@/components/instructor/course-evaluation-export-actions"
import { CourseEvaluationDetailModal } from "@/components/instructor/course-evaluation-detail-modal"
import { CourseEvaluationListRow } from "@/components/instructor/course-evaluation-list-row"
import { useCourseEvaluationReview } from "@/components/instructor/use-course-evaluation-review"
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
import {
  PORTAL_CARD,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/course-evaluations/course-evaluation-surface-classes"
import { cn } from "@/lib/utils"

export function CourseEvaluationPendingPanel() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<EvaluationRow[]>([])
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
      const res = await instructorApiFetch("/api/instructor/course-evaluations?status=pending&session=all")
      const data = await res.json()
      setItems((data.evaluations ?? []).map((r: Record<string, unknown>) => normalizeEvaluationRow(r)))
    } catch {
      toast({ title: "Error", description: "Failed to load pending evaluations", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedItems = items.slice(startIndex, endIndex)

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const { acting, bulkActing, reviewOne, approveAll } = useCourseEvaluationReview(() => {
    setModalOpen(false)
    setSelected(null)
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

  const handleQuickApprove = async (row: EvaluationRow) => {
    setQuickApprovingId(row.id)
    await reviewOne(row.id, "approve")
    setQuickApprovingId(null)
  }

  const chrome = facultyEmbedChrome("course-evaluations")

  return (
    <div className="space-y-3">
      <FacultyIntegratedToolbar
        moduleId="course-evaluations"
        meta={
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {loading
              ? "Loading pending evaluations…"
              : items.length === 0
                ? "No pending submissions"
                : `${items.length} pending · ${COURSE_EVALUATION_ENGAGEMENT_CREDITS} credits each on approval · showing ${startIndex + 1}–${Math.min(endIndex, items.length)}`}
          </p>
        }
        trailing={
          <>
            {items.length > 0 ? (
              <Button
                size="sm"
                disabled={bulkActing}
                onClick={() => void approveAll(items.map((r) => r.id))}
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
            {!loading && items.length > 0 ? (
              <CourseEvaluationExportAllButton
                items={items}
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
      ) : items.length === 0 ? (
        <div className={cn(PORTAL_CARD, "py-10 text-center")}>
          <div className={cn("mx-auto mb-3", chrome.iconBadge())}>
            <ClipboardList className="h-5 w-5 !text-white" />
          </div>
          <p className={cn("text-sm font-medium", PORTAL_TEXT)}>No pending course evaluations</p>
          <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
            Submissions appear here when students complete the survey and upload Canvas proof.
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
                onQuickApprove={handleQuickApprove}
                quickApproving={quickApprovingId === row.id}
              />
            ))}
          </div>

          {items.length > itemsPerPage ? (
            <div
              className={cn(
                PORTAL_CARD,
                "flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4",
              )}
            >
              <p className={cn("text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
                {startIndex + 1}–{Math.min(endIndex, items.length)} of {items.length}
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
