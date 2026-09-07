"use client"

import { cn } from "@/lib/utils"
import { PORTAL_CARD } from "@/lib/appearance/portal-nav-classes"

function Shimmer({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-[var(--muted)]", className)} />
}

export function GroupsManagerPanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div
      className={cn(PORTAL_CARD, "space-y-3 overflow-hidden p-3 sm:p-4")}
      aria-busy
      aria-label="Loading my groups"
    >
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Shimmer className="h-4 w-24" />
          <Shimmer className="h-3 w-20" />
        </div>
        <Shimmer className="h-9 w-24 shrink-0 rounded-xl" />
      </div>
      <Shimmer className="h-9 w-full rounded-xl" />
      <div className="flex gap-2">
        <Shimmer className="h-7 w-14 rounded-full" />
        <Shimmer className="h-7 w-20 rounded-full" />
        <Shimmer className="h-7 w-16 rounded-full" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 p-3"
          >
            <Shimmer className="size-9 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Shimmer className="h-3.5 w-2/3" />
              <Shimmer className="h-3 w-1/3" />
            </div>
            <Shimmer className="h-6 w-16 shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function GroupDiscoverPanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div
      className={cn(PORTAL_CARD, "space-y-3 overflow-hidden p-3 sm:p-4")}
      aria-busy
      aria-label="Loading discover panel"
    >
      <div className="space-y-2">
        <Shimmer className="h-4 w-20" />
        <Shimmer className="h-3 w-40" />
      </div>
      <Shimmer className="h-9 w-full rounded-xl" />
      <div className="grid h-10 grid-cols-3 gap-1 rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-1">
        <Shimmer className="h-full rounded-lg" />
        <Shimmer className="h-full rounded-lg" />
        <Shimmer className="h-full rounded-lg" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/15 p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <Shimmer className="h-4 w-1/2" />
              <Shimmer className="h-5 w-14 rounded-full" />
            </div>
            <Shimmer className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function GroupsPageSkeleton({ showHeader = true }: { showHeader?: boolean }) {
  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-5" aria-busy aria-label="Loading groups">
      {showHeader ? (
        <div className="space-y-2">
          <Shimmer className="h-3 w-14" />
          <Shimmer className="h-4 w-72 max-w-full" />
        </div>
      ) : null}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] xl:items-start">
        <GroupsManagerPanelSkeleton />
        <GroupDiscoverPanelSkeleton />
      </div>
    </div>
  )
}
