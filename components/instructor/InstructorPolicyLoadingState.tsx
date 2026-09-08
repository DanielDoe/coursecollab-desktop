"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { PORTAL_CARD, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

export function InstructorPolicyLoadingState({
  label = "Loading policies…",
  moduleId: _moduleId,
  fillHeight = false,
}: {
  label?: string
  moduleId?: string
  fillHeight?: boolean
}) {
  return (
    <div
      className={cn(fillHeight ? "flex min-h-0 flex-1 flex-col py-2" : "space-y-4 py-2")}
      aria-busy="true"
      aria-label={label}
    >
      <p className={cn("sr-only", PORTAL_TEXT_MUTED)}>{label}</p>
      <div className={cn(PORTAL_CARD, "space-y-3 p-4 sm:p-5", fillHeight && "flex min-h-0 flex-1 flex-col")}>
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
