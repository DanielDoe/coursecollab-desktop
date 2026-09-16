import { cn } from "@/lib/utils"

export function ModuleListSkeleton({
  rows = 6,
  className,
}: {
  rows?: number
  className?: string
}) {
  return (
    <div className={cn("w-full min-w-0 space-y-3", className)} aria-busy aria-label="Loading">
      <div className="h-9 w-48 animate-pulse rounded-lg bg-[var(--muted)]" />
      <div className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-[var(--muted)]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-2/3 animate-pulse rounded bg-[var(--muted)]" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-[var(--muted)]" />
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
