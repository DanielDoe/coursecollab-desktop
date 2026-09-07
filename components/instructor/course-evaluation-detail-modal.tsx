"use client"

import { Loader2, X } from "lucide-react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { CourseEvaluationDetailBody } from "@/components/instructor/course-evaluation-detail-body"
import { CourseEvaluationExportPdfButton } from "@/components/instructor/course-evaluation-export-actions"
import type { EvaluationRow, Proof } from "@/components/instructor/course-evaluation-shared"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/course-evaluations/course-evaluation-surface-classes"
import { cn } from "@/lib/utils"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selected: EvaluationRow | null
  proofs: Proof[]
  loadingDetail?: boolean
  note: string
  onNoteChange: (v: string) => void
  acting?: boolean
  showActions?: boolean
  onApprove?: () => void
  onReject?: () => void
}

export function CourseEvaluationDetailModal({
  open,
  onOpenChange,
  selected,
  proofs,
  loadingDetail,
  note,
  onNoteChange,
  acting,
  showActions,
  onApprove,
  onReject,
}: Props) {
  const chrome = facultyEmbedChrome("course-evaluations")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[92vh] max-w-2xl flex-col gap-0 overflow-hidden border-[var(--border)] bg-[var(--card)] p-0"
      >
        <DialogHeader className="shrink-0 border-b border-[var(--border)] px-5 pb-3 pt-5 pr-14">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <DialogTitle className={cn("text-base font-semibold", PORTAL_TEXT)}>
                Evaluation report
              </DialogTitle>
              <DialogDescription className={PORTAL_TEXT_MUTED}>
                Full survey responses and Canvas proof for this student.
              </DialogDescription>
            </div>
            {selected && !loadingDetail ? (
              <CourseEvaluationExportPdfButton
                row={selected}
                proofs={proofs}
                className={cn("h-9 gap-2", chrome.quiet)}
              />
            ) : null}
          </div>
        </DialogHeader>

        <DialogClose
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 text-[var(--cc-text-muted)] shadow-none hover:bg-muted/50 hover:text-[var(--cc-text)] focus:outline-none focus-visible:ring-0"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </DialogClose>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loadingDetail || !selected ? (
            <div className="space-y-3 py-8">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : (
            <CourseEvaluationDetailBody
              selected={selected}
              proofs={proofs}
              note={note}
              onNoteChange={onNoteChange}
              acting={acting}
              showActions={showActions}
              onApprove={onApprove}
              onReject={onReject}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
