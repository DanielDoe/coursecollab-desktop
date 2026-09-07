"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DailyChallengeTab } from "./DailyChallengeTab"

interface DailyChallengeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  code: string
  studentId: string | null
  onXpEarned: (amount: number) => void
}

export function DailyChallengeDialog({
  open,
  onOpenChange,
  code,
  studentId,
  onXpEarned,
}: DailyChallengeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto bg-slate-900 dark:bg-slate-800 border-slate-700 dark:border-slate-600 w-[calc(100%-2rem)] sm:w-full rounded-xl sm:rounded-2xl">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
          <DialogTitle className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 dark:from-blue-300 dark:to-cyan-300 bg-clip-text text-transparent">
            <span className="sm:hidden">Challenge</span>
            <span className="hidden sm:inline">Daily Challenge</span>
          </DialogTitle>
        </DialogHeader>
        <div className="px-4 sm:px-6 pb-4 sm:pb-6">
          <DailyChallengeTab code={code} studentId={studentId} onXpEarned={onXpEarned} />
        </div>
      </DialogContent>
    </Dialog>
  )
}


