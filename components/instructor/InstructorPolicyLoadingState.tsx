"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { PORTAL_CARD, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

export function InstructorPolicyLoadingState({
  label = "Loading policies…",
  moduleId: _moduleId,
}: {
  label?: string
  moduleId?: string
}) {
  return (
    <div className="space-y-4 py-2" aria-busy="true" aria-label={label}>
      <p className={cn("sr-only", PORTAL_TEXT_MUTED)}>{label}</p>
      <div className={cn(PORTAL_CARD, "space-y-3 p-4 sm:p-5")}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full max-w-md" />
        <div className="space-y-2 pt-2">
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}
