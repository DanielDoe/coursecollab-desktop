"use client"

import { cn } from "@/lib/utils"
import { PORTAL_CARD } from "@/lib/appearance/portal-nav-classes"

function Shimmer({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-[var(--muted)]", className)} />
}

export function ProjectsListPanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div
      className={cn(PORTAL_CARD, "space-y-3 overflow-hidden p-3 sm:p-4")}
      aria-busy
      aria-label="Loading projects list"
    >
      <Shimmer className="h-4 w-24" />
      <Shimmer className="h-9 w-full rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 p-3"
          >
            <Shimmer className="size-9 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Shimmer className="h-3.5 w-3/4" />
              <Shimmer className="h-3 w-1/2" />
              <div className="flex gap-2 pt-1">
                <Shimmer className="h-5 w-14 rounded-full" />
                <Shimmer className="h-5 w-16 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ProjectsManagerPanelSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <div
      className={cn(PORTAL_CARD, "space-y-3 overflow-hidden p-3 sm:p-4")}
      aria-busy
      aria-label="Loading my projects"
    >
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Shimmer className="h-4 w-28" />
          <Shimmer className="h-3 w-44" />
        </div>
        <Shimmer className="h-9 w-20 shrink-0 rounded-xl" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: cards }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/15 p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <Shimmer className="h-4 w-2/3" />
              <Shimmer className="h-5 w-16 rounded-full" />
            </div>
            <Shimmer className="h-3 w-full" />
            <Shimmer className="h-3 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ProjectsPageSkeleton({ showHeader = true }: { showHeader?: boolean }) {
  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-5" aria-busy aria-label="Loading projects">
      {showHeader ? (
        <div className="flex min-w-0 items-end justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Shimmer className="h-3 w-16" />
            <Shimmer className="h-4 w-56 max-w-full" />
          </div>
          <Shimmer className="h-9 w-24 shrink-0 rounded-xl" />
        </div>
      ) : null}
      <div className="grid gap-3 xl:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.15fr)] xl:items-start">
        <ProjectsListPanelSkeleton />
        <ProjectsManagerPanelSkeleton />
      </div>
    </div>
  )
}
