"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { BulkReevaluateAttemptsPanel } from "@/components/bulk-reevaluate-attempts-panel"
import type { AssessmentBulkReevaluateScope } from "@/hooks/use-bulk-reevaluate-attempts"

export type { AssessmentBulkReevaluateScope } from "@/hooks/use-bulk-reevaluate-attempts"

type Scope = AssessmentBulkReevaluateScope

export interface AssessmentBulkReevaluateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  quizId: number
  quizTitle: string
  assessmentLabel: string
  initialScope?: AssessmentBulkReevaluateScope
  hideScopePicker?: boolean
  /** When set (e.g. side menu flow), preview is limited to this class session. */
  sessionCode?: string | null
}

export function AssessmentBulkReevaluateModal({
  open,
  onOpenChange,
  quizId,
  quizTitle,
  assessmentLabel,
  initialScope = "pending",
  hideScopePicker = false,
  sessionCode,
}: AssessmentBulkReevaluateModalProps) {
  const [scope, setScope] = useState<Scope>(initialScope)

  useEffect(() => {
    if (!open) {
      if (!hideScopePicker) setScope("pending")
    }
  }, [open, hideScopePicker])

  useEffect(() => {
    if (open && hideScopePicker) {
      setScope(initialScope)
    }
  }, [open, hideScopePicker, initialScope])

  if (!quizId) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Bulk re-evaluate — {quizTitle}</DialogTitle>
          <DialogDescription>
            Re-runs AI grading on existing submissions only. Student answers are not deleted or replaced; scores and
            feedback are updated on the same attempt rows. When you finish a batch, the preview list reloads so pending
            (PND%) queues reflect the latest state.
          </DialogDescription>
        </DialogHeader>

        <BulkReevaluateAttemptsPanel
          quizId={quizId}
          quizTitle={quizTitle}
          assessmentLabel={assessmentLabel}
          scope={scope}
          onScopeChange={hideScopePicker ? undefined : setScope}
          showScopePicker={!hideScopePicker}
          variant="dialog"
          onClose={() => onOpenChange(false)}
          sessionCode={sessionCode}
        />
      </DialogContent>
    </Dialog>
  )
}
