"use client"

import type { ReactNode } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { EMBED_MATERIAL_PANEL } from "@/components/student/dashboard-v2/embed-module-ui"
import { cn } from "@/lib/utils"

export type CodebenchBrowseView =
  | "overview"
  | "editor"
  | "challenge"
  | "tools"
  | "badges"
  | "leaderboard"
  | "streak"
  | "analytics"

function Bone({ className }: { className?: string }) {
  return <Skeleton className={cn("rounded-md", className)} />
}

function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn(EMBED_MATERIAL_PANEL, className)}>{children}</div>
}

export function CodebenchOverviewSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-5", className)} aria-busy aria-label="Loading CodeBench overview">
      <div className="grid grid-cols-2 gap-x-2.5 gap-y-5 pt-3 sm:grid-cols-4 sm:gap-x-3 sm:gap-y-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Bone className="h-9 w-9 rounded-lg" />
            <Bone className="h-6 w-10" />
            <Bone className="h-2.5 w-14" />
          </div>
        ))}
      </div>
      <Panel className="space-y-3 p-4 sm:p-5">
        <div className="flex items-start gap-2.5">
          <Bone className="h-8 w-8 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Bone className="h-3 w-28" />
            <Bone className="h-5 w-48" />
            <Bone className="h-3.5 w-full max-w-md" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Bone key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </Panel>
      <Bone className="h-28 w-full rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <CodebenchChallengeSkeleton />
        <Panel className="flex min-h-[180px] flex-col justify-between gap-4 p-5">
          <div className="space-y-2">
            <Bone className="h-5 w-40" />
            <Bone className="h-3.5 w-full" />
            <Bone className="h-3.5 w-2/3" />
          </div>
          <Bone className="h-11 w-40 rounded-xl" />
        </Panel>
      </div>
    </div>
  )
}

export function CodebenchEditorSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex min-h-[320px] flex-col overflow-hidden rounded-xl border border-[var(--border)]", className)}
      aria-busy
      aria-label="Loading editor"
    >
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        <Bone className="h-7 w-16 rounded-md" />
        <Bone className="h-7 w-16 rounded-md" />
        <Bone className="h-7 w-20 rounded-md" />
        <div className="ml-auto flex gap-2">
          <Bone className="h-7 w-7 rounded-md" />
          <Bone className="h-7 w-14 rounded-md" />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[7rem_1fr] sm:grid-cols-[10rem_1fr]">
        <div className="space-y-2 border-r border-[var(--border)] p-3">
          <Bone className="h-3 w-16" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Bone key={i} className="h-6 w-full rounded-md" />
          ))}
        </div>
        <div className="space-y-2 p-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Bone key={i} className={cn("h-3", i % 3 === 0 ? "w-3/5" : i % 2 === 0 ? "w-4/5" : "w-full")} />
          ))}
        </div>
      </div>
      <div className="border-t border-[var(--border)] px-3 py-2">
        <Bone className="h-16 w-full rounded-lg" />
      </div>
    </div>
  )
}

export function CodebenchChallengeSkeleton({ className }: { className?: string }) {
  return (
    <Panel className={cn("min-h-[220px] space-y-4 p-5", className)} aria-busy aria-label="Loading daily challenge">
      <div className="flex items-center gap-2.5">
        <Bone className="h-9 w-9 rounded-lg" />
        <div className="space-y-2">
          <Bone className="h-3 w-24" />
          <Bone className="h-5 w-48" />
        </div>
      </div>
      <Bone className="h-3.5 w-full" />
      <Bone className="h-3.5 w-5/6" />
      <Bone className="h-3.5 w-2/3" />
      <div className="flex gap-2 pt-2">
        <Bone className="h-11 w-36 rounded-xl" />
        <Bone className="h-11 w-28 rounded-xl" />
      </div>
    </Panel>
  )
}

export function CodebenchToolsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-5", className)} aria-busy aria-label="Loading Cora tools">
      <Panel className="space-y-4 p-5 sm:p-7">
        <Bone className="h-3 w-36" />
        <Bone className="h-7 w-64" />
        <Bone className="h-3.5 w-full max-w-lg" />
        <Bone className="h-11 w-full max-w-xl rounded-2xl" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Bone key={i} className="h-8 w-20 rounded-[6px]" />
          ))}
        </div>
      </Panel>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Panel key={i} className="space-y-3 p-5">
            <Bone className="h-11 w-11 rounded-2xl" />
            <Bone className="h-5 w-28" />
            <Bone className="h-3 w-full" />
            <Bone className="h-3 w-4/5" />
            <Bone className="h-8 w-20 rounded-xl" />
          </Panel>
        ))}
      </div>
    </div>
  )
}

