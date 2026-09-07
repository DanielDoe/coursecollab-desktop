"use client"

import { cn } from "@/lib/utils"

/**
 * Displays how many retakes a student has left for an assessment.
 * Only shown when attempts_remaining > 0.
 */
export function RetakesRemainingBadge({
  attemptsRemaining,
  className,
  variant = "inline",
}: {
  attemptsRemaining: number | null | undefined
  className?: string
  variant?: "inline" | "badge"
}) {
  if (attemptsRemaining == null || attemptsRemaining <= 0) return null

  const text = `${attemptsRemaining} retake${attemptsRemaining !== 1 ? "s" : ""} left`

  if (variant === "badge") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
          className
        )}
      >
        {text}
      </span>
    )
  }

  return (
    <span
      className={cn(
        "text-emerald-600 dark:text-emerald-400 font-medium",
        className
      )}
    >
      {text}
    </span>
  )
}
