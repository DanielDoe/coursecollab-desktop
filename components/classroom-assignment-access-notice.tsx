"use client"

import { AlertTriangle, Clock, Info } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { ClassroomAccessNotice } from "@/lib/classroom-assignment-access"

export function ClassroomAssignmentAccessNotice({ notice }: { notice: ClassroomAccessNotice | null }) {
  if (!notice) return null

  const Icon =
    notice.reason === "pending_review" ? Info : notice.reason === "deadline_passed" ? Clock : AlertTriangle

  const tone =
    notice.reason === "pending_review"
      ? "bg-amber-50/90 dark:bg-amber-950/25 border-amber-200 dark:border-amber-800"
      : "bg-red-50/90 dark:bg-red-950/25 border-red-200 dark:border-red-800"

  const iconTone =
    notice.reason === "pending_review" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"

  return (
    <Alert className={tone}>
      <Icon className={`h-4 w-4 ${iconTone}`} />
      <AlertTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100">{notice.title}</AlertTitle>
      <AlertDescription className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mt-1">
        {notice.description}
      </AlertDescription>
    </Alert>
  )
}
