"use client"

import { useState, useEffect } from "react"
import { Clock, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatCentralDateTime } from "@/lib/timezone"

export interface RolloverPolicyForModal {
  self_service_open: boolean
  apply_deadline_iso: string
  cutoff_days_before_semester_end: number
  semester_end_iso: string
  academic_term?: "spring" | "fall"
  academic_end_year?: number
  academic_term_label?: string | null
  show_closed_notice?: boolean
}

interface RolloverConfirmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  quizTitle: string
  rolloverHours: number
  membershipAppliesUsed: number
  membershipAppliesMax: number
  policy: RolloverPolicyForModal | null
  onConfirm: () => void
  confirming: boolean
}

export function RolloverConfirmModal({
  open,
  onOpenChange,
  quizTitle,
  rolloverHours,
  membershipAppliesUsed,
  membershipAppliesMax,
  policy,
  onConfirm,
  confirming,
}: RolloverConfirmModalProps) {
  const [agreed, setAgreed] = useState(false)

  useEffect(() => {
    if (!open) setAgreed(false)
  }, [open])

  const deadlineLabel =
    policy?.apply_deadline_iso != null
      ? formatCentralDateTime(policy.apply_deadline_iso, "MMM d, yyyy '·' h:mm a")
      : null
  const semesterEndLabel =
    policy?.semester_end_iso != null
      ? formatCentralDateTime(policy.semester_end_iso, "MMM d, yyyy")
      : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[min(90vh,640px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-amber-600 shrink-0" />
            Confirm Extend (rollover)
          </DialogTitle>
        </DialogHeader>
        <div className="text-left space-y-3 text-sm text-slate-600 dark:text-slate-400">
          <p>
            You are about to apply an extension for:{" "}
            <span className="font-medium text-slate-900 dark:text-slate-100">{quizTitle}</span>
          </p>
          {policy?.academic_term != null && policy.academic_end_year != null && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Semester anchor: {policy.academic_term === "fall" ? "Fall" : "Spring"}{" "}
              {policy.academic_end_year} (PVAMU calendar)
            </p>
          )}
          <ul className="list-disc pl-5 space-y-2">
            <li>
              This starts a <strong>{rolloverHours}-hour</strong> window to open, continue, or retake this
              assessment after its due date (if your instructor enabled Extend for it).
            </li>
            <li>
              Explorer: <strong>1</strong> extension per assessment; Trailblazer: up to <strong>3</strong>{" "}
              extensions per assessment. Each time you apply after a previous window has ended, you start a{" "}
              <strong>new</strong> window — paid retakes only apply while a window is <strong>active</strong>;
              when it ends, access for this past-due item ends until you apply again (if you still have
              extensions left) or your instructor helps.
            </li>
            <li>
              Self-service Extend closes on <strong>{deadlineLabel ?? "the posted cutoff date"}</strong> (
              {policy?.cutoff_days_before_semester_end ?? 21} days before the semester end date
              {semesterEndLabel ? ` of ${semesterEndLabel}` : ""}) so grades can be finalized. After that,
              contact your instructor.
            </li>
            <li>
              You have used <strong>{membershipAppliesUsed}</strong> of <strong>{membershipAppliesMax}</strong>{" "}
              membership extension(s) for this assessment.
            </li>
          </ul>
          <div className="flex gap-2 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800 px-3 py-2 text-amber-900 dark:text-amber-100">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              If you do not agree, choose Cancel — the extension will <strong>not</strong> be applied.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 py-2">
          <Checkbox
            id="rollover-rules-understood"
            checked={agreed}
            onCheckedChange={(v) => setAgreed(v === true)}
            disabled={confirming}
          />
          <label
            htmlFor="rollover-rules-understood"
            className="text-sm font-medium leading-snug cursor-pointer text-slate-800 dark:text-slate-200"
          >
            I have read and understand these rules.
          </label>
        </div>
        <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={!agreed || confirming}>
            {confirming ? "Applying…" : "Apply extension"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
