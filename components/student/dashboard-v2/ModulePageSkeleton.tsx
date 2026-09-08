"use client"

import { CcBookLoader } from "@/components/ui/cc-book-loader"
import { CC_MODULE_SKELETON_SURFACE, CC_SKELETON } from "@/lib/appearance/ui-primitives"
import { cn } from "@/lib/utils"

function SkeletonBar({ className }: { className?: string }) {
  return <div data-slot="skeleton" className={cn(CC_SKELETON, className)} />
}

export function ModulePageSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-[280px] w-full min-w-0 flex-col gap-4 bg-[var(--cc-background,#faf8fc)] p-4 sm:p-6",
        className,
      )}
      aria-busy
      aria-label="Loading module"
    >
      <div className="flex items-center justify-center py-2">
        <CcBookLoader size="md" label="Loading module" />
      </div>
      <div className={cn(CC_MODULE_SKELETON_SURFACE, "space-y-3 overflow-hidden p-4 sm:p-5")}>
        <SkeletonBar className="h-9 w-48 rounded-lg" />
        <SkeletonBar className="h-4 w-2/3" />
        <div className="space-y-2 pt-2">
          <SkeletonBar className="h-10 w-full rounded-lg" />
          <SkeletonBar className="h-10 w-full rounded-lg" />
          <SkeletonBar className="h-10 w-5/6 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