export function CodebenchBadgesSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-5", className)} aria-busy aria-label="Loading badges">
      <Panel className="flex items-center gap-3 p-4 sm:p-5">
        <Bone className="h-12 w-12 rounded-xl" />
        <div className="space-y-2">
          <Bone className="h-3 w-24" />
          <Bone className="h-8 w-20" />
        </div>
      </Panel>
      <div className="grid grid-cols-1 gap-x-4 gap-y-10 pt-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Bone className="mx-auto h-20 w-20 rounded-2xl" />
            <Bone className="mx-auto h-4 w-28" />
            <Bone className="mx-auto h-3 w-40" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function CodebenchLeaderboardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-5", className)} aria-busy aria-label="Loading leaderboard">
      <Panel className="space-y-2 p-4 sm:p-5">
        <Bone className="h-5 w-40" />
        <Bone className="h-3.5 w-64 max-w-full" />
      </Panel>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Panel key={i} className="flex flex-col items-center gap-2 p-4">
            <Bone className="h-12 w-12 rounded-full" />
            <Bone className="h-4 w-20" />
            <Bone className="h-3 w-12" />
          </Panel>
        ))}
      </div>
      <Panel className="divide-y divide-[var(--border)] overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Bone className="h-8 w-8 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Bone className="h-3.5 w-1/2" />
              <Bone className="h-3 w-1/4" />
            </div>
            <Bone className="h-4 w-12" />
          </div>
        ))}
      </Panel>
    </div>
  )
}

export function CodebenchStreakSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-5", className)} aria-busy aria-label="Loading streak">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Panel key={i} className="space-y-2 p-3 text-center">
            <Bone className="mx-auto h-6 w-10" />
            <Bone className="mx-auto h-2.5 w-14" />
          </Panel>
        ))}
      </div>
      <Panel className="space-y-4 p-4 sm:p-5">
        <Bone className="h-5 w-36" />
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 35 }).map((_, i) => (
            <Bone key={i} className="aspect-square w-full rounded-[4px]" />
          ))}
        </div>
      </Panel>
    </div>
  )
}

export function CodebenchAnalyticsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-5", className)} aria-busy aria-label="Loading analytics">
      <Panel className="space-y-3 p-4 sm:p-5">
        <div className="flex items-start gap-2.5">
          <Bone className="h-8 w-8 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Bone className="h-5 w-48" />
            <Bone className="h-3.5 w-full" />
            <Bone className="h-3.5 w-4/5" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Bone key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </Panel>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Panel key={i} className="space-y-2 p-3">
            <Bone className="mx-auto h-8 w-8 rounded-lg" />
            <Bone className="mx-auto h-6 w-10" />
            <Bone className="mx-auto h-2.5 w-16" />
          </Panel>
        ))}
      </div>
      <Panel className="space-y-3 p-4 sm:p-5">
        <Bone className="h-5 w-44" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-wrap gap-2">
            <Bone className="h-8 w-40 rounded-[6px]" />
            <Bone className="h-8 w-32 rounded-[6px]" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Bone className="h-8 w-48 rounded-[6px]" />
            <Bone className="h-8 w-28 rounded-[6px]" />
            <Bone className="h-8 w-36 rounded-[6px]" />
          </div>
        </div>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="h-52 p-4">
          <Bone className="h-full w-full rounded-lg" />
        </Panel>
        <Panel className="h-52 p-4">
          <Bone className="h-full w-full rounded-lg" />
        </Panel>
      </div>
    </div>
  )
}

export function CodebenchPaneSkeleton({
  view = "overview",
  className,
}: {
  view?: CodebenchBrowseView
  className?: string
}) {
  switch (view) {
    case "editor":
      return <CodebenchEditorSkeleton className={className} />
    case "challenge":
      return <CodebenchChallengeSkeleton className={className} />
    case "tools":
      return <CodebenchToolsSkeleton className={className} />
    case "badges":
      return <CodebenchBadgesSkeleton className={className} />
    case "leaderboard":
      return <CodebenchLeaderboardSkeleton className={className} />
    case "streak":
      return <CodebenchStreakSkeleton className={className} />
    case "analytics":
      return <CodebenchAnalyticsSkeleton className={className} />
    default:
      return <CodebenchOverviewSkeleton className={className} />
  }
}

/** Route / first-paint shell: browse rail + pane, matching the hub layout. */
export function CodebenchHubPageSkeleton({
  view = "overview",
  className,
}: {
  view?: CodebenchBrowseView
  className?: string
}) {
  return (
    <div
      className={cn("space-y-4 p-4 sm:space-y-5 sm:p-5", className)}
      aria-busy
      aria-label="Loading CodeBench"
    >
      <div className="flex flex-col gap-3 lg:min-h-[min(560px,65vh)] lg:flex-row lg:items-stretch lg:gap-4">
        <aside className="min-w-0 lg:w-52 lg:shrink-0 lg:border-r lg:border-[var(--border)] lg:pr-4">
          <Bone className="mb-3 h-3 w-14" />
          <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <Bone key={i} className="h-9 w-28 shrink-0 rounded-lg lg:w-full" />
            ))}
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <CodebenchPaneSkeleton view={view} />
        </div>
      </div>
    </div>
  )
}
