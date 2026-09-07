"use client"

import { Badge } from "@/components/ui/badge"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"

type ClassroomProvisionalScoreBadgeProps = {
  className?: string
  compact?: boolean
}

export function ClassroomProvisionalScoreBadge({
  className,
  compact = false,
}: ClassroomProvisionalScoreBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 gap-1 font-normal",
        compact ? "text-[10px] px-1.5 py-0" : "text-xs",
        className,
      )}
    >
      <Clock className={cn("shrink-0", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
      {compact ? "Provisional" : "Provisional — instructor review pending"}
    </Badge>
  )
}
