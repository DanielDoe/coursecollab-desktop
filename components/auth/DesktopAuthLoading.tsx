"use client"

import { CcBookLoader } from "@/components/ui/cc-book-loader"
import { cn } from "@/lib/utils"

type DesktopAuthLoadingProps = {
  label?: string
  className?: string
  compact?: boolean
}

/** Centered CourseCollab book loader for desktop auth panes and shells. */
export function DesktopAuthLoading({
  label = "Loading",
  className,
  compact = false,
}: DesktopAuthLoadingProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center text-center",
        compact ? "gap-2 py-8" : "gap-3 py-12",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <CcBookLoader size={compact ? "md" : "lg"} label={label} />
      <p className="text-sm font-medium text-[var(--cc-text-secondary)]">{label}</p>
    </div>
  )
}
