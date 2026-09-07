"use client"

import { AlertCircle } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface RetakeForfeitAlertProps {
  open: boolean
  onClose: () => void
  assessmentLabel?: string
}

export function RetakeForfeitAlert({
  open,
  onClose,
  assessmentLabel = "assessment",
}: RetakeForfeitAlertProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-full">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <AlertDialogTitle>Retake Forfeited</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">
            You have forfeited your retake by viewing the {assessmentLabel} report. Viewing the report reveals the correct answers, so retakes are no longer available for this {assessmentLabel}.
            <br />
            <br />
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Contact your instructor if you need another attempt.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose}>OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
