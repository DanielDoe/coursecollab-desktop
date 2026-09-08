import { CC_MODULE_SKELETON_SURFACE, CC_SKELETON } from "@/lib/appearance/ui-primitives"
import { cn } from "@/lib/utils"

function SkeletonBar({ className }: { className?: string }) {
  return <div data-slot="skeleton" className={cn(CC_SKELETON, className)} />
}

export function ModuleListSkeleton({
  rows = 6,
  className,
}: {
  rows?: number
  className?: string
}) {
  return (
    <div className={cn("w-full min-w-0 space-y-3", className)} aria-busy aria-label="Loading">
      <SkeletonBar className="h-9 w-48 rounded-lg" />
      <div className={cn(CC_MODULE_SKELETON_SURFACE, "divide-y divide-[var(--border)] overflow-hidden")}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <SkeletonBar className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBar className="h-3.5 w-2/3" />
              <SkeletonBar className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function StaleRefreshHint({
  visible,
  onRetry,
}: {
  visible: boolean
  onRetry?: () => void
}) {
  if (!visible) return null
  return (
    <div className="mb-3 flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-2 text-xs text-[var(--cc-text-muted)]">
      <span>Unable to refresh. Showing last saved view.</span>
      {onRetry ? (
        <button type="button" className="font-medium text-[var(--cc-accent)] underline-offset-2 hover:underline" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  )
}
