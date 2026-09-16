"use client"

import { cn } from "@/lib/utils"
import { studentModuleSpinnerClass } from "@/lib/student-module-themes"

export function ModulePageSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-[280px] items-center justify-center w-full min-w-0",
        className,
      )}
      aria-busy
      aria-label="Loading module"
    >
      <div
        className={cn(
          "h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--cc-accent)]",
          studentModuleSpinnerClass,
        )}
      />
    </div>
  )
}
