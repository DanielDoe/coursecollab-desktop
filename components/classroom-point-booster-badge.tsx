"use client"

import { Badge } from "@/components/ui/badge"
import { formatClassroomPointsBoosterBadgeText } from "@/lib/classroom-point-booster"
import { cn } from "@/lib/utils"

type ClassroomPointBoosterBadgeProps = {
  points: number
  pointBooster?: number | null
  className?: string
  /** Instructor pending queue uses solid fills; student views use outline by default. */
  variant?: "solid" | "outline"
}

function boosterBadgeClasses(booster: number, variant: "solid" | "outline"): string {
  const b = Math.max(1, Number(booster) || 1)
  if (variant === "solid") {
    if (b >= 3) return "bg-amber-500 text-white border-transparent hover:bg-amber-500"
    if (b >= 2) return "bg-teal-600 text-white border-transparent hover:bg-teal-600"
    return "bg-slate-500 text-white border-transparent hover:bg-slate-500"
  }
  if (b >= 3) {
    return "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
  }
  if (b >= 2) {
    return "border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-700 dark:bg-teal-950/40 dark:text-teal-100"
  }
  return "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-200"
}

export function ClassroomPointBoosterBadge({
  points,
  pointBooster = 1,
  className,
  variant = "outline",
}: ClassroomPointBoosterBadgeProps) {
  const booster = Math.max(1, Number(pointBooster) || 1)
  return (
    <Badge
      variant={variant === "solid" ? "default" : "outline"}
      className={cn(
        "text-xs font-medium whitespace-normal text-left leading-snug",
        boosterBadgeClasses(booster, variant),
        className,
      )}
    >
      {formatClassroomPointsBoosterBadgeText(points, booster)}
    </Badge>
  )
}
