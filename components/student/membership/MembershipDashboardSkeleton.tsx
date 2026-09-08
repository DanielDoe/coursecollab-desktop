"use client"

import { Crown } from "lucide-react"
import {
  CC_MODULE_SKELETON_INNER,
  CC_MODULE_SKELETON_SURFACE,
  CC_SKELETON,
} from "@/lib/appearance/ui-primitives"
import { cn } from "@/lib/utils"

function Bar({ className }: { className?: string }) {
  return <div data-slot="skeleton" className={cn(CC_SKELETON, className)} />
}

export function MembershipDashboardSkeleton() {
  return (
    <div className="min-h-0 w-full">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-5 md:space-y-6">
        <div className={cn(CC_MODULE_SKELETON_SURFACE, "space-y-4 p-4 sm:p-5 md:p-6")}>
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--cc-accent)_16%,transparent)] text-[var(--cc-accent)] sm:size-12">
                <Crown className="h-5 w-5 sm:h-6 sm:w-6 opacity-80" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-2.5 pt-0.5">
                <Bar className="h-7 w-48 rounded-lg sm:w-64" />
                <Bar className="h-4 w-full max-w-md rounded-md opacity-80" />
                <div className="flex flex-wrap gap-2 pt-1">
                  <Bar className="h-6 w-24 rounded-full" />
                  <Bar className="h-6 w-16 rounded-full" />
                  <Bar className="h-6 w-28 rounded-full" />
                </div>
              </div>
            </div>
            <Bar className="h-10 w-36 shrink-0 rounded-xl" />
          </div>
          <Bar className="h-4 w-32 rounded-md opacity-80" />
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn(CC_MODULE_SKELETON_INNER, "space-y-3 p-3.5 sm:p-4")}>
                <div className="flex justify-between gap-2">
                  <div className="flex-1 space-y-2">
                    <Bar className="h-3 w-16 rounded" />
                    <Bar className="h-7 w-20 rounded" />
                    <Bar className="h-3 w-24 rounded opacity-70" />
                  </div>
                  <Bar className="size-9 rounded-xl" />
                </div>
                <Bar className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>

        <div className={cn(CC_MODULE_SKELETON_SURFACE, "space-y-4 p-4 sm:p-5 md:p-6")}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-1 items-start gap-3">
              <Bar className="size-10 rounded-2xl" />
              <div className="flex-1 space-y-2 pt-0.5">
                <Bar className="h-5 w-28 rounded-md" />
                <Bar className="h-3.5 w-56 max-w-full rounded-md opacity-80" />
              </div>
            </div>
            <Bar className="h-6 w-32 shrink-0 rounded-full" />
          </div>
          <div className="grid grid-cols-4 gap-1 rounded-2xl border border-[color-mix(in_srgb,var(--cc-text)_6%,transparent)] bg-[color-mix(in_srgb,var(--cc-ui-skeleton,var(--muted))_16%,transparent)] p-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Bar key={i} className="h-10 rounded-xl opacity-90" />
            ))}
          </div>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={cn(CC_MODULE_SKELETON_INNER, "space-y-2 p-4")}>
                <Bar className="h-3 w-20 rounded" />
                <Bar className="h-7 w-28 rounded" />
                <Bar className="h-3 w-24 rounded opacity-70" />
              </div>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-5">
            <div className={cn(CC_MODULE_SKELETON_INNER, "space-y-3 p-4 lg:col-span-3")}>
              <Bar className="h-4 w-40 rounded" />
              <Bar className="h-3 w-56 rounded opacity-70" />
              <Bar className="h-48 rounded-xl opacity-60" />
            </div>
            <div className={cn(CC_MODULE_SKELETON_INNER, "space-y-3 p-4 lg:col-span-2")}>
              <Bar className="h-4 w-36 rounded" />
              <Bar className="h-3 w-48 rounded opacity-70" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <Bar className="size-8 rounded-xl" />
                    <div className="flex-1 space-y-1.5">
                      <Bar className="h-3.5 w-full rounded" />
                      <Bar className="h-2.5 w-2/3 rounded opacity-70" />
                    </div>
                  </div>
                  <Bar className="ml-10 h-1.5 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Bar className="mx-auto h-6 w-40 rounded-md" />
          <Bar className="mx-auto h-3.5 w-64 max-w-full rounded-md opacity-80" />
          <div className="grid grid-cols-1 gap-3 pt-2 sm:gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={cn(CC_MODULE_SKELETON_SURFACE, "space-y-4 p-4 sm:p-5")}>
                <div className="flex items-center gap-2">
                  <Bar className="size-9 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Bar className="h-4 w-24 rounded" />
                    <Bar className="h-3 w-full rounded opacity-70" />
                  </div>
                </div>
                <Bar className="h-8 w-20 rounded" />
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((__, j) => (
                    <Bar key={j} className="h-3 w-full rounded opacity-70" />
                  ))}
                </div>
                <Bar className="h-9 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>

        <p className="pt-1 text-center text-xs text-[var(--cc-text-muted)]">Loading membership & plans…</p>
      </div>
    </div>
  )
}
